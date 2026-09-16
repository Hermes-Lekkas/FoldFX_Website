/* ==========================================================================
   FoldFX website — opt-in visitor analytics
   --------------------------------------------------------------------------
   RULES
   - NOTHING runs unless the visitor accepted the cookie banner
     (js/consent.js, localStorage "foldfx-consent" = "granted").
   - With js/config.js ga4Id empty, only the anonymous, cookieless Abacus
     visit counters run (counted once per browser per ~20h) — useful raw
     numbers with zero setup. Paste a GA4 Measurement ID ("G-…") into
     config.js to unlock the full behaviour dashboard as well.
   - Behaviour events sent to GA4 (only after acceptance):
       page_view      automatic (GA4 config)
       section_view   which page sections were actually seen (35% visible)
       scroll_depth   25 / 50 / 75 / 100 % of the page
       cta_click      taps on elements carrying data-analytics="…"
       demo_use       live fold demo interactions (slider / autopilot)
       notify_submit  launch-notification form attempts
       beta_download  beta APK download taps (beta page)
       lang_change    which language a visitor switched to
   - Every call is wrapped so analytics can never break the site.

   OWNER QUICK CHECK (no account needed)
     Total visits (past ~24h deduped):
       https://abacus.jasoncameron.dev/get/foldfx-launch/visits-v1
     Total banner acceptances:
       https://abacus.jasoncameron.dev/get/foldfx-launch/consents-v1
   ========================================================================== */

(function (g, d) {
  "use strict";

  var CFG = g.FOLDFX || {};
  var GA = (typeof CFG.ga4Id === "string" && /^G-[A-Z0-9]{6,12}$/.test(CFG.ga4Id)) ? CFG.ga4Id : "";
  var booted = false;

  /* ---------- tiny helpers ---------- */

  function status() {
    if (g.FXConsent && typeof g.FXConsent.get === "function") return g.FXConsent.get();
    try { return g.localStorage.getItem("foldfx-consent"); } catch (e) { return null; }
  }

  /* fire a GA4 event if (and only if) gtag is loaded */
  function ev(name, params) {
    if (booted && GA && typeof g.gtag === "function") {
      try { g.gtag("event", name, params || {}); } catch (e) { /* never break the page */ }
    }
  }

  /* best-effort fire-and-forget counter ping (Abacus, CORS-enabled) */
  function ping(url) {
    if (!url) return;
    try {
      var done = false;
      var x = new g.XMLHttpRequest();
      x.open("GET", url, true);
      x.timeout = 3500;
      x.onreadystatechange = function () {
        if (!done && x.readyState >= 2) { done = true; try { x.abort(); } catch (e) { /* done */ } }
      };
      try { x.send(null); } catch (e) { /* network unavailable */ }
    } catch (e) { /* analytics must never throw */ }
  }

  /* run fn at most once per browser session (per tab) */
  function oncePerSession(key, fn) {
    try {
      if (g.sessionStorage.getItem(key)) return;
      g.sessionStorage.setItem(key, "1");
    } catch (e) { /* storage blocked — fall through, still fire */ }
    fn();
  }

  /* ---------- GA4 loader (Consent Mode v2 aware) ---------- */

  function loadGA4() {
    if (!GA) return;
    g.dataLayer = g.dataLayer || [];
    if (typeof g.gtag !== "function") {
      g.gtag = function () { g.dataLayer.push(arguments); };
    }
    g.gtag("consent", "update", { analytics_storage: "granted" });
    var s = d.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA;
    d.head.appendChild(s);
    g.gtag("config", GA, { transport_type: "beacon" });
  }

  /* ---------- behaviour wiring (all consent-gated by boot) ---------- */

  function wireBehaviour() {
    /* scroll depth: 25 / 50 / 75 / 100 % */
    var marks = [25, 50, 75, 100];
    var ticking = false;
    g.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      g.setTimeout(function () {
        ticking = false;
        try {
          var doc = d.documentElement.scrollHeight - g.innerHeight;
          if (doc <= 0) return;
          var p = Math.round((g.pageYOffset / doc) * 100);
          for (var i = 0; i < marks.length; i++) {
            (function (m) {
              if (p >= m) oncePerSession("fx-sd-" + m, function () { ev("scroll_depth", { depth_percent: m }); });
            })(marks[i]);
          }
        } catch (e) { /* ignore */ }
      }, 250);
    }, { passive: true });

    /* section visibility */
    try {
      if ("IntersectionObserver" in g) {
        var io = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            var en = entries[i];
            if (!en.isIntersecting) continue;
            io.unobserve(en.target);
            (function (id) {
              if (!id) return;
              oncePerSession("fx-sec-" + id, function () { ev("section_view", { section_id: id }); });
            })(en.target.id);
          }
        }, { threshold: 0.35 });
        var secs = d.querySelectorAll("section[id]");
        for (var i = 0; i < secs.length; i++) io.observe(secs[i]);
      }
    } catch (e) { /* ignore */ }

    /* CTA taps: any element with data-analytics="…" */
    d.addEventListener("click", function (e) {
      try {
        var el = e.target && e.target.closest ? e.target.closest("[data-analytics]") : null;
        if (el) ev("cta_click", { cta_id: el.getAttribute("data-analytics") });
      } catch (err) { /* ignore */ }
    }, true);

    /* live fold demo */
    var angle = d.getElementById("angle");
    if (angle) {
      angle.addEventListener("input", function () {
        oncePerSession("fx-demo", function () { ev("demo_use", { action: "slider" }); });
      });
    }
    var auto = d.getElementById("autoBtn");
    if (auto) {
      auto.addEventListener("click", function () { ev("demo_use", { action: "autopilot" }); });
    }

    /* notify form attempt */
    var nf = d.getElementById("notifyForm");
    if (nf) nf.addEventListener("submit", function () { ev("notify_submit", {}); });

    /* beta APK download tap (beta page) — only when actually enabled */
    var dl = d.getElementById("betaDlBtn");
    if (dl) {
      dl.addEventListener("click", function () {
        if (dl.getAttribute("aria-disabled") !== "true") ev("beta_download", {});
      });
    }

    /* language switches */
    if (g.FXLang && typeof g.FXLang.onChange === "function") {
      g.FXLang.onChange(function (code) { ev("lang_change", { language: code }); });
    }
  }

  /* ---------- boot ---------- */

  function start() {
    if (booted) return;
    booted = true;

    /* anonymous visit counter — once per browser per ~20h.
       Skipped when storage is unavailable (conservative: never inflates). */
    try {
      var last = +g.localStorage.getItem("foldfx-vc-at") || 0;
      if (Date.now() - last > 20 * 3600 * 1000) {
        g.localStorage.setItem("foldfx-vc-at", String(Date.now()));
        ping(CFG.visitCounterURL);
      }
    } catch (e) { /* storage unavailable — skip counting */ }

    loadGA4();
    wireBehaviour();
  }

  /* boot immediately if consent was already granted (returning visitor) */
  if (status() === "granted") start();

  /* or boot the moment the visitor accepts */
  g.addEventListener("fx-consent", function (e) {
    if (!e || !e.detail || e.detail.status !== "granted") return;
    /* count the acceptance once per browser (owner opt-in rate metric) */
    try {
      if (!g.localStorage.getItem("foldfx-consent-counted")) {
        g.localStorage.setItem("foldfx-consent-counted", "1");
        ping(CFG.consentCounterURL);
      }
    } catch (err) { /* storage unavailable — skip */ }
    start();
  });
})(typeof window !== "undefined" ? window : globalThis, document);
