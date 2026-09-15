/* ==========================================================================
   FoldFX — site interactions
   - 3D book-fold simulator: a web replica of the
     app's angle-driven cover -> main display transition
   - Nav, mobile menu, scroll reveals, live clock
   ========================================================================== */

(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Translation helper: reads the active i18n dictionary (js/i18n/), with the
     English fallbacks below so the demo keeps working even without it. */
  function T(key, fallback) {
    try {
      var v = window.FXLang ? window.FXLang.t(key) : "";
      return typeof v === "string" && v !== "" ? v : fallback;
    } catch (e) { return fallback; }
  }

  /* ---------------- Nav ---------------- */

  var nav = document.getElementById("nav");
  var burger = document.getElementById("navBurger");

  function onScroll() {
    if (window.scrollY > 10) nav.classList.add("scrolled");
    else nav.classList.remove("scrolled");
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (burger) {
    burger.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".nav-links a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------------- Reveal on scroll ---------------- */

  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------------- Footer year ---------------- */

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------------- Live clock (simulated launcher) ---------------- */

  var coverTime = document.getElementById("coverTime");
  var coverDate = document.getElementById("coverDate");
  var mainTime = document.getElementById("mainTime");
  var mainDate = document.getElementById("mainDate");
  var covTime = document.getElementById("covTime");

  function tickClock() {
    var now = new Date();
    var loc = (window.FXLang && FXLang.get()) || document.documentElement.lang || "en";
    var time, date;
    try {
      time = now.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit", hour12: false });
      date = now.toLocaleDateString(loc, { weekday: "short", month: "short", day: "numeric" });
    } catch (e) {
      var hh = String(now.getHours()).padStart(2, "0");
      var mm = String(now.getMinutes()).padStart(2, "0");
      time = hh + ":" + mm;
      date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    }
    if (coverTime) coverTime.textContent = time;
    if (mainTime) mainTime.textContent = time;
    if (coverDate) coverDate.textContent = date;
    if (mainDate) mainDate.textContent = date;
    if (covTime) covTime.textContent = time;
  }
  tickClock();
  setInterval(tickClock, 30000);

  /* Re-format the simulated device clock when the site language changes */
  if (window.FXLang && window.FXLang.onChange) {
    window.FXLang.onChange(function () { tickClock(); });
  }

  /* ---------------- Media lightbox ---------------- */

  var lightbox = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbCap = document.getElementById("lbCap");
  var lbClose = document.getElementById("lbClose");
  var lbOpener = null;

  function openLightbox(btn) {
    if (!lightbox || !lbImg) return;
    var img = btn.querySelector("img");
    lbOpener = btn;
    lbImg.src = btn.getAttribute("data-full") || (img ? img.src : "");
    lbImg.alt = img ? img.alt : "";
    if (lbCap) {
      var fig = btn.closest(".media-item");
      var cap = fig ? fig.querySelector("figcaption") : null;
      lbCap.textContent = cap ? cap.textContent : "";
    }
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    if (lbClose) lbClose.focus();
  }

  function closeLightbox() {
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    document.body.style.overflow = "";
    if (lbOpener) { try { lbOpener.focus(); } catch (e) {} lbOpener = null; }
  }

  Array.prototype.forEach.call(document.querySelectorAll(".media-zoom"), function (btn) {
    btn.addEventListener("click", function () { openLightbox(btn); });
  });
  if (lbClose) lbClose.addEventListener("click", closeLightbox);
  if (lightbox) lightbox.addEventListener("click", function (e) { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLightbox();
  });

  /* ---------------- Fold simulator ----------------
     3D book-fold device:
     - the left half swings around a real hinge (CSS rotateY) sweeping
       TOWARD the viewer, exactly like opening a physical book-style
       foldable — the inner screens stay facing each other inside the
       wedge the whole way (positive rotateY = correct chirality)
     - the cover display lives on the left half's back face
     - the main display is split across both inner faces
     - angle -> reveal window -> screen handoff carried by per-layer
       defocus (GPU blur on the UI layers themselves), crease-weighted
       haze overlays, content compression into the crease, a cast
       shadow from the tilting half + a diagonal light sweep
     - one haptic tick at the midpoint, once per gesture

     Performance contract (keeps it at 60fps):
     - only transform / opacity / filter are written — never layout
       properties (no left/width per frame)
     - blur radii are quantised to 0.5px steps
     - every style write goes through a cache that skips identical
       values, so idle frames cost nothing
     - fully transparent layers drop to visibility:hidden and their
       filter drops to none, letting the compositor cache them
     - no backdrop-filter and no SVG filter references anywhere in
       the scene (both force expensive per-frame re-filtering)       */

  var slider = document.getElementById("angle");
  if (!slider) return;

  var foldScene = document.getElementById("foldScene");
  var foldScaler = document.getElementById("foldScaler");
  var device3d = document.getElementById("device3d");
  var halfLeft = document.getElementById("halfLeft");
  var uiMainLeft = document.getElementById("uiMainLeft");
  var uiMainRight = document.getElementById("uiMainRight");
  var uiCover = document.getElementById("uiCover");
  var offLeft = document.getElementById("offLeft");
  var offRight = document.getElementById("offRight");
  var offCover = document.getElementById("offCover");
  var sweepLeft = document.getElementById("sweepLeft");
  var sweepRight = document.getElementById("sweepRight");
  var hingeCore = document.getElementById("hingeCore");
  var deviceShadow = document.getElementById("deviceShadow");
  var bvEdgeL = document.getElementById("bvEdgeL");
  var bvMidL = document.getElementById("bvMidL");
  var bvEdgeR = document.getElementById("bvEdgeR");
  var bvMidR = document.getElementById("bvMidR");
  var bvEdgeC = document.getElementById("bvEdgeC");
  var bvMidC = document.getElementById("bvMidC");
  var castShadowR = document.getElementById("castShadowR");
  var angleVal = document.getElementById("angleVal");
  var foldLabel = document.getElementById("foldLabel");
  var haptic = document.getElementById("haptic");
  var autoBtn = document.getElementById("autoBtn");
  var autoBtnLabel = document.getElementById("autoBtnLabel");

  var W0 = 55;  // reveal window start (degrees)
  var W1 = 115; // reveal window end (degrees)

  var prevT = 0;
  var tickFired = false;
  var hapticTimeout = null;

  /* Motion smear: fold speed injects extra defocus (fast flicks smear the
     screens like a real panel mid-swing), then it settles back to crisp. */
  var motion = 0;
  var lastDeg = null;
  var lastMove = 0;
  var lastDir = 0; // -1 closing, 1 opening — feeds the physical yaw lean
  var settling = false;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  /* Style-write cache: identical values are skipped so the renderer only
     re-rasters when something actually changed. */
  var written = {};
  function put(el, prop, val) {
    if (!el) return;
    var key = el.id + ":" + prop;
    if (written[key] === val) return;
    written[key] = val;
    el.style[prop] = val;
  }

  function setVis(el, on) {
    if (!el) return;
    var v = on ? "visible" : "hidden";
    var key = el.id + ":vis";
    if (written[key] === v) return;
    written[key] = v;
    el.style.visibility = v;
  }

  /* Quantise blur to 0.5px steps: far fewer distinct filter strings
     while animating, so the blur is re-rasterised far less often. */
  function q(v) { return (Math.round(v * 2) / 2).toFixed(1); }

  function fireHaptic() {
    if (!haptic) return;
    haptic.classList.add("tick");
    if (hapticTimeout) clearTimeout(hapticTimeout);
    hapticTimeout = setTimeout(function () {
      haptic.classList.remove("tick");
    }, 480);
  }

  function setVeil(el, op) {
    if (!el) return;
    if (op < 0.02) {
      put(el, "opacity", "0");
      setVis(el, false);
      return;
    }
    setVis(el, true);
    put(el, "opacity", op.toFixed(3));
  }

  /* --- Pure visual applier: every frame value is derived from deg + motion --- */
  function applyFold(deg) {
    var t = clamp01(deg / 180);
    var phi = 180 - deg;                      // closing angle away from flat
    var w = clamp01((deg - W0) / (W1 - W0));  // handoff progress through the reveal window
    var s = Math.sin(Math.PI * w);            // peaks at the middle of the handoff
    var mBlur = motion * 9;                   // velocity-driven smear, px

    // 1) Hinge rotation: positive rotateY swings the cover TOWARD the
    //    viewer (the way you open a book facing you) so both inner
    //    screens stay inside the wedge — never folding through the back.
    //    Negative local translateZ fakes the stacked panel thickness:
    //    in front of the fixed half when closed, a touch behind when open.
    //    translateX keeps the visible device centered as it opens.
    if (halfLeft) {
      var z = -(2 + 7 * (1 - t));
      put(halfLeft, "transform",
        "rotateY(" + phi.toFixed(2) + "deg) translateZ(" + z.toFixed(1) + "px)");
    }
    if (device3d) {
      // -4deg hero yaw matches the reference pose; the device banks a
      // couple of degrees into a fast swing for physical weight.
      put(device3d, "transform",
        "translateX(" + (-125 * (1 - t)).toFixed(1) + "px) rotateX(4deg) rotateY(" +
        (-4 + motion * lastDir * 2.2).toFixed(2) + "deg)");
    }

    // 2) Cover display dims and defocuses out through the handoff.
    if (uiCover) {
      if (w >= 0.995) {
        setVis(uiCover, false);
        put(uiCover, "opacity", "0");
        put(uiCover, "filter", "none");
      } else {
        setVis(uiCover, true);
        put(uiCover, "opacity", (1 - w).toFixed(3));
        put(uiCover, "filter",
          "brightness(" + (1 - 0.55 * w).toFixed(3) + ") blur(" + q(4.5 * s + mBlur * 0.8) + "px)");
      }
    }
    if (offCover) {
      put(offCover, "opacity", w.toFixed(3));
      setVis(offCover, w > 0.005 && w < 0.995);
    }
    setVeil(bvEdgeC, Math.min(1, s * 1.05 + motion * 0.5));
    setVeil(bvMidC, s * 0.7);

    // 3) Main display wakes up. The moving half (left) defocuses hardest —
    //    the panel you are leaving reads blurred while the revealed half
    //    stays crisp, like the hero render. Content also compresses gently
    //    toward the crease, the way pixels read through bending glass.
    if (uiMainLeft) {
      if (w <= 0.005) {
        setVis(uiMainLeft, false);
        put(uiMainLeft, "opacity", "0");
        put(uiMainLeft, "filter", "none");
      } else {
        setVis(uiMainLeft, true);
        put(uiMainLeft, "opacity", w.toFixed(3));
        put(uiMainLeft, "filter",
          "blur(" + q(6.5 * s + mBlur) + "px) brightness(" + (1 - 0.3 * s).toFixed(3) + ") saturate(" + (1 - 0.3 * s).toFixed(3) + ")");
        put(uiMainLeft, "transform",
          "scale(" + (1 + 0.058 * s).toFixed(4) + ") scaleX(" + (1 - 0.058 * s).toFixed(4) + ")");
      }
    }
    if (uiMainRight) {
      if (w <= 0.005) {
        setVis(uiMainRight, false);
        put(uiMainRight, "opacity", "0");
        put(uiMainRight, "filter", "none");
      } else {
        setVis(uiMainRight, true);
        put(uiMainRight, "opacity", w.toFixed(3));
        put(uiMainRight, "filter",
          "blur(" + q(2.5 * s + mBlur * 0.6) + "px) brightness(" + (1 - 0.12 * s).toFixed(3) + ") saturate(" + (1 - 0.2 * s).toFixed(3) + ")");
        put(uiMainRight, "transform",
          "scale(" + (1 + 0.058 * s).toFixed(4) + ") scaleX(" + (1 - 0.058 * s).toFixed(4) + ")");
      }
    }
    // Idle fast-path: outside the bend there is nothing to defocus.
    if (s < 0.02 && motion < 0.02) {
      if (w > 0.005) {
        put(uiMainLeft, "filter", "none");
        put(uiMainRight, "filter", "none");
      }
      if (w < 0.995) put(uiCover, "filter", "none");
    }
    put(offLeft, "opacity", (1 - w).toFixed(3));
    put(offRight, "opacity", (1 - w).toFixed(3));
    setVis(offLeft, w < 0.995);
    setVis(offRight, w < 0.995);
    setVeil(bvEdgeL, Math.min(1, s * 1.15 + motion * 0.55));
    setVeil(bvMidL, s * 0.8);
    setVeil(bvEdgeR, Math.min(1, s * 0.85 + motion * 0.4));
    setVeil(bvMidR, s * 0.55);

    // 4) Diagonal light sweep rides across both inner faces mid-handoff
    //    (transform-positioned — animating `left` would layout-thrash)
    var sweepX = (-135 + w * 430).toFixed(1);
    var sweepOp = Math.min(1, s * 0.9 + motion * 0.3);
    [sweepLeft, sweepRight].forEach(function (el) {
      if (!el) return;
      put(el, "opacity", sweepOp.toFixed(3));
      put(el, "transform", "translateX(" + sweepX + "px) skewX(-18deg)");
      setVis(el, sweepOp > 0.02);
    });

    // 5) The tilting half casts a deepening shadow onto the fixed half
    //    (reach grows via scaleX — never via width)
    if (castShadowR) {
      var cast = clamp01((phi - 6) / 150);
      put(castShadowR, "opacity", (cast * 0.55).toFixed(3));
      put(castShadowR, "transform", "scaleX(" + (0.55 + 1.15 * cast).toFixed(3) + ")");
      setVis(castShadowR, cast > 0.02);
    }

    // 6) Hinge barrel shows mid-fold; ambient glow widens as the device opens
    if (hingeCore) {
      var hOp = Math.sin(Math.PI * clamp01((deg - 15) / 150)) * 0.9;
      put(hingeCore, "opacity", hOp.toFixed(3));
      setVis(hingeCore, hOp > 0.02);
    }
    if (deviceShadow) {
      put(deviceShadow, "transform", "scaleX(" + (0.6 + 0.4 * t).toFixed(3) + ")");
      put(deviceShadow, "opacity", (0.45 + 0.55 * t).toFixed(3));
    }

    // Readout
    if (angleVal) {
      var av = String(Math.round(deg));
      if (angleVal.textContent !== av) angleVal.textContent = av;
    }
    if (foldLabel) {
      var lbl =
        t < 0.05 ? T("demo.state.closed", "Closed · cover screen") :
        t > 0.95 ? T("demo.state.open", "Open · main display") :
        T("demo.state.fold", "Folding…");
      if (foldLabel.textContent !== lbl) foldLabel.textContent = lbl;
    }
  }

  /* --- Input -> fold: gesture speed feeds the smear, which settles after --- */
  function setFold(deg, fromAutopilot) {
    var now = performance.now();
    if (lastDeg !== null && now > lastMove) {
      var dt = Math.min(100, Math.max(4, now - lastMove));
      var degPerSec = Math.abs(deg - lastDeg) / dt * 1000;
      var target = Math.min(1, degPerSec / 260);
      motion += (target - motion) * (target > motion ? 0.4 : 0.07);
    }
    if (lastDeg !== null && deg !== lastDeg) lastDir = deg > lastDeg ? 1 : -1;
    lastDeg = deg;
    lastMove = now;

    applyFold(deg);

    // Haptic tick: once per gesture, at the midpoint
    var t = clamp01(deg / 180);
    if ((prevT < 0.5 && t >= 0.5) || (prevT > 0.5 && t <= 0.5)) {
      if (!tickFired) {
        fireHaptic();
        tickFired = true;
      }
    }
    if (t < 0.12 || t > 0.88) tickFired = false; // reset for the next gesture
    prevT = t;

    if (!fromAutopilot) setAuto(false);
    scheduleSettle();
  }

  /* After the gesture stops, let the velocity smear decay so the panels
     end up perfectly crisp at rest — like a real display stopping. */
  function scheduleSettle() {
    if (settling) return;
    settling = true;
    requestAnimationFrame(settleStep);
  }

  function settleStep() {
    if (motion <= 0.015) {
      if (motion !== 0) {
        motion = 0;
        if (lastDeg !== null) applyFold(lastDeg);
      }
      settling = false;
      return;
    }
    if (performance.now() - lastMove < 50) {
      // input still active — hold the smear level and keep the loop alive
      requestAnimationFrame(settleStep);
      return;
    }
    motion *= 0.86;
    if (lastDeg !== null) applyFold(lastDeg);
    requestAnimationFrame(settleStep);
  }

  /* --- Responsive scaling: keep the fully-open device inside its column --- */

  function fitPhone() {
    if (!foldScene || !foldScaler) return;
    var available = foldScene.parentElement ? foldScene.parentElement.clientWidth : 560;
    var scale = Math.min(1, (available - 16) / 560);
    foldScaler.style.setProperty("--scale", String(scale));
    foldScene.style.height = Math.round(600 * scale) + "px";
  }
  window.addEventListener("resize", fitPhone);

  /* --- Autopilot: open, hold, close, hold — loops until the user takes over --- */

  var auto = false;
  var rafId = null;

  function easeInOutCubic(u) {
    return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
  }

  function autoLoop(startTime) {
    if (!auto) return;
    var OPEN_MS = 2100, HOLD_A = 1100, CLOSE_MS = 2100, HOLD_B = 1500;
    var cycle = OPEN_MS + HOLD_A + CLOSE_MS + HOLD_B;
    var elapsed = (performance.now() - startTime) % cycle;

    var deg;
    if (elapsed < OPEN_MS) deg = 180 * easeInOutCubic(elapsed / OPEN_MS);
    else if (elapsed < OPEN_MS + HOLD_A) deg = 180;
    else if (elapsed < OPEN_MS + HOLD_A + CLOSE_MS) deg = 180 * (1 - easeInOutCubic((elapsed - OPEN_MS - HOLD_A) / CLOSE_MS));
    else deg = 0;

    setFold(deg, true);

    if (auto) {
      if (slider) slider.value = String(Math.round(deg));
      rafId = requestAnimationFrame(function () { autoLoop(startTime); });
    }
  }

  function setAuto(on) {
    auto = on;
    if (autoBtn) {
      autoBtn.setAttribute("aria-pressed", on ? "true" : "false");
      if (autoBtnLabel) autoBtnLabel.textContent = on ? T("demo.stop", "Stop demo") : T("demo.auto", "Auto demo");
    }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (on) {
      // Start the cycle from wherever we are: snap to closed first
      setFold(0, true);
      if (slider) slider.value = "0";
      rafId = requestAnimationFrame(function () { autoLoop(performance.now()); });
    }
  }

  if (autoBtn) autoBtn.addEventListener("click", function () { setAuto(!auto); });

  ["pointerdown", "touchstart", "input"].forEach(function (evt) {
    slider.addEventListener(evt, function () { setAuto(false); });
  });
  slider.addEventListener("input", function () {
    queueInputDeg(parseFloat(slider.value, 10));
  });

  /* --- Drag-to-fold: grab the device itself and move it like a real hinge.
     Horizontal pointer travel maps onto the fold angle (drag toward the
     opening edge to open, back to close); gesture speed feeds the same
     motion-smear pipeline as the slider. The range input stays in sync. --- */

  var DRAG_SENS = 0.35; // fold degrees per pixel of horizontal travel
  var dragging = false;
  var dragPointer = null;
  var dragStartX = 0;
  var dragStartDeg = 0;

  function onDragDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging = true;
    dragPointer = e.pointerId;
    dragStartX = e.clientX;
    dragStartDeg = lastDeg === null ? 0 : lastDeg;
    setAuto(false);
    foldScene.classList.add("dragging");
    try { foldScene.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }

  /* Input events can fire several times per frame — coalesce them so the
     fold pipeline runs at most once per animation frame. */
  var pendingDeg = null;
  var inputRaf = 0;
  function queueInputDeg(deg) {
    pendingDeg = deg;
    if (!inputRaf) {
      inputRaf = requestAnimationFrame(function () {
        inputRaf = 0;
        if (pendingDeg !== null) {
          setFold(pendingDeg, false);
          pendingDeg = null;
        }
      });
    }
  }

  function onDragMove(e) {
    if (!dragging || e.pointerId !== dragPointer) return;
    var dx = e.clientX - dragStartX;
    var deg = dragStartDeg - dx * DRAG_SENS; // drag left = open, like pulling the cover
    if (deg < 0) deg = 0; else if (deg > 180) deg = 180;
    queueInputDeg(deg);
    if (slider) slider.value = String(Math.round(deg));
  }

  function onDragUp(e) {
    if (!dragging || e.pointerId !== dragPointer) return;
    dragging = false;
    dragPointer = null;
    foldScene.classList.remove("dragging");
  }

  foldScene.addEventListener("pointerdown", onDragDown);
  foldScene.addEventListener("pointermove", onDragMove);
  foldScene.addEventListener("pointerup", onDragUp);
  foldScene.addEventListener("pointercancel", onDragUp);

  // Initialize
  fitPhone();
  setFold(0);

  /* Re-render demo labels + state when the site language changes */
  if (window.FXLang && window.FXLang.onChange) {
    window.FXLang.onChange(function () {
      if (lastDeg !== null) applyFold(lastDeg);
      if (autoBtnLabel) autoBtnLabel.textContent = auto ? T("demo.stop", "Stop demo") : T("demo.auto", "Auto demo");
    });
  }

  // Autostart the demo once the page settles (unless the user prefers reduced motion)
  if (!reduceMotion) {
    window.setTimeout(function () {
      var demo = document.getElementById("demo");
      if (demo) {
        var rect = demo.getBoundingClientRect();
        var visible = rect.top < window.innerHeight && rect.bottom > 0;
        if (visible || window.scrollY < 200) setAuto(true);
      }
    }, 700);
  }
})();
