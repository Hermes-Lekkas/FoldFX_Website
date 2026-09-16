/* ==========================================================================
   FoldFX website — cookie consent gate
   --------------------------------------------------------------------------
   WHAT THIS DOES
   - First visit: a small banner at the bottom asks the visitor to accept
     or decline anonymous analytics. Nothing is measured before a choice.
   - The choice is stored ONLY in this browser (localStorage key
     "foldfx-consent" = "granted" | "denied") — it is not sent anywhere.
   - "Cookie settings" buttons in the footer of every page reopen the
     banner, so the choice can be changed at any time.
   - Google Consent Mode v2 defaults are pushed to "denied" here, BEFORE
     any analytics script can possibly load — analytics stays blocked
     until (and unless) the visitor accepts.
   - js/analytics.js listens for the "fx-consent" event and only ever
     boots after "granted".

   NO THIRD-PARTY CODE IS LOADED BY THIS FILE. The banner is plain,
   dependency-free DOM; it is translated by the site's own i18n engine
   (the nodes carry data-i18n attributes with English text as fallback).
   ========================================================================== */

(function (g, d) {
  "use strict";

  var KEY = "foldfx-consent";

  /* ---------- storage helpers (never throw) ---------- */

  function get() {
    try { return g.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function set(v) {
    try { g.localStorage.setItem(KEY, v); } catch (e) { /* storage unavailable */ }
  }

  /* ---------- Google Consent Mode v2: default everything to denied.
     This is pushed before gtag.js can ever load (js/analytics.js only
     injects it after acceptance), so nothing can measure before consent. */

  g.dataLayer = g.dataLayer || [];
  if (typeof g.gtag !== "function") {
    g.gtag = function () { g.dataLayer.push(arguments); };
  }
  g.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500
  });

  /* ---------- banner UI ---------- */

  var banner = null;

  function build() {
    banner = d.createElement("div");
    banner.className = "consent";
    banner.id = "consentBanner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Cookies and analytics");
    banner.setAttribute("data-i18n-attr", "aria-label:cons.title");
    banner.hidden = true;

    var card = d.createElement("div");
    card.className = "consent-card";

    var title = d.createElement("p");
    title.className = "consent-title";
    title.setAttribute("data-i18n", "cons.title");
    title.textContent = "Cookies & analytics — your choice";

    var body = d.createElement("p");
    body.className = "consent-body";
    body.setAttribute("data-i18n", "cons.body");
    body.textContent = "FoldFX sets no tracking cookies by default and shows no ads. If you accept, the site counts visits anonymously and measures which pages and buttons are used, so FoldFX can improve. If you decline, nothing is measured — the site simply works. Your choice is stored only in this browser and can be changed anytime via \u201cCookie settings\u201d in the footer.";

    var actions = d.createElement("div");
    actions.className = "consent-actions";

    var accept = d.createElement("button");
    accept.type = "button";
    accept.className = "consent-btn consent-accept";
    accept.setAttribute("data-i18n", "cons.accept");
    accept.textContent = "Accept";
    accept.addEventListener("click", function () { choose("granted"); });

    var decline = d.createElement("button");
    decline.type = "button";
    decline.className = "consent-btn consent-decline";
    decline.setAttribute("data-i18n", "cons.decline");
    decline.textContent = "Decline";
    decline.addEventListener("click", function () { choose("denied"); });

    var privacy = d.createElement("a");
    privacy.className = "consent-privacy";
    privacy.href = "privacy.html";
    privacy.setAttribute("data-i18n", "cons.privacy");
    privacy.textContent = "Privacy policy";

    actions.appendChild(accept);
    actions.appendChild(decline);
    actions.appendChild(privacy);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(actions);
    banner.appendChild(card);
    d.body.appendChild(banner);
    /* the banner may be built after the i18n engine already applied the
       dictionary (first non-English visit) — translate it right now too */
    try {
      if (g.FXLang && typeof g.FXLang.apply === "function") g.FXLang.apply(banner);
    } catch (e) { /* i18n unavailable — English fallback stays */ }
  }

  function show() {
    if (!banner) build();
    if (!banner.hidden) return;
    banner.hidden = false;
    /* next frame: slide up (skipped for reduced-motion users via CSS) */
    g.requestAnimationFrame(function () {
      g.requestAnimationFrame(function () { banner.classList.add("on"); });
    });
  }

  function hide() {
    if (!banner) return;
    banner.classList.remove("on");
    g.setTimeout(function () { if (banner) banner.hidden = true; }, 350);
  }

  function choose(status) {
    set(status);
    hide();
    try {
      g.dispatchEvent(new g.CustomEvent("fx-consent", { detail: { status: status } }));
    } catch (e) { /* very old browsers: analytics will simply not boot */ }
  }

  /* footer "Cookie settings" buttons (any page) reopen the banner */
  d.addEventListener("click", function (e) {
    var el = e.target && e.target.closest ? e.target.closest("#consentSettings") : null;
    if (el) show();
  });

  /* ---------- public API + first-visit prompt ---------- */

  g.FXConsent = {
    get: get,
    open: function () { show(); }
  };

  function init() {
    if (!get()) {
      /* small delay so the page settles before the banner slides in */
      g.setTimeout(show, 600);
    }
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : globalThis, document);
