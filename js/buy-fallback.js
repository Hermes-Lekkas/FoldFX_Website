/* ==========================================================================
   FoldFX — buy overlay fallback
   --------------------------------------------------------------------------
   The Polar embedded checkout (data-polar-checkout) only works once this
   site's origin is allow-listed in the Polar dashboard (Settings →
   Checkout origins). Until then Polar silently rejects the embed: the
   overlay iframe is redirected to polar.sh and never posts a "loaded"
   message, leaving the visitor stuck on an empty overlay.

   This script watches for the checkout's "loaded" postMessage after the
   Buy button is clicked. If the overlay never signals within a few
   seconds, it tears the overlay down and sends the visitor to the hosted
   checkout (new tab when the browser allows it, same-tab otherwise) —
   so the Buy button always works.
   ========================================================================== */
(function () {
  "use strict";

  // How long (ms) to wait for the checkout's "loaded" message after the
  // overlay iframe appears before assuming the embed was rejected.
  // Kept under Chrome's ~5s transient-activation window so a popup is
  // still allowed by the browser's popup blocker at fallback time.
  var LOADED_TIMEOUT = 3000;
  // How long (ms) to wait for the overlay iframe to appear at all.
  var IFRAME_WATCH = 3000;
  var POLAR_ORIGINS = ["https://polar.sh", "https://sandbox.polar.sh", "https://buy.polar.sh"];

  var alive = false; // any POLAR_CHECKOUT message seen for this click

  function teardownOverlay() {
    try {
      var frames = document.querySelectorAll('iframe[src*="polar"]');
      for (var i = 0; i < frames.length; i++) frames[i].remove();
      var spinners = document.querySelectorAll(".polar-loader-spinner");
      for (var j = 0; j < spinners.length; j++) {
        var holder = spinners[j].parentElement;
        if (holder) holder.remove();
      }
      document.body.classList.remove("polar-no-scroll");
      var style = document.querySelector("style[data-polar-loader], style#polar-loader");
      if (style) style.remove();
    } catch (_) { /* best effort */ }
  }

  function fallbackToTab(link) {
    var opened = null;
    try {
      // NOTE: window.open(url, "_blank", "noopener") returns null even when
      // the popup succeeds, so we open without it and sever the opener
      // manually — otherwise we would get BOTH a new tab and a same-tab nav.
      opened = window.open(link.href, "_blank");
      if (opened) {
        try { opened.opener = null; } catch (_) { /* cross-origin */ }
      }
    } catch (_) { /* blocked */ }
    if (!opened) {
      // Popup blocked (common for timers) — navigate in the same tab instead.
      window.location.href = link.href;
    }
  }

  function watchClick(link) {
    if (watchClick.running) return; // one fallback per click
    watchClick.running = true;
    alive = false;

    function done() { watchClick.running = false; }

    // Wait for the overlay iframe to appear.
    var startedAt = Date.now();
    var watch = setInterval(function () {
      var frame = document.querySelector('iframe[src*="polar"]');
      if (frame) {
        clearInterval(watch);
        // Overlay is up — now wait for its "loaded" message.
        setTimeout(function () {
          done();
          if (!alive) {
            teardownOverlay();
            fallbackToTab(link);
          }
        }, LOADED_TIMEOUT);
      } else if (Date.now() - startedAt > IFRAME_WATCH) {
        // No overlay at all (script blocked / CSP denied): the browser's
        // native navigation to the hosted checkout handles it.
        clearInterval(watch);
        done();
      }
    }, 150);
  }

  function init() {
    var link = document.querySelector("a[data-polar-checkout]");
    if (!link) return;

    window.addEventListener("message", function (e) {
      if (!e || POLAR_ORIGINS.indexOf(e.origin) === -1) return;
      var data = e.data;
      if (data && data.type === "POLAR_CHECKOUT") alive = true;
    });

    link.addEventListener("click", function () { watchClick(link); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
