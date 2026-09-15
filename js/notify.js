/* ==========================================================================
   FoldFX website — "Notify me at launch" form
   --------------------------------------------------------------------------
   The visitor types their email and taps "Notify me". Delivery chain
   (configured in js/config.js — see it for the full guide):

     1. A free waitlist counter (Abacus, no personal data) is bumped to
        get the running opt-in number N.
     2. The signup is POSTed as JSON to the delivery endpoint — by default
        FormSubmit.co (one-click email to FoldFX@protonmail.com, subject
        states "… #N — N on the waitlist", subscriber gets an automatic
        confirmation). A confirmed signup is remembered in localStorage
        so returning visitors see their status instead of the form.
     3. If the endpoint fails for any reason (offline, blocked, provider
        hiccup), the form falls back to opening the visitor's own email
        app with a pre-filled signup message — plus an explicit
        "Open your email app" link in case the automatic handoff is
        blocked by the browser. The flow never dead-ends.

   Custom endpoints (Formspree / Web3Forms / Apps Script) receive
   { email, source, _subject, …extra }; script.google.com endpoints are
   auto-detected and POSTed text/plain + no-cors (the mode they require).
   ========================================================================== */

(function (w, d) {
  "use strict";

  var cfg = w.FOLDFX || {};
  var EMAIL = String(cfg.notifyEmail || "FoldFX@protonmail.com");
  var FORMSUBMIT = "https://formsubmit.co/ajax/";
  var COUNTER = String(cfg.counterURL || "").trim();
  var EXTRA = cfg.notifyKey ? { access_key: String(cfg.notifyKey) } : null;
  var STORE_KEY = "foldfx-notify";
  var TIMEOUT_MS = 12000;
  var COUNTER_TIMEOUT_MS = 3500;

  var ENDPOINT = (function () {
    var ep = String(cfg.notifyEndpoint || "").trim();
    if (ep) return ep;
    /* notifyMode "auto" = one-click FormSubmit delivery with the
       email-app fallback; "" = pure email-app handoff (no request). */
    return String(cfg.notifyMode || "") === "" ? "" : FORMSUBMIT + encodeURIComponent(EMAIL);
  })();

  var form, input, btn, btnLabel, msg, done, doneH, doneSub;
  var msgKey = "";   /* key currently rendered in the message line */
  var msgErr = false;
  var busy = false;
  var doneState = null; /* { h, sub, n, maillink } — re-rendered on language switch */

  function t(key) {
    return (w.FXLang && w.FXLang.t(key)) || "";
  }

  function lang() {
    return (w.FXLang && w.FXLang.get) ? w.FXLang.get() : "en";
  }

  /* ---------- message line ---------- */

  function setMsg(key, isErr) {
    msgKey = key || "";
    msgErr = !!isErr;
    if (!msg) return;
    if (!msgKey) {
      msg.textContent = "";
      msg.hidden = true;
      msg.classList.remove("is-err");
      return;
    }
    msg.classList.toggle("is-err", msgErr);
    msg.hidden = false;
    msg.textContent = "";
    msg.appendChild(d.createTextNode(t(msgKey)));
    /* a failed delivery must never dead-end: offer the direct mail path */
    if (msgErr && msgKey === "get.err.network" && EMAIL) {
      msg.appendChild(d.createTextNode(" "));
      var a = d.createElement("a");
      a.href = mailtoHref();
      a.textContent = t("get.err.alt");
      msg.appendChild(a);
    }
  }

  /* ---------- helpers ---------- */

  function mailtoHref() {
    return "mailto:" + EMAIL +
      "?subject=" + encodeURIComponent("FoldFX launch notification") +
      "&body=" + encodeURIComponent(t("get.notify"));
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
  }

  function bumpCounter() {
    if (!COUNTER) return Promise.resolve(null);
    var ctrl = ("AbortController" in w) ? new w.AbortController() : null;
    var opts = { method: "GET" };
    if (ctrl) {
      opts.signal = ctrl.signal;
      w.setTimeout(function () { ctrl.abort(); }, COUNTER_TIMEOUT_MS);
    }
    return w.fetch(COUNTER, opts).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (data) {
      var n = data && Number(data.value);
      return (isFinite(n) && n > 0) ? Math.floor(n) : null;
    }).catch(function () {
      return null; /* the count is best-effort; signup continues without it */
    });
  }

  function payload(email, n) {
    var p = {
      email: email,
      _replyto: email, /* the signup email is reply-ready for launch day */
      _subject: n ? ("FoldFX launch opt-in #" + n + " — " + n + " on the waitlist")
                  : "FoldFX launch opt-in",
      _template: "table",
      _captcha: "false",
      _autoresponse: t("get.autoresponder"),
      opt_in_number: n || "",
      total_opted_in: n || "",
      opted_in_at: new Date().toISOString(),
      language: lang(),
      source: "foldfx-website",
      _honey: ""
    };
    if (EXTRA) {
      for (var k in EXTRA) {
        if (Object.prototype.hasOwnProperty.call(EXTRA, k)) p[k] = EXTRA[k];
      }
    }
    return p;
  }

  function sendToEndpoint(email, n) {
    var opts = { method: "POST" };
    if (/script\.google\.com/.test(ENDPOINT)) {
      /* Apps Script: text/plain + no-cors avoids its CORS preflight */
      opts.mode = "no-cors";
      opts.headers = { "Content-Type": "text/plain;charset=utf-8" };
    } else {
      opts.headers = { "Content-Type": "application/json", "Accept": "application/json" };
    }
    opts.body = JSON.stringify(payload(email, n));

    var ctrl = ("AbortController" in w) ? new w.AbortController() : null;
    if (ctrl) {
      opts.signal = ctrl.signal;
      w.setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    }

    return w.fetch(ENDPOINT, opts).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      try { return res.json(); } catch (e) { return null; } /* opaque/empty bodies are fine */
    }).then(function (data) {
      /* surface provider-level soft failures (Formspree ok:false,
         Web3Forms success:false, FormSubmit success:"false" — the
         "needs activation" / challenge replies land here too) */
      if (data && typeof data.ok === "boolean" && !data.ok) throw new Error("refused");
      if (data && typeof data.success === "boolean" && !data.success) throw new Error("refused");
      if (data && typeof data.success === "string" && data.success === "false") throw new Error("refused");
      return data;
    });
  }

  /* ---------- state transitions ---------- */

  function setBusy(on) {
    busy = on;
    if (btn) {
      btn.disabled = on;
      if (on) btn.setAttribute("aria-busy", "true");
      else btn.removeAttribute("aria-busy");
    }
    if (btnLabel) btnLabel.textContent = on ? t("get.sending") : t("get.notify");
  }

  /* Central renderer for the success/status panel. Re-running it after a
     language switch keeps {n} filled and re-attaches the mail-app link
     (the i18n pass re-applies plain dictionary text and would otherwise
     wipe both). */
  function renderDone(state) {
    if (!done) return;
    doneState = state;
    if (form) form.hidden = true;
    var note = d.querySelector(".get-formnote");
    done.hidden = false;
    if (note) note.hidden = true;
    doneH.setAttribute("data-i18n", state.h);
    doneH.textContent = t(state.h);
    doneSub.setAttribute("data-i18n", state.sub);
    doneSub.textContent = "";
    var subTxt = t(state.sub);
    if (state.n != null) subTxt = subTxt.replace(/\{n\}/g, String(state.n));
    doneSub.appendChild(d.createTextNode(subTxt));
    if (state.maillink && EMAIL) {
      doneSub.appendChild(d.createElement("br"));
      var a = d.createElement("a");
      a.href = mailtoHref();
      a.className = "get-done-maillink";
      a.textContent = t("get.done.maillink");
      doneSub.appendChild(a);
    }
  }

  /* Last-resort path when one-click delivery fails: hand the signup to
     the visitor's own email app (pre-filled, addressed to the owner). */
  function fallbackHandoff() {
    try { w.location.href = mailtoHref(); } catch (err) {
      setMsg("get.err.network", true);
      return;
    }
    renderDone({ h: "get.done.mailh", sub: "get.done.mailp", n: null, maillink: true });
  }

  /* ---------- submit flow ---------- */

  function onSubmit(e) {
    e.preventDefault();
    if (busy) return;

    var v = input.value.trim();
    if (!validEmail(v)) {
      form.classList.remove("is-error");
      void form.offsetWidth; /* restart the shake animation */
      form.classList.add("is-error");
      input.setAttribute("aria-invalid", "true");
      setMsg("get.err.invalid", true);
      input.focus();
      return;
    }
    input.removeAttribute("aria-invalid");
    setMsg("", false);

    /* this browser already signed this address up — no second email */
    try {
      var saved = w.localStorage.getItem(STORE_KEY);
      if (saved && validEmail(saved) && saved.toLowerCase() === v.toLowerCase()) {
        renderDone({ h: "get.done.h", sub: "get.already", n: null, maillink: false });
        return;
      }
    } catch (err) { /* storage unavailable */ }

    setBusy(true);

    if (!ENDPOINT) {
      /* zero-request mode: open the visitor's email app pre-filled */
      w.setTimeout(function () { fallbackHandoff(); setBusy(false); }, 350);
      return;
    }

    bumpCounter().then(function (n) {
      return sendToEndpoint(v, n).then(function () {
        try { w.localStorage.setItem(STORE_KEY, v); } catch (err) { /* private mode */ }
        renderDone({ h: "get.done.h", sub: n ? "get.done.num" : "get.done.p", n: n, maillink: false });
      });
    }).catch(function () {
      /* one-click delivery unavailable — still get the signup through */
      fallbackHandoff();
    }).then(function () {
      setBusy(false);
    });
  }

  /* ---------- init ---------- */

  function init() {
    form = d.getElementById("notifyForm");
    if (!form) return;
    input = d.getElementById("notifyEmail");
    btn = form.querySelector(".get-submit");
    btnLabel = btn ? btn.querySelector("span[data-i18n='get.notify']") || btn.querySelector("span") : null;
    msg = d.getElementById("notifyMsg");
    done = d.getElementById("notifyDone");
    doneH = d.getElementById("notifyDoneH");
    doneSub = done ? done.querySelector(".get-done-txt span") : null;

    form.addEventListener("submit", onSubmit);
    input.addEventListener("input", function () {
      if (msgErr) {
        form.classList.remove("is-error");
        input.removeAttribute("aria-invalid");
        setMsg("", false);
      }
    });

    /* returning subscriber: show the stored status instead of the form */
    try {
      var saved = w.localStorage.getItem(STORE_KEY);
      if (saved && validEmail(saved)) renderDone({ h: "get.done.h", sub: "get.already", n: null, maillink: false });
    } catch (err) { /* storage unavailable */ }

    /* keep dynamic strings in sync with language switches */
    if (w.FXLang && w.FXLang.onChange) {
      w.FXLang.onChange(function () {
        if (msgKey && msg && !msg.hidden) setMsg(msgKey, msgErr);
        if (doneState && done && !done.hidden) renderDone(doneState);
      });
    }
  }

  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : globalThis, document);
