## Summary
Reviewed only `src/geometry.js` and `src/screenshot.js`. Containment and cleanup are mostly sound: page JavaScript is disabled before navigation, request interception aborts every non-`file:` and non-`data:` request before measurement, Chromium is launched without `--no-sandbox`, and `browser.close()` is in `finally`. The slice is WATCH because evaluation waits are not bounded at the application level and the shared geometry visibility heuristic can count clipped or overlapping content.

## Analysis
- Containment: `src/geometry.js:421-426` and `src/screenshot.js:46-51` disable page JavaScript, enable request interception before `goto`, and abort every URL that is not `file:` or `data:`. The reviewed launches use `puppeteer.launch({ headless: "new" })` with no `--no-sandbox` flag. Page content cannot re-enable JavaScript or change interception because the only JavaScript that runs after navigation is trusted DevTools evaluation. There is no explicit `page.setOfflineMode(true)` or remote-request ledger, so containment depends on interception rather than a second fail-closed guard.
- Cleanup: `src/geometry.js:448-449` and `src/screenshot.js:64-65` close the browser in `finally`, so a successfully launched Chromium process is closed on thrown errors. `src/screenshot.js:60` closes each page only on the successful capture path and `src/geometry.js` relies on `browser.close()` rather than an explicit page `finally`; that does not leak Chromium in the current one-browser-per-call structure, but a per-page `finally` would make the ownership contract clearer.
- Lazy Puppeteer load: `src/screenshot.js:18-28` uses dynamic import and returns a typed `ERR_PUPPETEER_MISSING` error with the install command and M0-M2 fallback guidance. Missing Puppeteer is actionable. The catch is broad, so future non-missing loader failures would be mislabeled, but that is diagnostic quality rather than a missing-dependency crash for this slice.
- Geometry correctness: L1 uses visible sibling boxes and S3 uses visible text blocks with an 80 percent centered threshold. The thresholds are internally consistent with the comments, but the shared `isVisible` function does not compute effective painted area through ancestor clipping, and the L1 pitch check accepts overlapping or zero-pitch candidates.
- Timeouts: `page.goto` has a 30000 ms timeout in both files (`src/geometry.js:429`, `src/screenshot.js:54`). The subsequent font wait and analyzer evaluation are awaited through `page.evaluate` without a local deadline (`src/geometry.js:432-433`, `src/screenshot.js:57`), leaving a hang path after navigation.

## Root Cause
The visual lane has the right high-level boundary decisions, but the Puppeteer measurement harness is not yet centralized as a fail-closed primitive. Timeout policy, request accounting, page cleanup, and effective rendered-visibility calculation are split into local ad hoc code, which leaves edge cases around pathological documents and CSS clipping.

## Findings
1. MEDIUM — `src/geometry.js:432` and `src/screenshot.js:57` — The font-settling `page.evaluate(() => document.fonts?.ready)` calls, plus `src/geometry.js:433` analyzer evaluation, have no application-level timeout after the 30 second navigation guard, so a pathological document can hang the visual lane after load. Fix by wrapping font readiness and analyzer evaluation in bounded host-side timeouts that close the page/browser on expiry, and set explicit Puppeteer default/protocol timeouts for the visual lane.
2. MEDIUM — `src/geometry.js:26` — `isVisible` ignores ancestor overflow clipping, ancestor `clip-path`, masks, and content-visibility, so descendants hidden by a wrapper can still be counted by L1/S3/TY/DE checks and can pad or rescue verdicts. Fix by intersecting each candidate rect with the ancestor clip chain or by using a conservative rendered-visibility probe, then exclude elements whose effective painted area is at or below the existing tiny-box threshold.
3. LOW — `src/geometry.js:62` — The L1 pitch check accepts any uniform left-coordinate delta, including zero or overlapping pitches, so stacked carousel or layer children with identical boxes can be reported as a uniform card grid. Fix by requiring positive non-overlapping horizontal separation, such as sorted rects where `next.left >= prev.right - tolerance` and pitch exceeds a minimum before failing L1.

## Recommendations
1. Add a small visual-harness helper used by both files: create page, disable page JavaScript, enable request interception, optionally enable offline mode after local navigation allowances are confirmed, record any remote request attempt, set default timeouts, and close the page in `finally`.
2. Bound all post-navigation waits. Font readiness should degrade after a short deadline with warning evidence, while analyzer evaluation should fail the visual lane cleanly with actionable timeout evidence and no Chromium leak.
3. Replace `isVisible` with effective visibility based on ancestor clipping and nonzero painted area before reusing it for L1, S3, TY, and contrast.
4. Tighten L1 to require actual row geometry: same row, comparable sizes, positive pitch, and no meaningful overlap.
5. Optionally narrow the dynamic import catch in `loadPuppeteer` so only missing `puppeteer` is converted to `ERR_PUPPETEER_MISSING`; rethrow other loader errors with their original cause.

## Architectural Status
WATCH

## Code Review Recommendation
COMMENT

## Trade-offs
| Option | Benefit | Cost |
| --- | --- | --- |
| Current interception-only containment | Simple and already blocks non-local requests in the reviewed paths | No independent offline guard or request ledger to prove zero remote attempts |
| Interception plus offline mode plus remote-request accounting | Stronger fail-closed story and easier audits | Needs careful handling so `file:` and `data:` measurement still works across Chromium versions |
| Ancestor clip-chain visibility | Deterministic and cheaper than pixel analysis | Must model overflow, clip-path, masks, and transforms conservatively |
| Pixel/sample-based visibility probe | Closer to actual painted output | More expensive and can be brittle for text, transparency, and z-index edge cases |
