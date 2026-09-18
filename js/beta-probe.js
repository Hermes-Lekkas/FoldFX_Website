/* ==========================================================================
   FoldFX beta page — APK availability probe + tester-talk (giscus) loader
   ---------------------------------------------------------------------------
   (External file so the site's Content-Security-Policy can forbid inline
   scripts; previously this lived inline at the bottom of beta.html.)

   APK probe
   - Runs once at load (harmless while the download card is hidden) and
     again the moment the gate unlocks a tester (window.FXBetaProbe is
     called by js/beta-gate.js): the download button activates only when
     downloads/FoldFX-0.2.5-release.apk actually exists on the deployed
     site, so nobody ever hits a dead link.

   Tester talk (giscus)
   - Conversations powered by giscus (GitHub Discussions): threaded
     replies, reactions, no tracking, no ads; the developer moderates.
     Dormant until GISCUS.categoryId below is filled in. Setup:
       1) Repo Settings -> General -> Features -> enable Discussions
       2) Install https://github.com/apps/giscus on the website repo
       3) Paste the "Announcements" category id from https://giscus.app
   ========================================================================== */

(function () {
  "use strict";

  /* ---------- beta APK availability ---------- */
  var btn = document.getElementById("betaDlBtn");
  var soon = document.getElementById("betaDlSoon");
  var row = document.getElementById("betaChecksumRow");

  function gate(e) {
    if (btn && btn.getAttribute("aria-disabled") === "true") e.preventDefault();
  }
  if (btn) btn.addEventListener("click", gate);

  function state(ready) {
    if (!btn) return;
    if (ready) {
      btn.removeAttribute("aria-disabled");
      if (soon) soon.hidden = true;
      if (row) row.hidden = false;
    } else {
      btn.setAttribute("aria-disabled", "true");
      if (soon) soon.hidden = false;
      if (row) row.hidden = true;
    }
  }

  window.FXBetaProbe = function () {
    try {
      fetch("downloads/FoldFX-0.2.5-release.apk", { method: "HEAD" })
        .then(function (r) { state(r.ok); })
        .catch(function () { state(false); });
    } catch (e) { state(false); }
  };
  window.FXBetaProbe();

  /* ---------- tester talk (giscus) ---------- */
  var GISCUS = {
    repo: "RoodyNorman21/FoldFX_Website",
    repoId: "R_kgDOUbdb3A",
    category: "Announcements",
    categoryId: "DIC_kwDO_REPLACE_ME" /* <- replace to activate */
  };

  /* giscus speaks most of the site's languages; the rest fall back. */
  var GISCUS_LANG = {
    en: "en", es: "es", fr: "fr", de: "de", ar: "ar", bn: "bn",
    ru: "ru", pt: "pt", id: "id", ja: "ja", zh: "zh-CN", hi: "hi",
    el: "el", ur: "en", mr: "en", te: "en"
  };

  var thread = document.getElementById("giscusThread");
  var wait = document.getElementById("giscusWait");

  function giscusLang(code) { return GISCUS_LANG[code] || "en"; }
  function giscusReady() {
    return GISCUS.categoryId && GISCUS.categoryId.indexOf("REPLACE") === -1;
  }

  function loadGiscus() {
    if (!thread) return;
    if (!giscusReady()) { if (wait) wait.hidden = false; return; }
    if (wait) wait.hidden = true;
    thread.innerHTML = "";
    var s = document.createElement("script");
    s.src = "https://giscus.app/client.js";
    s.async = true;
    s.crossOrigin = "anonymous";
    s.setAttribute("data-repo", GISCUS.repo);
    s.setAttribute("data-repo-id", GISCUS.repoId);
    s.setAttribute("data-category", GISCUS.category);
    s.setAttribute("data-category-id", GISCUS.categoryId);
    s.setAttribute("data-mapping", "pathname");
    s.setAttribute("data-strict", "1");
    s.setAttribute("data-reactions-enabled", "1");
    s.setAttribute("data-emit-metadata", "0");
    s.setAttribute("data-input-position", "top");
    s.setAttribute("data-theme", "transparent_dark");
    s.setAttribute("data-lang", giscusLang(window.FXLang ? window.FXLang.get() : "en"));
    s.setAttribute("data-loading", "lazy");
    thread.appendChild(s);
  }

  if (window.FXLang) window.FXLang.onChange(function () { loadGiscus(); });
  loadGiscus();
})();
