/* NUASA Library: post-download experience popup (5-star rating).
 *
 * Shows a small popup after a student downloads a file and asks how it went.
 * Ratings are saved to your own Supabase table "feedback".
 *
 * Triggers automatically when a student clicks:
 *   <a download ...>   or   any element with  data-download
 * Optional: data-file-name="Anatomy Notes.pdf" to set the file name that is saved.
 *
 * Public API (window.NUASAFeedback):
 *   .ask(fileName)   show the popup manually (e.g. after your own download code finishes)
 *   .close()         hide it
 */
(function () {
  "use strict";

  var DELAY = 1200;                 // ms to wait after the click before the popup appears
  var COOLDOWN = 10 * 60 * 1000;    // don't ask again within 10 minutes
  var LS = "nuasa_fb";              // localStorage key: { last: time, files: { name: 1 } }

  /* ---------- tiny storage helpers (never throw) ---------- */
  function load() {
    try { return JSON.parse(localStorage.getItem(LS) || "null") || { last: 0, files: {} }; }
    catch (e) { return { last: 0, files: {} }; }
  }
  function store(o) {
    try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) { /* ignore */ }
  }

  /* ---------- save to Supabase ---------- */
  function send(rating, comment, fileName) {
    var sb = window.NUASA_SB;
    if (!sb || !sb.from) return Promise.resolve();
    var row = {
      rating: rating,
      comment: comment ? String(comment).slice(0, 1000) : null,
      file_name: fileName ? String(fileName).slice(0, 200) : null,
      path: (location.pathname + location.hash).slice(0, 300),
      // Links the rating to the same anonymous visitor as downloads/searches (null without analytics consent)
      visitor_id: (window.NUASAConsent && window.NUASAConsent.visitorId && window.NUASAConsent.visitorId()) || null
    };
    return Promise.resolve(sb.auth.getSession())
      .then(function (r) {
        var s = r && r.data && r.data.session;
        row.user_id = s ? s.user.id : null;
        return sb.from("feedback").insert(row);
      })
      .catch(function () { /* feedback must never break the app */ });
  }

  /* ---------- UI ---------- */
  var CSS =
    ".nf{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.45);font-family:var(--b,system-ui,sans-serif)}" +
    ".nf-box{position:relative;width:100%;max-width:400px;background:var(--card,#0e1013);color:var(--fg,#e9ecef);border:1px solid var(--line,#1f242a);border-radius:18px;padding:22px 20px 18px;box-shadow:0 12px 40px rgba(0,0,0,.35);font-size:14px;line-height:1.5;text-align:center}" +
    ".nf-x{position:absolute;top:8px;right:8px;width:36px;height:36px;border:0;background:transparent;color:var(--mut,#8d959f);font-size:22px;line-height:1;cursor:pointer;border-radius:50%}" +
    ".nf-x:hover{color:var(--fg,#e9ecef)}" +
    ".nf-t{margin:0 0 4px;font-weight:600;font-size:17px}" +
    ".nf-p{margin:0;color:var(--mut,#8d959f)}" +
    ".nf-file{display:block;margin-top:2px;font-weight:600;color:var(--fg,#e9ecef);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".nf-stars{display:flex;justify-content:center;gap:6px;margin:16px 0 4px}" +
    ".nf-s{width:46px;height:46px;border:0;background:transparent;cursor:pointer;padding:0;border-radius:10px;color:var(--line,#2a3138);transition:transform .12s,color .12s}" +
    ".nf-s svg{width:100%;height:100%;display:block;fill:currentColor}" +
    ".nf-s.on{color:#f5b301}" +
    ".nf-s:hover{transform:scale(1.12)}" +
    ".nf-s:focus-visible,.nf-btn:focus-visible,.nf-x:focus-visible,.nf-ta:focus-visible{outline:2px solid var(--g,#22c55e);outline-offset:2px}" +
    ".nf-lbl{min-height:20px;margin:0;font-weight:600;color:var(--g,#22c55e)}" +
    ".nf-more{display:none;margin-top:12px;text-align:left}" +
    ".nf-box.picked .nf-more{display:block}" +
    ".nf-ta{width:100%;min-height:76px;resize:vertical;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#1f242a);background:transparent;color:var(--fg,#e9ecef);font:14px/1.4 var(--b,system-ui,sans-serif)}" +
    ".nf-btns{display:flex;gap:8px;margin-top:12px}" +
    ".nf-btn{flex:1 1 auto;min-height:42px;padding:0 16px;border-radius:999px;border:1px solid var(--line,#1f242a);background:transparent;color:var(--fg,#e9ecef);font:600 14px/1 var(--b,system-ui,sans-serif);cursor:pointer}" +
    ".nf-btn:hover{border-color:var(--g,#22c55e)}" +
    ".nf-btn.pri{background:var(--g,#22c55e);border-color:var(--g,#22c55e);color:#04210f}" +
    ".nf-done{display:none;padding:14px 0 6px;font-weight:600}" +
    ".nf-box.sent .nf-done{display:block}" +
    ".nf-box.sent .nf-ask{display:none}";

  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z"/></svg>';
  var LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

  var el = null, timer = null, prevFocus = null;

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function close() {
    clearTimeout(timer);
    document.removeEventListener("keydown", onKey, true);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = null;
    if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) {} }
    prevFocus = null;
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  function ask(fileName) {
    if (el) return;
    var st = load();
    var name = fileName ? String(fileName) : "";
    if (name && st.files[name]) return;                    // already rated this file
    if (Date.now() - st.last < COOLDOWN) return;           // asked very recently

    if (!document.getElementById("nf-css")) {
      var s = document.createElement("style");
      s.id = "nf-css";
      s.textContent = CSS;
      document.head.appendChild(s);
    }

    var rating = 0;
    prevFocus = document.activeElement;
    el = document.createElement("div");
    el.className = "nf";

    var stars = "";
    for (var i = 1; i <= 5; i++) {
      stars += '<button type="button" class="nf-s" role="radio" aria-checked="false" data-n="' + i +
        '" aria-label="' + i + (i === 1 ? " star" : " stars") + '">' + STAR + "</button>";
    }

    el.innerHTML =
      '<div class="nf-box" role="dialog" aria-modal="true" aria-label="Rate your download">' +
        '<button type="button" class="nf-x" data-nf="close" aria-label="Close">&times;</button>' +
        '<div class="nf-ask">' +
          '<p class="nf-t">How was your experience?</p>' +
          '<p class="nf-p">Your download is on its way.' + (name ? '<span class="nf-file">' + esc(name) + "</span>" : "") + "</p>" +
          '<div class="nf-stars" role="radiogroup" aria-label="Rating out of 5">' + stars + "</div>" +
          '<p class="nf-lbl" aria-live="polite"></p>' +
          '<div class="nf-more">' +
            '<textarea class="nf-ta" maxlength="1000" placeholder="Anything we could do better? (optional)" aria-label="Optional comment"></textarea>' +
            '<div class="nf-btns">' +
              '<button type="button" class="nf-btn" data-nf="close">Not now</button>' +
              '<button type="button" class="nf-btn pri" data-nf="send">Submit</button>' +
            "</div>" +
          "</div>" +
        "</div>" +
        '<p class="nf-done" role="status">Thank you for your feedback!</p>' +
      "</div>";
    document.body.appendChild(el);
    document.addEventListener("keydown", onKey, true);

    var box = el.querySelector(".nf-box");
    var btns = el.querySelectorAll(".nf-s");
    var lbl = el.querySelector(".nf-lbl");

    function paint(n) {
      for (var k = 0; k < btns.length; k++) {
        var on = k < n;
        btns[k].classList.toggle("on", on);
        btns[k].setAttribute("aria-checked", k + 1 === rating ? "true" : "false");
      }
      lbl.textContent = LABELS[n] || "";
    }

    for (var j = 0; j < btns.length; j++) {
      (function (b) {
        var n = +b.getAttribute("data-n");
        b.addEventListener("mouseenter", function () { paint(n); });
        b.addEventListener("focus", function () { paint(n); });
        b.addEventListener("click", function () {
          rating = n;
          box.classList.add("picked");
          paint(n);
        });
      })(btns[j]);
    }
    el.querySelector(".nf-stars").addEventListener("mouseleave", function () { paint(rating); });
    el.querySelector(".nf-stars").addEventListener("focusout", function () { paint(rating); });

    el.addEventListener("click", function (e) {
      if (e.target === el) { close(); return; }            // click on backdrop
      var b = e.target.closest && e.target.closest("[data-nf]");
      if (!b) return;
      var a = b.getAttribute("data-nf");
      if (a === "close") { close(); return; }
      if (a === "send" && rating) {
        var c = el.querySelector(".nf-ta").value.trim();
        send(rating, c, name);
        st.last = Date.now();
        if (name) st.files[name] = 1;
        store(st);
        box.classList.add("sent");
        timer = setTimeout(close, 1800);
      }
    });

    var first = btns[0];
    if (first && first.focus) first.focus();
    // Count the prompt itself so a dismissed popup does not reappear immediately.
    st.last = Date.now();
    store(st);
  }

  /* ---------- auto trigger on download clicks ---------- */
  function fileNameFrom(t) {
    var n = t.getAttribute("data-file-name") || t.getAttribute("download");
    if (n) return n;
    var href = t.getAttribute("href") || "";
    if (href && href.charAt(0) !== "#" && href.indexOf("javascript:") !== 0) {
      var last = href.split("?")[0].split("#")[0].split("/").pop();
      try { last = decodeURIComponent(last); } catch (e) {}
      if (last) return last;
    }
    return "";
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("a[download],[data-download]");
    if (!t) return;
    var name = fileNameFrom(t);
    setTimeout(function () { ask(name); }, DELAY);
  });

  window.NUASAFeedback = { ask: ask, close: close };
})();
