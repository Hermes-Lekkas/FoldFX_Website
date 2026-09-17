#!/usr/bin/env python3
"""Approve a FoldFX beta tester: hash their email and add it to the allowlist.

Usage:
    python3 tools/beta-approve.py name@example.com [more@example.org ...]

What it does:
    1. Normalizes the email (trim + lowercase).
    2. Computes its SHA-256 hex digest.
    3. Appends the hash to js/beta-allowlist.js (idempotent — skips duplicates).

Then: git add js/beta-allowlist.js && git commit -m "Approve beta tester" && git push
GitHub Pages redeploys in about a minute; the tester returns to beta.html,
enters the same email again, and the download unlocks.

Revoking access: open js/beta-allowlist.js, delete the hash, commit, push.
"""
import hashlib
import re
import sys
from pathlib import Path

ALLOWLIST = Path(__file__).resolve().parent.parent / "js" / "beta-allowlist.js"


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2

    src = ALLOWLIST.read_text(encoding="utf-8")
    entries = re.findall(r'"([0-9a-f]{64})"', src)
    known = set(entries)
    added = []

    for raw in sys.argv[1:]:
        email = raw.strip().lower()
        if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$", email):
            print(f"  skipped (not a valid email): {raw}")
            continue
        digest = hashlib.sha256(email.encode("utf-8")).hexdigest()
        if digest in known:
            print(f"  already approved: {email}")
            continue
        added.append(digest)
        known.add(digest)
        print(f"  approved: {email} -> {digest}")

    if not added:
        print("Nothing to add.")
        return 0

    lines = src.splitlines()
    # Insert before the closing "];" of the array.
    for i, ln in enumerate(lines):
        if ln.strip() == "];":
            for d in added:
                lines.insert(i, f'  "{d}"')
            break
    else:
        print("ERROR: could not find the array terminator '];' in beta-allowlist.js")
        return 1

    ALLOWLIST.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\n{len(added)} hash(es) appended to js/beta-allowlist.js")
    print("Commit and push to deploy:")
    print("  git add js/beta-allowlist.js && git commit -m 'Approve beta tester' && git push")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
