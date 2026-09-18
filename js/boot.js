/* ==========================================================================
   FoldFX boot guard — loaded synchronously from <head> on every page
   ---------------------------------------------------------------------------
   Why this is a separate file (and no longer inline in each page):
   the site ships a strict Content-Security-Policy that forbids inline
   scripts, so anything that must run before first paint lives here.

   What it does
   - Marks <html> as .js so no-JS fallback styling stays correct.
   - Frame protection: if another site embeds a FoldFX page in an iframe,
     we break out of it (clickjacking defence; GitHub Pages cannot send
     X-Frame-Options headers, so this is the static-site equivalent).
   - Pre-detects the visitor's language BEFORE the body renders so a
     non-English dictionary can be applied without an English flash:
     the <html> gets the fx-boot class, which hides the body until
     js/i18n/i18n.js applies the translation (or a 2.5 s failsafe
     unhides it — nobody can ever get stuck behind a blank page).
   ========================================================================== */

(function () {
  "use strict";

  var d = document.documentElement;
  d.classList.add("js");

  /* Frame protection — best effort; cross-origin frames that block
     top navigation are handled by the CSP's frame-src/object-src rules. */
  try {
    if (window.top !== window.self) window.top.location.replace(window.location.href);
  } catch (e) { /* cross-origin top — cannot touch; nothing more to do */ }

  var L = null;
  try { L = new URLSearchParams(location.search).get("lang") || localStorage.getItem("foldfx-lang"); } catch (e) {}
  if (!L) {
    var c = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || "en"];
    var codes = ["zh", "hi", "es", "fr", "ar", "bn", "pt", "ru", "ur", "id", "de", "ja", "mr", "te", "el"];
    for (var i = 0; i < c.length; i++) {
      var b = String(c[i]).toLowerCase().split("-")[0];
      if (codes.indexOf(b) > -1) { L = b; break; }
    }
  }
  if (L && L !== "en") d.classList.add("fx-boot");
})();
