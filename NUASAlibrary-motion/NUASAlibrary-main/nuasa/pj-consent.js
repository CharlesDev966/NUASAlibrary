/* NUASA Library: cookie consent + consent-gated first-party analytics.
 *
 * Cookies set by this file (all first-party, none shared with advertisers):
 *   nuasa_consent  the visitor's choice (always set once they choose; 12 months)
 *   nuasa_vid      random anonymous visitor ID (set ONLY after "analytics" is accepted)
 *
 * Public API (window.NUASAConsent):
 *   .open()          show the banner / settings again
 *   .allowed()       true if analytics was accepted
 *   .track(name, p)  log an event to Supabase (does nothing without consent)
 *   .visitorId()     the anonymous visitor ID, or null without consent
 *   .pref.get(k, d) / .pref.set(k, v)   remembered preferences (stay on this device)
 *   .recent.list() / .recent.add({id,name,url}) / .recent.clear()   last opened files (stay on this device)
 *   .clearPersonal() wipe saved preferences and recent files
 *
 * Tracked automatically once analytics is accepted:
 *   page_view, download (a[download] or [data-download]), file_open ([data-open]),
 *   search (input[type=search] or [data-search]), time_on_page (seconds, per page)
 * Optional attributes on links/buttons: data-file-name, data-file-id
 * Event: window "nuasa:recent" fires whenever the recent list changes.
 */
(function () {
  "use strict";

  var CK = "nuasa_consent", VID = "nuasa_vid", VER = 1, YEAR = 60 * 60 * 24 * 365;
  var SECURE = location.protocol === "https:" ? "; Secure" : "";

  /* ---------- cookie helpers ---------- */
  function setCookie(n, v, age) {
    document.cookie = n + "=" + encodeURIComponent(v) + "; Max-Age=" + age + "; Path=/; SameSite=Lax" + SECURE;
  }
  function getCookie(n) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + n + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
  }
  function delCookie(n) {
    document.cookie = n + "=; Max-Age=0; Path=/; SameSite=Lax" + SECURE;
  }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 3 | 8)).toString(16);
    });
  }

  /* ---------- consent state ---------- */
  function read() {
    try {
      var o = JSON.parse(getCookie(CK) || "null");
      return o && o.v === VER ? o : null;
    } catch (e) { return null; }
  }
  function save(analytics) {
    var was = allowed();
    setCookie(CK, JSON.stringify({ v: VER, a: analytics ? 1 : 0, t: Date.now() }), YEAR);
    if (!analytics) delCookie(VID);          // withdrawing consent removes the visitor ID
    if (analytics && !was) {                   // first moment we are allowed to count anything
      visibleMs = 0;
      lastShown = document.visibilityState === "visible" ? Date.now() : 0;
      lastPath = location.pathname + location.hash;
      track("page_view");
    }
  }
  function allowed() {
    var c = read();
    return !!(c && c.a);
  }

  /* ---------- analytics (first-party, to our own Supabase) ---------- */
  var sentReferrer = false;
  function track(name, props, pathOverride) {
    if (!allowed()) return;
    var sb = window.NUASA_SB;
    if (!sb || !sb.from) return;
    var v = vid();
    var row = {
      visitor_id: v,
      name: String(name).slice(0, 60),
      path: (pathOverride || location.pathname + location.hash).slice(0, 300),
      referrer: sentReferrer ? null : (document.referrer || "").slice(0, 300) || null,
      props: props || {}
    };
    sentReferrer = true;
    Promise.resolve(sb.auth.getSession())
      .then(function (r) {
        var s = r && r.data && r.data.session;
        row.user_id = s ? s.user.id : null;
        return sb.from("events").insert(row);
      })
      .catch(function () { /* analytics must never break the app */ });
  }

  function vid() {
    if (!allowed()) return null;
    var v = getCookie(VID);
    if (!v) { v = uuid(); setCookie(VID, v, YEAR); }
    return v;
  }

  /* ---------- richer analytics: downloads, opens, searches, time on page ---------- */
  var lastPath = location.pathname + location.hash;
  var visibleMs = 0;
  var lastShown = document.visibilityState === "visible" ? Date.now() : 0;

  function flushTime(reason, path) {
    if (lastShown) { visibleMs += Date.now() - lastShown; lastShown = 0; }
    var secs = Math.round(visibleMs / 1000);
    visibleMs = 0;
    if (secs >= 2) track("time_on_page", { seconds: Math.min(secs, 3600), reason: reason }, path || lastPath);
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flushTime("hidden");
    else lastShown = Date.now();
  });
  window.addEventListener("pagehide", function () { flushTime("leave"); });

  // Same naming rule as pj-feedback.js, so downloads and ratings line up per file.
  function fileLabel(t) {
    var n = t.getAttribute("data-file-name") || t.getAttribute("download");
    if (n) return n;
    var href = t.getAttribute("href") || "";
    if (href && href.charAt(0) !== "#" && href.indexOf("javascript:") !== 0) {
      var last = href.split("?")[0].split("#")[0].split("/").pop();
      try { last = decodeURIComponent(last); } catch (e) {}
      if (last) return last;
    }
    return (t.textContent || "").trim().slice(0, 80);
  }
  function extOf(name) {
    var m = /\.([a-z0-9]{1,8})$/i.exec(name || "");
    return m ? m[1].toLowerCase() : null;
  }

  var lastQ = "", searchTimer = null;
  function logSearch(q, count) {
    q = String(q || "").trim().toLowerCase().slice(0, 80);
    if (q.length < 2 || q === lastQ) return;
    lastQ = q;
    track("search", { q: q, results: typeof count === "number" ? count : null });
  }

  /* ---------- personalization (stays on this device, works without analytics) ---------- */
  var PK = "nuasa_pref", RK = "nuasa_recent", MAX_RECENT = 10;
  function lsGet(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; }
    catch (e) { return d; }
  }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var pref = {
    get: function (k, d) { var p = lsGet(PK, {}); return k in p ? p[k] : d; },
    set: function (k, v) { var p = lsGet(PK, {}); p[k] = v; lsSet(PK, p); }
  };
  function fire(list) {
    try { window.dispatchEvent(new CustomEvent("nuasa:recent", { detail: list })); } catch (e) {}
  }
  var recent = {
    list: function () { return lsGet(RK, []); },
    add: function (item) {
      if (!item || !(item.id || item.name)) return;
      var key = item.id || item.name;
      var list = recent.list().filter(function (x) { return (x.id || x.name) !== key; });
      list.unshift({
        id: item.id || null,
        name: String(item.name || "").slice(0, 120),
        url: item.url ? String(item.url).slice(0, 300) : null,
        t: Date.now()
      });
      list = list.slice(0, MAX_RECENT);
      lsSet(RK, list);
      fire(list);
    },
    clear: function () { try { localStorage.removeItem(RK); } catch (e) {} fire([]); }
  };
  function clearPersonal() {
    try { localStorage.removeItem(PK); } catch (e) {}
    recent.clear();
  }

  /* ---------- banner UI ---------- */
  var CSS =
    ".nc{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;display:flex;justify-content:center;padding:12px 12px calc(12px + env(safe-area-inset-bottom,0px));pointer-events:none;font-family:var(--b,system-ui,sans-serif)}" +
    ".nc-box{pointer-events:auto;width:100%;max-width:560px;background:var(--card,#0e1013);color:var(--fg,#e9ecef);border:1px solid var(--line,#1f242a);border-radius:18px;padding:16px 18px;box-shadow:0 12px 40px rgba(0,0,0,.35);font-size:14px;line-height:1.5}" +
    ".nc-t{font-weight:600;font-size:15px;margin:0 0 4px}" +
    ".nc-p{margin:0;color:var(--mut,#8d959f)}" +
    ".nc-p a{color:var(--g,#22c55e);text-underline-offset:3px}" +
    ".nc-opts{margin:12px 0 0;display:none;border-top:1px solid var(--line,#1f242a)}" +
    ".nc-box.open .nc-opts{display:block}" +
    ".nc-row{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid var(--line,#1f242a)}" +
    ".nc-row b{display:block;font-weight:600}" +
    ".nc-row span{color:var(--mut,#8d959f);font-size:13px}" +
    ".nc-row input{width:20px;height:20px;margin-top:2px;accent-color:var(--g,#22c55e);flex:none}" +
    ".nc-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}" +
    ".nc-btn{flex:1 1 auto;min-height:42px;padding:0 16px;border-radius:999px;border:1px solid var(--line,#1f242a);background:transparent;color:var(--fg,#e9ecef);font:600 14px/1 var(--b,system-ui,sans-serif);cursor:pointer}" +
    ".nc-btn:hover{border-color:var(--g,#22c55e)}" +
    ".nc-btn:focus-visible{outline:2px solid var(--g,#22c55e);outline-offset:2px}" +
    ".nc-save{display:none}.nc-box.open .nc-save{display:block}.nc-box.open .nc-custom{display:none}";

  var el = null;

  function close() {
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
  }

  function open() {
    if (el) return;
    if (!document.getElementById("nc-css")) {
      var st = document.createElement("style");
      st.id = "nc-css";
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var on = allowed();
    el = document.createElement("div");
    el.className = "nc";
    el.innerHTML =
      '<div class="nc-box" role="dialog" aria-live="polite" aria-label="Cookie settings">' +
        '<p class="nc-t">Cookies on NUASA Library</p>' +
        '<p class="nc-p">We use a few essential cookies to keep you signed in. With Accept all, we can improve the library and make learning seamless.</p>' +
        '<div class="nc-opts">' +
          '<div class="nc-row"><div><b>Essential</b><span>Keeps you signed in and remembers your light or dark mode, saved files and recently opened files. Always on.</span></div>' +
          '<input type="checkbox" checked disabled aria-label="Essential cookies, always on"></div>' +
          '<div class="nc-row"><div><b>Analytics</b><span>An anonymous ID, the pages you open, your searches, downloads and time spent on pages, stored only on our own database. Never used for ads.</span></div>' +
          '<input type="checkbox" id="nc-a" aria-label="Analytics cookies"' + (on ? " checked" : "") + "></div>" +
        "</div>" +
        '<div class="nc-btns">' +
          '<button type="button" class="nc-btn nc-save" data-nc="save">Save choices</button>' +
          '<button type="button" class="nc-btn" data-nc="yes">Accept all</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(el);

    el.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-nc]");
      if (!b) return;
      var a = b.getAttribute("data-nc");
      if (a === "yes") save(true);
      else if (a === "no") save(false);
      else if (a === "save") save(el.querySelector("#nc-a").checked);
      close();
    });
  }

  /* ---------- wire-up ---------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-cookie-settings]");
    if (t) { e.preventDefault(); open(); }
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("a[download],[data-download]");
    if (t) {
      var f = fileLabel(t);
      track("download", { file: f, type: extOf(f) });
    }
    var o = e.target.closest && e.target.closest("[data-open]");
    if (o) {
      var n = fileLabel(o);
      var id = o.getAttribute("data-file-id");
      recent.add({ id: id, name: n, url: o.getAttribute("href") });
      track("file_open", { file: n, id: id });
    }
  });

  document.addEventListener("input", function (e) {
    var t = e.target;
    if (!t || !t.matches || !t.matches('input[type="search"],[data-search]')) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { logSearch(t.value); }, 1200);
  });

  window.addEventListener("hashchange", function () {
    flushTime("nav", lastPath);          // close out the page we just left
    lastPath = location.pathname + location.hash;
    if (document.visibilityState === "visible") lastShown = Date.now();
    track("page_view");
  });

  function start() {
    if (!read()) {
      // Browsers sending Global Privacy Control have already said no: respect it quietly.
      if (navigator.globalPrivacyControl === true) save(false);
      else open();
    } else {
      track("page_view");
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.NUASAConsent = {
    open: open, allowed: allowed, track: track, visitorId: vid,
    pref: pref, recent: recent, clearPersonal: clearPersonal
  };
})();
