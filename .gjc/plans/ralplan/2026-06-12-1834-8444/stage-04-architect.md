## Summary
Read-only re-review of commit `b309019e99527a272715b700fa49c73449d086cd` finds the DNS rebinding connector fix, CLI `scheme://` routing, number-bomb bounds, neutral `stripTags` module, and dead marker removal addressed in the inspected files. Approval is still blocked because the IPv4-mapped IPv6 fix only handles dotted-quad `::ffff:a.b.c.d` strings and misses canonical hex mapped forms such as `::ffff:ac10:1`, leaving the same 172.16/12 SSRF bypass class partially open.

Lane verdicts: architectureStatus=`BLOCK`, productStatus=`BLOCK`, codeStatus=`BLOCK`; recommendation=`REQUEST_CHANGES`. Per assignment constraints, no gates, formatters, or product test commands were executed; evidence is from inspected files only.

## Analysis
### Scope and inspected evidence
- Target commit is checked out at `.git/refs/heads/main` as `b309019e99527a272715b700fa49c73449d086cd`, with commit message `fix(security): intake SSRF hardening + extraction bounds (final gate blockers)` in `.git/COMMIT_EDITMSG`.
- Reviewed changed security and advisory surfaces only: `src/intake.js`, `src/cli.js`, `src/audit.js`, `src/text.js`, `tests/unit/intake.test.js`, and `tests/unit/cli.test.js`.

### Item-by-item resolution
1. DNS rebinding connect-time validation: RESOLVED. `src/intake.js:13-14` now imports core `node:https` and `node:http`; `src/intake.js:173-182` defines `guardedLookup`, re-resolves with `lookupImpl(hostname, { all: true })`, classifies every returned address with `isPrivateAddress`, and calls the lookup callback with an error before returning an address when a private address appears. `src/intake.js:189-192` routes production requests through core `http/https` with `lookup: guardedLookup(lookupImpl)`. The regression at `tests/unit/intake.test.js:75-88` sequences a public preflight answer then a private connect-time answer and expects the private-address error, so the test exercises the default `requestOnce` path rather than an injected fetch stub.
2. IPv4-mapped IPv6 normalization: UNRESOLVED / PARTIAL. The IPv4 branch includes 172.16/12 at `src/intake.js:130-133`, and the new dotted mapped branch at `src/intake.js:136-137` reuses `isPrivateAddress(mapped[1])` for strings like `::ffff:172.16.0.1`. Tests cover those dotted cases at `tests/unit/intake.test.js:91-95`. However, the regex only accepts decimal dotted suffixes, so valid canonical mapped IPv6 forms such as `::ffff:ac10:1` do not reduce to IPv4 and then fall through as public. No tests cover canonical hex mapped forms or literal URL input with an IPv4-mapped IPv6 host.
3. CLI `scheme://` guard routing: RESOLVED. `src/intake.js:119-122` defines `looksLikeUrl` for every RFC-style `scheme://`, and `src/cli.js:45-50` routes those targets through `fetchSource` with exit code 1 on guard failure instead of treating them as filesystem paths. `tests/unit/cli.test.js:49-54` asserts `ftp://` and `file://` fail via the URL guard with code 1, while `tests/unit/intake.test.js:98-103` covers http, https, ftp, file, and gopher routing positives plus path-like negatives.
4. Number-bomb bounds and normal extraction: RESOLVED. `src/intake.js:32-42` bounds total scan bytes, per-line scan length, and digit-run length before regex matching; `src/intake.js:75-89` applies the scan cap to numeric extraction and feature extraction. `tests/unit/intake.test.js:107-114` covers a 1MB digit line with a sub-3s ceiling and claim-count bound. Normal extraction is still covered by `tests/unit/intake.test.js:8-13`, `tests/unit/intake.test.js:16-20`, `tests/unit/intake.test.js:23-28`, and `tests/unit/intake.test.js:31-35`, so the bounds do not obviously break representative Korean, English, HTML, dedupe, or table cases.
5. Advisory neutral `stripTags`: RESOLVED. `src/text.js:4-8` owns `stripTags`; Phase 0 intake imports it from `src/text.js` at `src/intake.js:15`, and Phase 5 audit imports the same neutral module at `src/audit.js:12`.
6. Advisory dead `headersFix` marker: RESOLVED. Search over `design-interview/src` and `design-interview/tests` found no `headersFix` references, and the redirect regression now uses only the explicit `requestImpl` wrapper at `tests/unit/intake.test.js:60-73`.

### Stage 1 — Spec compliance
The b309019 implementation satisfies the requested connector architecture for DNS rebinding, CLI scheme routing, extraction bounds, and the two advisory cleanups. The mapped IPv6 requirement is only partially satisfied because the implementation handles the human dotted representation but not canonical IPv6 mapped forms that represent the same private IPv4 ranges.

### Stage 2 — Architecture
The SSRF boundary is improved substantially: preflight validation remains in `assertSafeUrl`, and the actual network connector now has its own guarded resolver instead of relying on a separate fetch resolver. The remaining architectural weakness is that IP normalization is still string-shape-specific. Security policy should normalize an address to a canonical family/range model before classification, not depend on one spelling of an IPv4-mapped IPv6 address.

### Stage 3 — Code quality, security, and performance
The new request path is boring and maintainable for the narrow `http/https` use case, with manual redirect and body-cap logic already present. The number-bomb cap is simple and bounded before `matchAll`, with focused performance coverage. The one security-quality issue is the narrow mapped-address regex at `src/intake.js:136`, which makes tests pass for the reported dotted case while preserving a closely related bypass representation.

## Root Cause
The root cause is incomplete IP normalization. The code fixed one textual shape of IPv4-mapped IPv6 by matching dotted decimal after `::ffff:`, but it did not parse the mapped 32-bit payload generally and then classify the resulting IPv4 address through the existing IPv4 range table.

## Findings
### HIGH — Complete IPv4-mapped IPv6 normalization beyond dotted-quad strings
- Reference: `src/intake.js:136-137`, `tests/unit/intake.test.js:91-95`.
- Impact: `::ffff:172.16.0.1` is now blocked, but a valid canonical mapped form for the same range, for example `::ffff:ac10:1`, does not match the dotted regex and falls through the IPv6 prefix checks as non-private. That leaves the 172.16/12 SSRF bypass class partially unresolved for literal or DNS-returned mapped IPv6 addresses.
- Fix: Parse IPv4-mapped IPv6 addresses structurally, including canonical hex forms, convert the low 32 bits to dotted IPv4, and call the existing IPv4 classifier. Add regressions for `isPrivateAddress(::ffff:ac10:1)`, `isPrivateAddress(::ffff:c0a8:101)`, and `assertSafeUrl(http://[::ffff:172.16.0.1]/)` or the equivalent canonical host serialization.

## Recommendations
1. Replace the dotted-only mapped regex with structural mapped-address normalization, then reuse the IPv4 branch for all mapped forms.
2. Add mapped IPv6 tests for canonical hex and literal URL input, not only direct dotted strings.
3. Keep the core `http/https` guarded lookup architecture and the number-bomb bounds; those fixes should remain.
4. After the mapped-address fix lands, this review can be rerun against the same focused acceptance list.

## Architectural Status
`BLOCK`

## Code Review Recommendation
`REQUEST CHANGES`

## Trade-offs
| Option | Benefit | Cost | Recommendation |
|---|---|---|---|
| Keep dotted-only `::ffff:a.b.c.d` regex | Minimal code and covers the exact prior example | Misses canonical mapped IPv6 forms for the same private ranges | Reject |
| Parse mapped 32-bit payload and reuse IPv4 classifier | Covers dotted and canonical mapped representations with one range policy | Slightly more code and tests | Preferred |
| Add an IP parsing dependency | More complete special-address handling | Extra dependency for a small CLI skill | Acceptable only if local parser stays error-prone |
