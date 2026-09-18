/* ==========================================================================
   FoldFX — buy overlay fallback
   --------------------------------------------------------------------------
   The Polar embedded checkout (data-polar-checkout) only works once this
   site's origin is allow-listed in the Polar dashboard:

       polar.sh → Dashboard → Settings → Preferences → Embedding

   Add https://roodynorman21.github.io there (plus the site's future custom
   domain, if one is ever added). The list applies as soon as it is saved.

   Until the origin is on the list, Polar bounces the overlay iframe to
   polar.sh — which forbids framing (frame-ancestors 'none') — so the
   browser blocks the frame, logs the "Framing 'https://polar.sh/' …"
   console message, and Polar's "loaded" postMessage never arrives.

   How we detect that (no cross-origin introspection is possible):
     • A REJECTED embed fires the iframe's `load` event almost instantly
       (on the blocked redirect) and never posts a "loaded" message.
     • A WORKING embed loads the real checkout first, then posts "loaded".
   So: once the iframe fires `load`, we open a short grace window for the
   "loaded" message. If it never arrives, the overlay is torn down and the
   visitor is sent to the hosted checkout (new tab when the browser allows
   it, same tab otherwise) — the Buy button always works.

   Note: keying the grace window off `load` (not off the click) also makes
   the fallback safe on slow connections — a genuinely loading checkout is
   never torn down while it is still making progress.
   ========================================================================== */
(function () {
  "use strict";

  // Grace window (ms) after the overlay iframe's `load` event for Polar to
  // post its "loaded" message. A rejected embed hits this ~instantly and
  // falls back in ~1.5s; a working checkout posts "loaded" right after its
  // page finishes loading, well inside this window.
  var GRACE_AFTER_LOAD = 1500;
  // Backstop (ms) after the iframe appears but before any `load` event —
  // covers "checkout page never even starts loading". Slow connections are
  // still safe: they get the full GRACE_AFTER_LOAD window after `load`.
  var LOAD_WATCH = 4000;
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
    var settled = false; // a decision was made (embed OK or fallback done)

    function done() {
      watchClick.running = false;
    }

    function reject() {
      if (settled) return;
      settled = true;
      done();
      teardownOverlay();
      fallbackToTab(link);
    }

    // Wait for the overlay iframe to appear.
    var startedAt = Date.now();
    var watch = setInterval(function () {
      var frame = document.querySelector('iframe[src*="polar"]');
      if (frame) {
        clearInterval(watch);

        // Grace window starts at the iframe's `load` event. Rejected embeds
        // fire `load` on the blocked redirect and never post "loaded", so
        // they are caught here ~1.5s after the click.
        frame.addEventListener("load", function () {
          if (settled) return;
          setTimeout(function () {
            if (settled || alive) return;
            reject();
          }, GRACE_AFTER_LOAD);
        });

        // Backstop: `load` never fires at all (stalled request).
        setTimeout(function () {
          if (settled || alive) return;
          reject();
        }, LOAD_WATCH);
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
