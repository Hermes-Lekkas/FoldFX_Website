/* ==========================================================================
   FoldFX beta gate — email verification before the APK download unlocks
   ---------------------------------------------------------------------------
   Flow (beta.html):
   1. Visitor enters an email and submits.
   2. The email is normalized (trim + lowercase) and hashed with SHA-256
      via the Web Crypto API (requires HTTPS — GitHub Pages always is).
   3. The hash is compared against js/beta-allowlist.js (the developer's
      hand-approved tester list).
      - Match    -> the download section unlocks immediately.
      - No match -> the request is emailed to the developer via FormSubmit
                    (same delivery as the launch waitlist), and the visitor
                    is told to come back once approved.
   4. Access is re-verified on every visit — revoking a hash in the
      allowlist re-locks the download. Nothing is cached beyond the email
      prefill for convenience.

   Privacy: the only network call is the FormSubmit request for NOT-yet-
   approved visitors (the email goes to foldfx.contact@gmail.com, exactly like
   the waitlist form). Approved visitors trigger no request at all.
   ========================================================================== */

(function (w, d) {
  "use strict";

  var cfg = w.FOLDFX || {};
  var EMAIL = String(cfg.notifyEmail || "foldfx.contact@gmail.com");
  var FORMSUBMIT = "https://formsubmit.co/ajax/";
  var PREFILL_KEY = "foldfx-beta-email";
  var TIMEOUT_MS = 12000;

  var form, input, btn, msg, gateSec, dlSec, approvedBadge;

  function t(key) {
    return (w.FXLang && w.FXLang.t(key)) || "";
  }

  function lang() {
    return (w.FXLang && w.FXLang.get) ? w.FXLang.get() : "en";
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
  }

  function normalize(v) {
    return String(v || "").trim().toLowerCase();
  }

  /* SHA-256 hex of the normalized email via Web Crypto; null when the
     secure context is missing (plain HTTP etc.). */
  function sha256Hex(text) {
    if (!(w.crypto && w.crypto.subtle && w.TextEncoder)) return Promise.resolve(null);
    var data = new w.TextEncoder().encode(text);
    return w.crypto.subtle.digest("SHA-256", data).then(function (buf) {
      var bytes = new Uint8Array(buf), hex = "", i;
      for (i = 0; i < bytes.length; i++) hex += ("0" + bytes[i].toString(16)).slice(-2);
      return hex;
    });
  }

  /* ---------- UI states ---------- */

  function setMsg(key, isErr) {
    if (!msg) return;
    if (!key) {
      msg.textContent = "";
      msg.hidden = true;
      msg.classList.remove("is-err");
      return;
    }
    msg.classList.toggle("is-err", !!isErr);
    msg.hidden = false;
    msg.textContent = t(key);
  }

  function busy(on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle("is-busy", !!on);
  }

  function showApproved() {
    if (gateSec) gateSec.hidden = true;
    if (dlSec) dlSec.hidden = false;
    if (approvedBadge) approvedBadge.hidden = false;
    /* Re-run the APK availability probe now that the card is visible. */
    if (w.FXBetaProbe) w.FXBetaProbe();
  }

  function showPending() {
    if (gateSec) gateSec.hidden = true;
    if (dlSec) dlSec.hidden = true;
    var p = d.getElementById("betaPending");
    if (p) p.hidden = false;
  }

  /* ---------- FormSubmit request (NOT-yet-approved visitors only) ---------- */

  function sendRequest(email) {
    var endpoint = FORMSUBMIT + encodeURIComponent(EMAIL);
    var payload = {
      email: email,
      _replyto: email,
      _subject: "FoldFX beta access request",
      _template: "table",
      _captcha: "false",
      _autoresponse: t("beta.autoresponder"),
      requested_at: new Date().toISOString(),
      language: lang(),
      source: "beta-page"
    };
    var ctrl = ("AbortController" in w) ? new w.AbortController() : null;
    var opts = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload)
    };
    if (ctrl) {
      opts.signal = ctrl.signal;
      w.setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    }
    /* Best-effort: even if the notification fails to send, the visitor gets
       an honest "request received / under review" state — approval (the
       allowlist) is the real gate, not the email. */
    return w.fetch(endpoint, opts)
      .then(function () { return true; })
      .catch(function () { return false; });
  }

  /* ---------- main check ---------- */

  function check(email) {
    busy(true);
    setMsg("");
    sha256Hex(email).then(function (hash) {
      if (!hash) {
        busy(false);
        setMsg("beta.gate.err.hash", true);
        return;
      }
      var allowed = w.FX_BETA_ALLOWED || [];
      var ok = false, i;
      for (i = 0; i < allowed.length; i++) {
        if (String(allowed[i]).trim().toLowerCase() === hash) { ok = true; break; }
      }
      if (ok) {
        busy(false);
        showApproved();
        return;
      }
      sendRequest(email).then(function () {
        busy(false);
        showPending();
      });
    }).catch(function () {
      busy(false);
      setMsg("beta.gate.err.generic", true);
    });
  }

  /* ---------- wiring ---------- */

  function init() {
    form = d.getElementById("betaGateForm");
    if (!form) return;
    input = d.getElementById("betaGateEmail");
    btn = d.getElementById("betaGateBtn");
    msg = d.getElementById("betaGateMsg");
    gateSec = d.getElementById("betaGate");
    dlSec = d.getElementById("betaDownload");
    approvedBadge = d.getElementById("betaApprovedBadge");

    /* Convenience prefill only — never a granted-access cache. */
    try {
      if (input && localStorage.getItem(PREFILL_KEY)) {
        input.value = localStorage.getItem(PREFILL_KEY);
      }
    } catch (e) { /* private mode etc. */ }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = normalize(input && input.value);
      if (!validEmail(email)) {
        setMsg("beta.gate.err.email", true);
        return;
      }
      try { localStorage.setItem(PREFILL_KEY, email); } catch (e) {}
      check(email);
    });
  }

  if (d.readyState === "loading") {
    d.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(window, document);
