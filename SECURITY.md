# FoldFX website — security & payment flow

This document describes how the site, the payment flow and the license-key
system fit together, what is enforced where, and what the owner should keep
an eye on. It is written for the site owner, not for visitors.

---

## 1. The payment flow, start to finish

```
Visitor                       FoldFX website (static)              Polar (merchant of record)
  |                               |                                      |
  |-- click "Buy FoldFX — 4.99" ->|                                      |
  |                               |-- redirect to HTTPS checkout ------->|
  |                               |                                      |
  |------------------------------------------------------------------ pay (card / wallet)
  |                               |                                      |
  |                               |          receipt email + LICENSE KEY delivered by Polar
  |                               |                                      |
  |-- thank-you.html (Polar success URL)                                 |
  |       "what happens next" + on-page key checker                      |
  |                               |                                      |
  |-- paste key --> checker ---- POST /v1/customer-portal/license-keys/validate (public)
  |                               |                                      |
  |-- download signed APK (same build the beta serves)                   |
  |                               |                                      |
  |-- install app -> License screen -> activate -----------------------> activate (public endpoint)
  |                                      |         one key = one device, deactivate to move
```

Where each guarantee comes from:

| Guarantee                    | Enforced by                    | Notes |
|------------------------------|--------------------------------|-------|
| Card data safety (PCI)       | Polar                          | Card data never touches this site; checkout is hosted by Polar over HTTPS. |
| Payment integrity, refunds   | Polar                          | Polar is the merchant of record; taxes and refunds run through their dashboard. |
| License key issuance         | Polar (License Key benefit)    | Keys are delivered with the order receipt / "Access purchase" link. |
| Key validity, 1-device limit | The Android app + Polar API    | The app activates/validates/deactivates keys against Polar's public customer-portal endpoints; one activation per key, deactivate before moving devices. |
| APK integrity                | Release signing + checksums    | The APK is release-signed (v2 scheme) and `downloads/checksums.txt` publishes its SHA-256 so anyone can verify the file. |
| Site content integrity       | CSP + static hosting           | See section 3. |

## 2. The license-key checker (thank-you page)

`js/license-verify.js` lets a buyer paste their key and get a yes/no before
installing. Deliberate design decisions:

- **Endpoint**: `POST https://api.polar.sh/v1/customer-portal/license-keys/validate`
  — the same public, no-authentication route the Android app uses. It is
  documented by Polar for public client use. There is **no secret on this
  site** — nothing an attacker could steal and abuse.
- **Organization id** (`js/config.js` → `polarOrgId`): public by design (also
  compiled into the app). It only scopes lookups to FoldFX keys; it cannot
  list, create, modify or revoke keys. Admin operations require Polar
  dashboard login.
- **Privacy**: the request contains only the key the visitor just typed plus
  the public org id. The response (status, display key) carries no personal
  data. Keys are never logged or stored by the site.
- **Enumeration risk**: none in practice — Polar keys are high-entropy
  (UUID-scale) strings; brute-forcing is infeasible and Polar rate-limits
  the endpoint (429 is handled gracefully).
- **Failure behaviour**: if Polar is unreachable the checker says "try again
  later" and **nothing is blocked** — the download and the app's own
  activation are unaffected. The checker is a convenience, not a gate.

## 3. Website hardening (what is deployed)

- **Content-Security-Policy** on every page (`<meta http-equiv>`):
  - scripts only from this site, plus GA4/giscus which load only after the
    cookie banner is accepted;
  - network connections (`connect-src`) limited to the four services the
    site actually talks to: formsubmit.co (beta requests), abacus
    (anonymous counters), api.polar.sh (key checker), google-analytics
    (opt-in GA4);
  - `object-src 'none'`, `base-uri 'self'`, a locked-down `form-action`.
  - Inline scripts were removed entirely: the boot guard now lives in
    `js/boot.js`, the beta probe in `js/beta-probe.js`. Any future inline
    `<script>` will simply not execute — keep scripts in files.
- **Frame-busting** in `js/boot.js`: the site cannot be embedded in an
  iframe (clickjacking defence; GitHub Pages cannot send
  `X-Frame-Options`, so JS + CSP cover it).
- **Referrer policy** `strict-origin-when-cross-origin`: cross-origin
  requests reveal only the site origin, never full page URLs.
- **Analytics consent**: nothing is measured before the visitor accepts the
  banner; GA4 Consent Mode v2 defaults to denied. See `js/consent.js`.
- **Beta gate**: approved-tester emails are stored as SHA-256 hashes only
  (`js/beta-allowlist.js`) — the public repo never exposes tester
  addresses. Access is re-verified on every visit; removing a hash
  re-locks the download.

## 4. Honest limitations of a static site (know them)

- **The APK file itself is public.** It lives in this public repo, so anyone
  can fetch it by URL. That is acceptable *by design*: the app is
  license-gated at runtime (activation + one-device enforcement), so a
  copied file is a locked trial, not a stolen purchase. If you ever want
  file-level protection, upload the APK to Polar as a **Downloadable
  benefit** on the product — buyers then fetch it from their Polar library,
  and you could drop it from the repo.
- **The client-side beta gate is advisory.** It stops honest visitors, not
  determined ones. Real access control for the paid product lives in the
  app + Polar.
- **GitHub Pages cannot set HTTP response headers**, so CSP travels in a
  `<meta>` tag (frame-ancestors/reporting are not supported there — the
  JS frame-buster covers framing).

## 5. Owner checklist

- [ ] Polar dashboard: keep the License Key benefit's activation limit set
      to match the promise ("one key = one device" — see the app's
      OPEN_QUESTIONS.md for the exact setting).
- [ ] Refunds: Polar revokes the key when a payment is refunded — the app
      then locks on next validation. The thank-you page's checker explains
      this state to buyers.
- [ ] Rotate the GitHub PAT you use for pushes; never commit it
      (this repo's remote URL must stay clean).
- [ ] giscus "Tester talk" is dormant: fill `GISCUS.categoryId` in
      `js/beta-probe.js` (instructions in that file) when you want to open
      the community board.
- [ ] When a new APK ships: update `downloads/`, `downloads/checksums.txt`,
      `downloads/manifest.json`, the download links on beta.html /
      thank-you.html, and the version strings in the i18n fallbacks.

## 6. Reporting

Security reports: **foldfx.contact@gmail.com** (also linked from the beta page
as the private channel — asked for there instead of public posting).
