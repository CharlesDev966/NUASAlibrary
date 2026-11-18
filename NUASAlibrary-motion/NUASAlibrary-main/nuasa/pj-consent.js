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
    if (analytics && !was) track("page_view"); // first moment we are allowed to count anything
  }
  function allowed() {
    var c = read();
    return !!(c && c.a);
  }

  /* ---------- analytics (first-party, to our own Supabase) ---------- */
  var sentReferrer = false;
  function track(name, props) {
    if (!allowed()) return;
    var sb = window.NUASA_SB;
    if (!sb || !sb.from) return;
    var v = getCookie(VID);
    if (!v) { v = uuid(); setCookie(VID, v, YEAR); }
    var row = {
      visitor_id: v,
      name: String(name).slice(0, 60),
      path: (location.pathname + location.hash).slice(0, 300),
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
          '<div class="nc-row"><div><b>Essential</b><span>Keeps you signed in and remembers your light or dark mode and saved files. Always on.</span></div>' +
          '<input type="checkbox" checked disabled aria-label="Essential cookies, always on"></div>' +
          '<div class="nc-row"><div><b>Analytics</b><span>An anonymous ID and the pages you open, stored only on our own database. Never used for ads.</span></div>' +
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

  window.addEventListener("hashchange", function () { track("page_view"); });

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

  window.NUASAConsent = { open: open, allowed: allowed, track: track };
})();
