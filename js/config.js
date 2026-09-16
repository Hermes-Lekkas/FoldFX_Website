/* ==========================================================================
   FoldFX website — site configuration
   --------------------------------------------------------------------------
   NOTIFY-ME FORM: what happens when a visitor signs up
   ----------------------------------------------------
   The visitor types their email and taps "Notify me". With the default
   settings below, ONE-CLICK delivery is already wired up — no account,
   no API key, no build step:

     1. The form posts the signup to FormSubmit.co, a free form-delivery
        service, which emails it to notifyEmail (FoldFX@protonmail.com).
     2. Each signup email states the running opt-in count (the waitlist
        number) in its subject line and body, e.g.:
            Subject: FoldFX launch opt-in #12 — 12 on the waitlist
     3. The count comes from a tiny free counter API (Abacus — no account,
        no personal data, the visitor's email is never sent to it).
     4. The visitor instantly receives an automatic confirmation email
        ("You're on the list!") from the same delivery service.
     5. If the delivery service or the counter is unreachable, the form
        falls back to opening the visitor's own email app with a
        pre-filled signup message to notifyEmail — the flow never
        dead-ends.

   ONE-TIME ACTIVATION (already triggered — just click the link):
     The very first submission sends an "Activate Form" email from
     FormSubmit to notifyEmail. Click the activation link once and every
     future signup lands in that inbox automatically. Until you click it,
     the form still works for visitors via the email-app fallback.

   AT LAUNCH — notifying everyone who opted in:
     Every signup email arrives at notifyEmail with its Reply-To set to
     that subscriber's address. To notify the whole waitlist when FoldFX
     launches: open the opt-in emails in your inbox and reply (most mail
     apps can select several emails at once and reply to all). One email
     per subscriber = your full, self-maintained list; the opt-in number
     in each subject tells you how many users are currently opted in.

   OPTIONAL OVERRIDES (js/notify.js consumes everything in FOLDFX):
     - notifyEndpoint: paste a Formspree / Web3Forms / Google Apps Script
       URL here to bypass FormSubmit entirely (any endpoint that answers
       2xx to a JSON POST works).
     - notifyMode: "" switches the form to the pure email-app handoff
       (no third-party request at all).
     - counterURL: the Abacus hit URL used for the waitlist count
       (https://abacus.jasoncameron.dev). Remove the value to send
       signups without a count.
   ========================================================================== */

window.FOLDFX = {
  /* Where signup emails are delivered — this is "me" for the notify flow. */
  notifyEmail: "FoldFX@protonmail.com",

  /* "auto" = one-click FormSubmit delivery to notifyEmail (default),
     with automatic fallback to the visitor's email app on any failure.
     ""    = always use the visitor's email app (zero third-party calls).
     A custom endpoint below always takes precedence over both. */
  notifyMode: "auto",

  /* Optional: explicit endpoint override (Formspree / Web3Forms /
     Apps Script / your own API). Empty = use the mode above. */
  notifyEndpoint: "",

  /* Optional: extra payload fields, e.g. a Web3Forms access key. */
  notifyKey: "",

  /* Free waitlist counter (no account, no personal data — returns the
     running opt-in number as {"value": N}). Empty string disables the
     count and signups are emailed without it. */
  counterURL: "https://abacus.jasoncameron.dev/hit/foldfx-launch/optins-v1",

  /* ---- VISITOR ANALYTICS (strictly opt-in, behind the cookie banner) ----
     Nothing below runs unless the visitor taps "Accept" on the banner.

     ga4Id: paste your Google Analytics 4 Measurement ID (looks like
       "G-XXXXXXXXXX") to unlock the full behaviour dashboard: visitors,
       pageviews, scroll depth, which sections/buttons are used, languages,
       realtime view… Create the free property at analytics.google.com
       (Admin → Data streams → Web). Leave "" to run without GA4.

     visitCounterURL / consentCounterURL: anonymous, cookieless Abacus
       counters (same free service as the waitlist count — no account,
       no personal data). Visits are counted once per browser per ~20h;
       consents once per browser ever. Check them privately any time:

       TOTAL VISITS   https://abacus.jasoncameron.dev/get/foldfx-launch/visits-v1
       ACCEPTANCES    https://abacus.jasoncameron.dev/get/foldfx-launch/consents-v1

       (visits vs acceptances ≈ your banner opt-in rate) */
  ga4Id: "G-P1X62QWES2",
  visitCounterURL: "https://abacus.jasoncameron.dev/hit/foldfx-launch/visits-v1",
  consentCounterURL: "https://abacus.jasoncameron.dev/hit/foldfx-launch/consents-v1"
};
