## Summary
G001 M3 visual lane is directionally correct: `geometry.js` owns rendered L1/S3 checks, `screenshot.js` owns shared Puppeteer loading and screenshots, `audit.js` keeps a compatible findings shape, and `SKILL.md` plus `core/design-tells.md` now separate machine and LLM lanes without double scoring. I am blocking approval because `audit --visual` swallows every visual-lane failure, not only missing Puppeteer, and the selected Puppeteer version conflicts with the repository advertised Node engine.

Lane verdicts: architectureStatus=`BLOCK`, productStatus=`BLOCK`, codeStatus=`BLOCK`; recommendation=`REQUEST_CHANGES`. Verification was read-only only per assignment: no gates, tests, formatters, or product commands were executed.

## Analysis
### Acceptance criteria
- (a) Puppeteer install plus real capture: partially met in code. `captureFile` creates desktop and mobile viewports and writes full-page screenshots at `src/screenshot.js:30-44`; the CLI `shot` command calls it and exits nonzero on capture errors at `src/cli.js:41-49`. Blocked by dependency compatibility: `package.json:20-24` advertises Node `>=18` while `package-lock.json:216-235` records Puppeteer 25 and puppeteer-core requiring Node `>=22.12.0`.
- (b) Render-box geometry for L1/S3: met. `pageAnalyzer` runs in the browser at `src/geometry.js:15-68`, uses DOM geometry and computed style, and returns findings with ids `L1` and `S3` at `src/geometry.js:70-71`.
- (c) `audit --visual` joins static and visual lanes plus noisy missing-install fallback: partially met. `src/cli.js:29-34` imports `geometry.js`, combines visual findings on success, and prints `visual lane skipped` on errors. The fallback is noisy, but it is too broad because all visual errors are downgraded to static audit results.
- (d) Slop fixture real detection: met. The slop fixture defines three centered `280px × 180px` cards at `tests/fixtures/slop/feature-grid.html:6-15`; the visual test asserts static audit stays clean and L1 fails with `3× identical 280×180` evidence at `tests/unit/geometry.test.js:20-27`.
- (e) Phase 4 screenshot self-review: met in the skill. `SKILL.md:98` requires `node src/cli.js shot <built.html>`, reading the generated desktop/mobile PNGs before user preview, checking visual language and L2/L3/L4, and reporting if Puppeteer is missing.
- (f) Design-tells lane split and no double scoring: met in the primary docs. `core/design-tells.md:40-44` assigns C1/T1/T2/T4/S5 to static machine audit, L1/S3 to the visual machine lane, and only L2-L4, S1/S2/S4, T3, T5 to the LLM lane. `SKILL.md:106-107` repeats the same split.

### Architecture-side
The module boundaries are mostly clean. `screenshot.js` exposes `VIEWPORTS` plus `loadPuppeteer`, and `geometry.js` reuses them at `src/geometry.js:10-11` and `src/geometry.js:62-63`, avoiding duplicate optional-dependency code. `audit.js` preserves a simple findings contract through `auditHtml` and `combineAudits` at `src/audit.js:116-135`, and formatting consumes the same shape at `src/audit.js:140-146`.

The architectural defect is fallback scope. `loadPuppeteer` emits a clear missing-install error at `src/screenshot.js:16-23`, but `cli.js` catches every error from `analyzeVisualTells` at `src/cli.js:31-34` and still exits based on the static result at `src/cli.js:37-38`. That converts browser launch failures, navigation timeouts, page-evaluation regressions, and future analyzer bugs into a successful static-only audit.

### Product-side
The user-visible workflow is mostly updated. Phase 4 includes screenshot self-review before showing the preview (`SKILL.md:98`), Phase 5 makes `audit --visual` the deterministic machine gate (`SKILL.md:106`), and the LLM checklist excludes L1/S3 (`SKILL.md:107`, `core/design-tells.md:42-44`). The product acceptance is still blocked because advertised install/runtime support is inconsistent and the visual audit can be skipped for reasons other than missing Puppeteer.

### Code-side
`pageAnalyzer` is self-contained as required: the browser-evaluated function is defined at `src/geometry.js:15`, uses only DOM globals such as `document`, `getComputedStyle`, and `getBoundingClientRect` at `src/geometry.js:16-52`, and is passed directly to `page.evaluate` at `src/geometry.js:68`. Clean fixture protection exists: `tests/unit/geometry.test.js:30-32` asserts the clean restaurant page passes both visual tells, and `tests/quality/baseline.json:6-7` keeps the feature-grid static-only and restaurant clean baselines.

The skip branches are deterministic per environment: `tests/unit/geometry.test.js:7-11` and `tests/unit/screenshot.test.js:5-16` compute `hasPuppeteer` once and use it to skip installed or missing dependency lanes. However, normal installs include Puppeteer as a devDependency at `package.json:23-24`, so the missing-Puppeteer tests only run in environments that deliberately omit dev dependencies.

## Root Cause
The visual lane was added as an optional enhancement, but the CLI fallback boundary was placed around the whole rendered audit instead of around only the known optional-dependency absence. That makes an explicitly requested deterministic visual gate behave like best-effort diagnostics and hides failures in the primary visual contract.

A secondary root cause is dependency selection without reconciling transitive package engines against the repository public engine range. The project promises Node `>=18`, but the locked visual dependency stack now requires Node `>=22.12.0`.

## Findings
### HIGH — `audit --visual` silently downgrades non-dependency visual failures
- Reference: `src/cli.js:29-38`, `src/screenshot.js:16-23`, `src/geometry.js:67-71`.
- Impact: Any rendering, navigation, browser-launch, or page-evaluation failure prints a warning and exits with the static audit result. A page with L1/S3 violations can pass delivery if the visual analyzer breaks or times out, violating acceptance (c) and the Phase 5 gate in `SKILL.md:106`.
- Fix: Make `loadPuppeteer` throw a typed or coded missing-dependency error, catch only that specific error in `cli.js`, and preserve the noisy static fallback only for that case. For all other `analyzeVisualTells` failures, print the error and exit nonzero. Add tests for missing Puppeteer fallback and for a non-missing visual failure that must fail the audit.

### HIGH — Puppeteer 25 conflicts with the advertised Node support
- Reference: `package.json:20-24`, `package-lock.json:216-235`.
- Impact: The package claims Node `>=18`, but the locked Puppeteer and puppeteer-core packages require Node `>=22.12.0`. This undermines acceptance (a) for real screenshot capture under the supported engine and can make visual lane setup fail or behave unsupported on Node 18/20 installations.
- Fix: Either pin Puppeteer to a version whose engines support Node 18, or raise `package.json` engines plus docs/tests to Node `>=22.12.0`. Since the existing project engine says M0-M2 support Node 18, the lower-risk fix is to select a Node-18-compatible Puppeteer version for the optional M3 lane.

### LOW — Source comments and roadmap still describe old lane ownership
- Reference: `src/audit.js:7-9`, `ROADMAP.md:36-37`.
- Impact: Runtime behavior and primary docs are correct, but `audit.js` still says L1-L4 and S1-S4 remain in the LLM checklist, and the roadmap leaves Phase 4 and L1/S3 geometry unchecked. This can mislead future maintainers about the new visual lane boundary.
- Fix: Update comments and roadmap checkboxes to match `SKILL.md:98`, `SKILL.md:106-107`, and `core/design-tells.md:40-44`.

### LOW — L1 heuristic remains intentionally broad and corpus protection is thin
- Reference: `src/geometry.js:25-43`, `tests/unit/geometry.test.js:20-32`, `tests/quality/baseline.json:6-7`.
- Impact: The L1 detector flags any visible three-plus same-size siblings on the same row with uniform pitch, without checking icon/title/body repetition. The clean restaurant fixture protects one non-slop layout, but legitimate galleries, pricing rows, or product cards could become false positives.
- Fix: Keep the current heuristic for M3 if desired, but expand clean visual fixtures and consider requiring card-like text structure or repeated heading/body pairs before failing L1.

## Recommendations
1. Change `audit --visual` fallback to catch only the typed missing-Puppeteer case; fail closed for all other visual-lane errors.
2. Resolve the Puppeteer/Node engine mismatch by downgrading Puppeteer or raising the project engine and docs.
3. Add a CLI-level test that proves `audit --visual` returns static-only with a visible warning only when Puppeteer is absent.
4. Add a CLI-level test or injected analyzer failure proving non-dependency visual failures exit nonzero.
5. Refresh stale comments and roadmap entries after the blocking fixes.
6. Expand the clean visual corpus before broadening L1/S3 enforcement further.

## Architectural Status
`BLOCK`

## Code Review Recommendation
`REQUEST CHANGES`

## Trade-offs
| Option | Benefit | Cost | Recommendation |
|---|---|---|---|
| Catch all visual errors and continue static-only | Keeps audit available in hostile browser environments | Hides analyzer defects and lets L1/S3 violations pass despite `--visual` | Reject |
| Catch only typed missing-Puppeteer errors | Preserves optional dependency behavior while failing closed on real visual-lane defects | Requires typed error and tests | Preferred |
| Raise project engine to Node `>=22.12.0` | Matches Puppeteer 25 | Drops advertised Node 18 support for all users | Accept only if product wants M3 to set the global engine |
| Pin Puppeteer to a Node-18-compatible version | Keeps current Node support promise and M0-M3 install story | Older Puppeteer feature set | Preferred for current contract |
