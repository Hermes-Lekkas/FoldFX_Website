/* ==========================================================================
   FoldFX beta allowlist — APPROVED beta testers (email hashes)
   ---------------------------------------------------------------------------
   HOW IT WORKS
   - Each entry is the SHA-256 hex digest of a tester's email address,
     normalized to lowercase + trimmed. Hashes (not plain emails) are stored
     so the public repository never exposes tester addresses.
   - beta.html computes the SHA-256 of the email a visitor enters and
     unlocks the APK download only if it matches an entry below.
   - Requests arrive by email (FormSubmit -> FoldFX@protonmail.com); the
     developer decides who is eligible.

   HOW TO APPROVE SOMEONE
   - Option A (terminal):  python3 tools/beta-approve.py name@example.com
     — prints the hash and appends it to this file.
   - Option B (any machine with Python):  python3 -c "import hashlib;print(hashlib.sha256(b'name@example.com'.strip().lower()).hexdigest())"
     then paste the hash into the array below.
   - Commit + push; GitHub Pages deploys in ~1 minute. The tester returns
     to the beta page, enters the same email again, and the download
     unlocks.

   REMOVING ACCESS
   - Delete the hash, commit, push. The download re-locks on the tester's
     next visit (access is re-verified every time, never cached as granted).
   ========================================================================== */

window.FX_BETA_ALLOWED = [
  /* "paste-approved-sha256-hex-here" */
];
