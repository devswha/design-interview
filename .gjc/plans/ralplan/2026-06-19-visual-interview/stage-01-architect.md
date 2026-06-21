## Summary
Option B and the host-display seam are the right architectural direction, but the plan is not safe to implement unchanged. Two issues block approval: the image and thumbnail contract is internally inconsistent under the new runtime dependency 0 constraint, and the proposed `dimension` enum leaks non-core concepts (`palette`, `asset`) into the 6-dimensional interview model.

## Steelman Antithesis
The strongest argument against this feature is that it adds a second visual authority surface to an interview flow whose canonical answer path is already the text `AskUserQuestion`. The board can be stale because the selected lifecycle is open-once and overwrite-only (`.gjc/specs/deep-interview-visual-interview.md:49`, `/tmp/planner_v1.md:13,45,202`), it requires a security refactor of preview primitives (`src/preview.js:10-22,127-153`), and it introduces image embedding under a strict no-runtime-dependency constraint (`.gjc/specs/deep-interview-visual-interview.md:70,90-92`). A text-only implementation would avoid those failure modes and keep the six-dimensional model untouched.

That antithesis is not decisive because the spec explicitly wants a visual aid, not a decision UI: text remains authoritative and fallback-capable (`.gjc/specs/deep-interview-visual-interview.md:43,50,95-96`), while the plan correctly keeps board generation as a judgment-free serializer (`/tmp/planner_v1.md:10-15,51-56,92-125`). The feature is viable if the plan narrows the schema and image policy before implementation.

## Tradeoff Tension
| Tension | Pressure A | Pressure B | Recommendation |
|---|---|---|---|
| Shared inert module vs smallest diff | Option B centralizes CSP and sanitizer fixes and avoids board importing preview chrome. | Keeping everything in preview makes a smaller first diff. | Use Option B, but keep preview-only `collectHeadStyles` in preview. |
| No runtime dependency vs true thumbnails | No deps preserves the non-visual runtime contract. | True thumbnail derivation needs an image library or external tool. | No deps wins; require pre-sized files or explicit plain fallback. |
| Open-once stability vs freshness | Open once avoids focus theft and preserves interview rhythm. | Reopen or reload every round improves freshness but disrupts the host. | Keep open-once, but gate release on Codex evidence and keep text authoritative. |
| Visual recommendation vs convergence pressure | A badge helps users see designer opinion. | Visual emphasis can bias selection and violate recommend discipline. | Small neutral badge only, with render assertions for equal card size, order, and color. |

## Synthesis
Proceed with Option B, but narrow it. `src/inert-html.js` should export `INERT_CSP`, `stripActiveContent`, and the sanitizer helpers required by that sanitizer. `preview.js` should import those primitives and re-export `stripActiveContent` for existing tests (`tests/unit/preview.test.js:3`). Do not move `collectHeadStyles`; it is preview-specific because it imports audited product head styles (`src/preview.js:153-158`), and board should render only its own CSS plus escaped text.

The board schema should split concerns. Keep `dimension` to the six core dimensions from `core/interview.md:3-16`. Put palette display under `visual.type: "swatches"` or a `visualRole`, and represent the asset must-answer gate as `questionKind: "asset"` or brand and asset-readiness metadata. For images, the CLI should embed only already-small local png, jpeg, or webp files that pass extension, magic-byte, sidecar, per-image, and total HTML caps. If no valid file exists, the higher layer emits `visual.type: "plain"`; if the CLI receives a declared invalid `imageFile`, it exits 2 rather than silently downgrading.

Use unique same-directory temp files with exclusive create and rename for atomic writes. Treat concurrent successful writes as last-writer-wins and rely on visible board markers to reveal the current round. Make Codex open and reload a required release gate with recorded manual evidence, not a vague future check.

## Principle Violations
- BLOCK: Six-dimensional model violation. `palette` and `asset` in `dimension` conflict with the 6D scoring model in `core/interview.md:3-16` and `SKILL.md:80-89`.
- BLOCK: Root-cause fallback risk. Silent CLI downgrade from invalid `imageFile` to `plain` would hide a broken input contract. Degradation must happen before CLI invocation or be explicit in the option JSON.
- WATCH: No-fake-reality edge. Any attempt to derive thumbnails by fabricating images or embedding generated mock screenshots would violate S2. Pre-existing real files with sidecar are the only valid image path.

## Analysis
### 1. Option B and inert sharing
Current preview security primitives are private except `stripActiveContent`: `PREVIEW_CSP` lives in `src/preview.js:10-18`, `stripActiveContent` is exported at `src/preview.js:22`, `neutralizeRemoteUrls` is private at `src/preview.js:127`, and `collectHeadStyles` is private at `src/preview.js:153`. Existing preview tests import `buildPreviewHtml` and `stripActiveContent` from `../../src/preview.js` (`tests/unit/preview.test.js:3`), so re-exporting from preview preserves import compatibility. No inspected code imports `neutralizeRemoteUrls` or `collectHeadStyles` directly.

Cycle risk is low if dependency direction is strictly `preview.js -> inert-html.js` and `board.js -> inert-html.js`, with `inert-html.js` importing neither preview nor board. Board self-sufficiency does not require `collectHeadStyles`; that function exists to carry product `<head>` styles into preview and would couple board to preview behavior. Board should not accept arbitrary CSS from options.

### 2. CLI dispatch and usage
Current dispatch rejects unknown commands before any command block (`src/cli.js:100-101`), then treats any surviving command after `crawl` as preview through the fall-through parser (`src/cli.js:226-245`). The plan correctly says to add `board` to whitelist and usage and insert `if (cmd === "board")` before preview parsing (`/tmp/planner_v1.md:71-76`). The safer implementation is to also make preview explicit (`if (cmd === "preview")`) so future lanes cannot accidentally fall through into preview behavior.

README and SKILL command lists currently name only `intake` / `audit` / `preview` / `shot` / `assets` / `crawl` (`README.md:147-152`, `SKILL.md:43-61,141-146`). Because `board` becomes a CLI surface, the implementation plan should include docs updates or explicitly state it is internal-only and omitted from public README on purpose.

### 3. Atomic write
Same-directory temp plus rename is the correct baseline: it avoids cross-device `EXDEV` because temp and final path are on the same mount, and it matches the fixed-path lifecycle requirement (`.gjc/specs/deep-interview-visual-interview.md:46,74,88`). The plan is underspecified for concurrency. A deterministic temp path can collide across two sessions; cleanup from one session can remove the other writer temp. Use a unique same-dir temp name, open it with exclusive create, write and close, then rename. Preserve old output when validation fails; after successful concurrent writes, document last-writer-wins because a single fixed path cannot preserve both outputs.

Write errors should stay user errors. Current CLI already has a broad user-fs code set (`src/cli.js:15-18`) and clean write handling in preview (`src/cli.js:244-248`), but board must apply it to both temp creation and rename.

### 4. Data-image and thumbnail feasibility
Magic-byte verification is feasible with Node stdlib: read the file buffer and check PNG, JPEG, or WebP signatures before data-URI embedding. Runtime thumbnail derivation is not feasible under new runtime dependency 0. `src/screenshot.js` only captures full-page PNGs (`src/screenshot.js:34-55`), and `package.json` has no runtime dependencies, only `puppeteer` as a devDependency. CSS width and height scaling is display scaling, not a derived thumbnail; it does not reduce bytes or protect the HTML budget.

The plan recognizes this in places (`/tmp/planner_v1.md:122,134,217`) but the acceptance criteria still say thumbnail derivation (`.gjc/specs/deep-interview-visual-interview.md:92`, `/tmp/planner_v1.md:170,204`). Resolve this before implementation.

### 5. Dimension ontology
The authoritative interview model is six dimensions: audience, mood, brand, structure, conversion, reference (`core/interview.md:3-16`; also `SKILL.md:80-89`). The plan `dimension` enum includes `asset` and `palette` (`/tmp/planner_v1.md:98,127`), and the spec ontology repeats the broad list (`.gjc/specs/deep-interview-visual-interview.md:127`). This overloads dimension with visual rendering topics and the asset must-answer gate. That is an architecture boundary violation because weakest-dimension targeting and score updates depend on the six-core ontology (`core/interview.md:22-25`).

### 6. Codex reload and stale UX
Manual Codex dry-run is acceptable for external host behavior because the spec marks Codex open and reload as residual empirical ambiguity (`.gjc/specs/deep-interview-visual-interview.md:52,102`). It is not acceptable as a vague optional check; it must be a release gate with recorded evidence.

Open-once and overwrite-only trade focus stability for freshness. The marker (`boardId`, `roundId`, `generatedAt`) helps only when the browser actually shows the updated file; a normal browser will not automatically reload a local file just because it was overwritten. The text question remaining authoritative makes this a WATCH risk rather than a fatal design flaw, but SKILL should avoid promising live refresh unless the Codex dry-run proves it.

### 7. Acceptance criteria mapping
The planner table covers the main spec buckets: CLI contract, inert output, visual union, anti-tell guard, lifecycle, host seam, text fallback, and residual empirical checks (`/tmp/planner_v1.md:162-173`). Observable-test gaps remain: data-image thumbnail derivation is not an implementable behavior; no-browser fallback is primarily manual or doc review; atomic concurrency needs explicit test coverage; README or public usage is not mapped. These are fixable plan deltas, not reasons to abandon the design.

## Root Cause
The root cause is schema overloading. The plan uses the same option schema to represent interview scoring dimensions, visual rendering modes, asset availability, and degradation behavior. That causes both blockers: `palette` and `asset` creep into `dimension`, and `imageFile` ambiguously means desired visual, validated embeddable file, and fallback candidate. Split those concerns before implementation.

## Findings
| Severity / Status | File or reference | Impact | Fix suggestion |
|---|---|---|---|
| HIGH / BLOCK | `.gjc/specs/deep-interview-visual-interview.md:90-92`, `/tmp/planner_v1.md:122,170,204,217`, `src/screenshot.js:34-55`, `package.json` | The plan asks for thumbnail derivation while forbidding runtime dependencies. Implementers can only fake it with CSS scaling, violate the dependency constraint, or silently downgrade. | Remove runtime thumbnail derivation from board. Accept only already-small or pre-derived image files; verify extension plus magic bytes plus sidecar plus byte caps. Declared `imageFile` validation failures exit 2; higher layers choose `plain` before invoking CLI when no valid file exists. |
| HIGH / BLOCK | `core/interview.md:3-16`, `SKILL.md:80-89`, `/tmp/planner_v1.md:98,127` | `palette` and `asset` as `dimension` values break the six-dimensional scoring ontology and can corrupt weakest-dimension targeting. | Restrict `dimension` to audience, mood, brand, structure, conversion, reference. Put palette in `visual.type` or `visualRole`; represent asset must-answer as `questionKind: "asset"` or as brand and asset-readiness metadata. |
| MEDIUM / WATCH | `/tmp/planner_v1.md:123-125`, `src/cli.js:244-248` | Same-dir rename is right, but a non-unique temp name races under concurrent sessions; cleanup can delete another writer temp. | Use unique same-dir temp names with exclusive create, best-effort cleanup, and explicit last-writer-wins semantics. Add an atomic overwrite test that old content survives validation failure and marker updates on success. |
| MEDIUM / WATCH | `src/cli.js:100-101,226-245`, `/tmp/planner_v1.md:71-76`, `README.md:147-152` | A missed whitelist, usage, or doc update makes `board` unreachable or accidentally parsed as preview. | Add `board` to whitelist and usage; make preview an explicit branch; add CLI tests for board no-args, missing `--out`, and unknown command; update README and SKILL command surface or explicitly mark board internal. |
| MEDIUM / WATCH | `.gjc/specs/deep-interview-visual-interview.md:49,52,94-96`, `/tmp/planner_v1.md:45,160,202-209` | Open-once and overwrite-only may show stale visuals; marker is only useful if the displayed document reloads. | Treat Codex open and reload as a required release gate with evidence. Keep text as authority, log `openBoard.reason`, and avoid claiming auto-refresh unless proven. |
| LOW / 참고 | `src/preview.js:10-22,127-153`, `tests/unit/preview.test.js:3`, `/tmp/planner_v1.md:29-31,78-88` | Option B is sound, but moving `collectHeadStyles` would couple board to preview product-style import behavior. | Move or export `INERT_CSP` and sanitizer primitives; re-export `stripActiveContent` from preview; keep `collectHeadStyles` in preview. |

## Recommendations
1. Revise the schema before implementation: `dimension` equals six core dimensions only; separate `visual.type`, `visualRole`, and optional `questionKind` or asset metadata.
2. Rewrite the image policy and acceptance criteria: no runtime thumbnail derivation; only pre-sized local image files are embedded; explicit `plain` is the only degradation path; invalid declared images are exit 2.
3. Tighten `src/cli.js` plan: explicit `board` and `preview` branches, whitelist, usage, README and SKILL updates, clean exit matrix tests.
4. Specify atomic write details: unique same-dir temp, exclusive create, rename, cleanup, old-file preservation on validation failure, last-writer-wins under concurrent success.
5. Make Codex open and reload dry-run a release gate with captured evidence; keep no-browser and stale cases text-authoritative.
6. Keep Option B but do not move preview-specific `collectHeadStyles` into the shared board dependency path.

## Architectural Status
`BLOCK`

## Code Review Recommendation
`REQUEST CHANGES`

## Verdict
Architectural Status: `BLOCK`. Code Review Recommendation: `REQUEST CHANGES`. Proceed only after schema and image-policy corrections are folded into the plan; the rest of Option B and host seam design can stand with the listed WATCH mitigations.
