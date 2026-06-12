## Summary
Focused re-review of latest `main` (`7ac4502f27f9d91d0de472dc6f01ffe20ca0445d`) found blocker 1 and blocker 2 resolved. Blocker 3 is partially resolved in implementation, but remains unresolved for the requested regression coverage because `tests/unit/cli.test.js` does not cover `EISDIR`; recommendation is `REQUEST_CHANGES`.

No tests, formatters, gates, or product commands were executed per the read-only / no-verification-gate constraint. No new blocker was found in the focused scope.

## Analysis
### Blocker 1 — `audit --visual` fallback is limited to missing Puppeteer typed error: RESOLVED
- `src/screenshot.js:18-28` centralizes Puppeteer loading and throws a typed `ERR_PUPPETEER_MISSING` error for the optional-dependency absence path.
- `src/geometry.js:61-63` uses that shared loader before launching Puppeteer, so the visual lane receives the same typed missing-dependency signal.
- `src/cli.js:47-52` combines visual findings on success, falls back to static-only only when `err.code === "ERR_PUPPETEER_MISSING"`, and calls `fail(`visual lane failed: ${err.message}`, 1)` for all other visual-lane errors. That satisfies the previous blocker’s fail-closed requirement at the CLI boundary.

### Blocker 2 — `package.json` Node engine aligns with Puppeteer 25: RESOLVED
- `package.json:20-24` now declares `"node": ">=22.12.0"` while keeping `"puppeteer": "^25.1.0"`.
- The locked Puppeteer 25 entries require Node `>=22.12.0` at `package-lock.json:198-218` and `package-lock.json:220-237`, so the public package engine in `package.json` now matches the Puppeteer 25 runtime floor requested by the blocker.
- Non-blocking note: the root package metadata inside `package-lock.json:6-18` still says `"node": ">=18"`; because the blocker explicitly targets `package.json`, this is not counted as a new blocker, but the lockfile metadata should be refreshed on the next dependency-touching change.

### Blocker 3 — CLI file-input ENOENT/EISDIR clean failure and CLI regression coverage: UNRESOLVED
- Runtime implementation is present: `src/cli.js:26-32` adds a shared `readInput` helper that maps `ENOENT` to `cannot read <path>: no such file`, maps `EISDIR` to `cannot read <path>: is a directory`, and exits through `fail(..., 2)` without throwing a stack trace.
- Audit and preview paths use the helper: `src/cli.js:43` reads audit input through `readInput`, and `src/cli.js:79-80` reads both preview built HTML and `--against` HTML through `readInput`.
- Regression coverage is incomplete: `tests/unit/cli.test.js:21-39` covers audit ENOENT, audit `--visual` ENOENT before the visual lane, and preview `--against` ENOENT. A focused search found no `EISDIR`, `is a directory`, directory fixture, or temp-directory case in `tests/unit/cli.test.js` or the rest of `tests/`, so the requested `EISDIR` regression coverage is absent. Preview has an ENOENT regression through `--against`, but no EISDIR regression.

### New blocker check
- No new blocker was identified in the focused scope. The only remaining blocking item is the missing `EISDIR` regression coverage required by blocker 3.

### Status lanes
- architectureStatus=`CLEAR`: the CLI/error-boundary structure now has a single `readInput` helper and a fail-closed visual-lane catch at the CLI boundary.
- productStatus=`WATCH`: the requested runtime behavior is statically present, but no commands were run by constraint and the acceptance set is not complete until EISDIR is covered.
- codeStatus=`BLOCK`: requested regression coverage is incomplete.
- recommendation=`REQUEST_CHANGES`.

## Root Cause
The remaining unresolved item is a verification gap, not an architectural gap: the implementation centralized file-input failures in `readInput`, but the CLI regression tests only exercise missing-file (`ENOENT`) paths and omit directory-input (`EISDIR`) behavior.

## Findings
### MEDIUM — Add the requested `EISDIR` CLI regression coverage before approving
- Reference: `src/cli.js:26-32`, `src/cli.js:79-80`, `tests/unit/cli.test.js:21-39`.
- Impact: The runtime code handles directory inputs cleanly today, but without a regression test the exact blocker can silently return as a stack trace or wrong exit code in later CLI refactors. This leaves blocker 3 unresolved against the stated acceptance criteria.
- Fix: Add at least one `tests/unit/cli.test.js` case that passes a directory path to the CLI, asserts exit code `2`, asserts `cannot read <path>: is a directory`, and asserts no stack trace. Prefer covering preview as well because the blocker explicitly called out preview paths.

## Recommendations
1. Add `EISDIR` coverage to `tests/unit/cli.test.js` for audit and/or preview directory input, including exit code `2`, user-facing message, and no stack frames.
2. Keep the existing `readInput` implementation and visual-lane CLI catch structure; they satisfy the focused runtime blockers.
3. Refresh the root `package-lock.json` engine metadata on the next dependency update so it no longer contradicts `package.json`, even though this is not a blocker for the requested package.json-only check.

## Architectural Status
`CLEAR`

## Code Review Recommendation
`REQUEST CHANGES`

## Trade-offs
| Option | Benefit | Cost | Recommendation |
|---|---|---|---|
| Approve based on runtime implementation only | Avoids another test-only change | Leaves requested EISDIR regression unprotected | Reject |
| Add one audit EISDIR test | Minimal change that covers the missing error class | Preview EISDIR could still regress separately | Acceptable minimum |
| Add both audit and preview EISDIR tests | Fully protects the helper and the explicitly mentioned preview path | Slightly more test code | Preferred |
