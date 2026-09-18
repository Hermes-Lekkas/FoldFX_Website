/* ==========================================================================
   FoldFX thank-you page — license key checker
   ---------------------------------------------------------------------------
   WHAT THIS DOES
   - A buyer pastes the license key from their Polar receipt; the page asks
     Polar's public customer-portal endpoint whether that key is live,
     and answers with a clear yes / no — before the buyer even installs
     the app. It exists to catch the #1 support case: pasting the invoice
     number instead of the license key.

   SECURITY / PRIVACY MODEL (deliberate, mirrors the Android app)
   - Endpoint: POST https://api.polar.sh/v1/customer-portal/license-keys/validate
     Polar documents this route for public client use (the same one the
     FoldFX app calls): NO secret, NO account, nothing to leak.
   - The organization id below is public by design (it is also compiled
     into the app). It only scopes the lookup to FoldFX keys.
   - Request body: { key, organization_id } — the key the visitor just
     typed and a public id. The response carries no personal data
     (status + display key only), so nothing sensitive is exposed to the
     browser. Invalid keys simply return 404 Not found.
   - The submitted key is never logged, stored or sent anywhere else.

   FAILURE BEHAVIOUR
   - Polar unreachable / 5xx / timeout -> honest "try again later" note.
     A failed check NEVER blocks the download below: the real gate is the
     in-app activation, this widget is a convenience for the buyer.
   ========================================================================== */

(function (w, d) {
  "use strict";

  var cfg = w.FOLDFX || {};
  var ORG = String(cfg.polarOrgId || "");
  var ENDPOINT = "https://api.polar.sh/v1/customer-portal/license-keys/validate";
  var TIMEOUT_MS = 12000;

  var form, input, btn, msg;

  function t(key) {
    return (w.FXLang && w.FXLang.t(key)) || "";
  }

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
    if (on) setMsg("ty.verify.wait", false);
  }

  /* ---------- the check ---------- */

  function check(key) {
    if (!ORG) {
      setMsg("ty.verify.err", true);
      return;
    }
    busy(true);

    var ctrl = ("AbortController" in w) ? new w.AbortController() : null;
    var opts = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ key: key, organization_id: ORG })
    };
    if (ctrl) {
      opts.signal = ctrl.signal;
      w.setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, TIMEOUT_MS);
    }

    w.fetch(ENDPOINT, opts)
      .then(function (r) {
        busy(false);
        if (r.ok) {
          /* 2xx: Polar tells us the key's status in the JSON body. */
          r.json().then(function (data) {
            var status = data && typeof data.status === "string" ? data.status : "";
            if (status === "revoked" || status === "disabled") setMsg("ty.verify.revoked", true);
            else setMsg("ty.verify.ok", false);
          }).catch(function () { setMsg("ty.verify.ok", false); });
        } else if (r.status === 404) {
          setMsg("ty.verify.bad", true);      /* unknown key */
        } else if (r.status === 429) {
          setMsg("ty.verify.err", true);      /* rate-limited — try again later */
        } else {
          setMsg("ty.verify.err", true);
        }
      })
      .catch(function () {
        busy(false);
        setMsg("ty.verify.err", true);        /* network/timeout */
      });
  }

  /* ---------- wiring ---------- */

  function init() {
    form = d.getElementById("tyVerifyForm");
    if (!form) return;
    input = d.getElementById("tyKeyInput");
    btn = d.getElementById("tyVerifyBtn") || form.querySelector("button[type=submit]");
    msg = d.getElementById("tyVerifyMsg");

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var key = String(input && input.value || "").trim();
      if (key.length < 8) {
        setMsg("ty.verify.short", true);
        return;
      }
      check(key);
    });
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();
})(window, document);
