## Summary
Final read-only review of commits `3093d3a` (M4 intake), `d944eeb` (EISDIR), and `53fcf10` (G003 e2e/docs) finds the product-facing pipeline mostly complete, including public-surface e2e coverage and audit/preview EISDIR regressions. Approval is blocked by SSRF guard design gaps: DNS validation is not bound to the actual fetch connection, and IPv4-mapped IPv6 private addresses are incompletely classified.

Lane verdicts: architectureStatus=`BLOCK`, productStatus=`WATCH`, codeStatus=`BLOCK`; recommendation=`REQUEST_CHANGES`. Per assignment constraints, no gates, formatters, or product test commands were executed; evidence is from inspected files only.

## Analysis
### Stage 1 — Spec compliance
- G002 intake claim extraction is present: `src/intake.js:15-21` defines price/percent/duration/quantity patterns, `src/intake.js:35-45` extracts feature claims from HTML headings/list items and markdown bullets, `src/intake.js:53-74` returns structured `{ claims }`, and `src/intake.js:78-90` formats the Phase 5 preservation table. Focused tests cover Korean prices/quantities/percent at `tests/unit/intake.test.js:8-13`, English `$8/user/month`, `30 templates`, and `7 days` at `tests/unit/intake.test.js:16-20`, and HTML tag stripping/list features at `tests/unit/intake.test.js:23-28`.
- The SSRF implementation covers several requested pieces: scheme whitelist at `src/intake.js:121-122`, localhost/private-host blocking at `src/intake.js:125-126`, literal-IP blocking at `src/intake.js:128-130`, DNS result validation at `src/intake.js:132-136`, redirect-hop revalidation at `src/intake.js:163-167`, timeout at `src/intake.js:161`, and body cap at `src/intake.js:141-151` plus `src/intake.js:171`. However, the validation is preflight-only and not enforced by the network connector, and the mapped IPv6 classifier misses private `172.16/12`; those are blocking security/spec gaps.
- G003 e2e uses the public CLI surface rather than module imports: the helper executes `node src/cli.js` at `tests/e2e/pipeline.test.js:18-24`, then covers intake JSON at `tests/e2e/pipeline.test.js:27-32`, audit failure at `tests/e2e/pipeline.test.js:34-40`, optional `audit --visual` at `tests/e2e/pipeline.test.js:42-47`, preview artifact generation at `tests/e2e/pipeline.test.js:49-57`, and optional shot PNGs at `tests/e2e/pipeline.test.js:60-72`.
- G004 residual EISDIR coverage is resolved for the requested audit+preview lanes: shared clean file-input failure handling is in `src/cli.js:27-34`, audit uses it at `src/cli.js:63`, preview uses it for built and against files at `src/cli.js:99-100`, and regressions cover audit directory input at `tests/unit/cli.test.js:35-40` plus preview `--against` directory input at `tests/unit/cli.test.js:42-46`.
- README and ROADMAP are mostly aligned with the delivered surface: README documents intake, `--visual`, layout, and test/e2e coverage at `README.md:30-31`, `README.md:69-74`, and `README.md:85`; ROADMAP marks M4/M4.5 details at `ROADMAP.md:41-53`. Product status is `WATCH`, not `CLEAR`, because `ROADMAP.md:47` claims the SSRF guard is complete while the actual guard has the two security gaps below.

### Stage 2 — Architecture
- CLI lane structure is cohesive: `src/cli.js:38` gates known commands, `src/cli.js:40-56` owns intake, `src/cli.js:59-76` owns audit and fail-closed visual fallback except missing Puppeteer, and `src/cli.js:90-105` owns preview output. Shared `readInput` keeps user-input errors uniform.
- `stripTags` is reused rather than duplicated, but its home is the wrong boundary: `src/intake.js:9` imports from `src/audit.js:25-29`, making Phase 0 intake depend on Phase 5 audit. This is low risk today because `audit.js` is side-effect-free, but it is a maintainability seam to fix by extracting a neutral text/html utility.
- The SSRF boundary is the load-bearing architecture issue. `assertSafeUrl` performs an address check, but `fetchSource` passes the hostname to fetch at `src/intake.js:163`, so Node/undici can do a fresh DNS lookup not constrained by the checked address set. That is not a safe DNS-revalidation architecture for hostile URLs.

### Stage 3 — Code quality, security, and performance
- SSRF tests are deterministic and avoid live network: unit tests inject `lookupImpl` and `fetchImpl` at `tests/unit/intake.test.js:48-73`; the redirect test asserts the private redirect target is never fetched at `tests/unit/intake.test.js:60-73`.
- The deterministic tests are not complete for the blocking cases: they do not model rebinding between validation and connect, and `tests/unit/intake.test.js:39-45` covers `::ffff:127.0.0.1` but not `::ffff:172.16.0.1` or equivalent mapped RFC1918 ranges.
- Regex review found no catastrophic nested-quantifier blocker in the inspected patterns. Claim regexes in `src/intake.js:15-21`, HTML extraction regexes in `src/audit.js:20`, `src/audit.js:65`, `src/audit.js:84`, and preview sanitizer regexes in `src/preview.js:24-27` are bounded by simple delimiters/classes and the URL fetch path has a 5MB cap; local-file paths still rely on normal CLI input size discipline.
- Dead code/duplication is minor: `tests/unit/intake.test.js:66` assigns `fetchImpl.headersFix = true`, but no code reads it.

## Root Cause
The intake URL guard is implemented as a preflight validator around a generic `fetch` call rather than as the resolver/connector used by the actual HTTP request. That split creates a time-of-check/time-of-use DNS gap and leaves private-address classification duplicated by string prefixes instead of normalizing all IP representations through one range-checking path.

## Findings
### HIGH — Bind SSRF DNS validation to the actual network connection
- Reference: `src/intake.js:132-136`, `src/intake.js:163`.
- Impact: A DNS-rebinding host can return a public address during `assertSafeUrl` and a private/metadata address during the independent fetch resolver call. The guard then appears to pass DNS validation while the request still reaches an internal target.
- Fix: Move validation into the connection resolver, e.g. use Node `http`/`https` with a `lookup` callback that resolves, classifies, and returns only allowed addresses, or an undici dispatcher/custom connector that validates the address used for the connection. Add a deterministic test with a lookup sequence that would rebind from public to private and assert the private connection is refused before any request is sent.

### HIGH — Complete IPv4-mapped IPv6 private-range classification
- Reference: `src/intake.js:99-110`, `tests/unit/intake.test.js:39-45`.
- Impact: Plain `172.16.0.1` is blocked by the IPv4 branch, but a mapped representation such as `::ffff:172.16.0.1` is not covered by the IPv6 prefix list. That leaves a private RFC1918 range bypass for literal or DNS-returned mapped addresses.
- Fix: Normalize `::ffff:` addresses to IPv4 and reuse the IPv4 branch, or use a well-tested IP range parser. Add tests for mapped `172.16.0.0/12`, mapped `0.0.0.0/8`, and mapped metadata/link-local variants.

### LOW — Extract shared tag stripping out of the audit module
- Reference: `src/intake.js:9`, `src/audit.js:25-29`.
- Impact: Phase 0 intake currently depends on the Phase 5 audit module for a generic HTML-text helper. Future audit-only dependencies or side effects would leak into intake.
- Fix: Move `stripTags` to a neutral utility module and import it from both `audit.js` and `intake.js`.

### LOW — Remove unused test marker assignment
- Reference: `tests/unit/intake.test.js:66`.
- Impact: `fetchImpl.headersFix = true` is dead code and makes the redirect test look like it has an unused fixture switch.
- Fix: Delete the assignment; the explicit wrapper at `tests/unit/intake.test.js:68-72` already adapts `headers.get`.

## Recommendations
1. Rework `fetchSource` so DNS resolution/classification and the actual HTTP(S) connection share the same resolver path; add a deterministic rebinding regression.
2. Normalize IPv4-mapped IPv6 addresses before private-range checks; add mapped-address unit cases.
3. Downgrade ROADMAP M4 SSRF completion wording until the two SSRF guard fixes land.
4. Extract `stripTags` to a neutral helper module during the next intake/audit cleanup.
5. Remove the stray `fetchImpl.headersFix` assignment.

## Architectural Status
`BLOCK`

## Code Review Recommendation
`REQUEST CHANGES`

## Trade-offs
| Option | Benefit | Cost | Recommendation |
|---|---|---|---|
| Keep preflight DNS validation before `fetch` | Simple and easily unit-injected | Vulnerable to DNS TOCTOU/rebinding because fetch resolves independently | Reject |
| Use core `http`/`https` with validated `lookup` per request | Binds validation to the connection and avoids new dependencies | More manual redirect/body handling | Preferred boring fix |
| Use undici dispatcher/custom connector | Keeps Fetch API shape and can centralize policy | Requires careful Node/undici API handling and tests | Acceptable if kept small |
| String-prefix IPv6 checks | Minimal code | Easy to miss mapped/special encodings | Reject |
| Normalize IPs through one parser/range table | Correct and maintainable | Slightly more code or dependency | Preferred |
