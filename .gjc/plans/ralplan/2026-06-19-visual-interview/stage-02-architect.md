## Summary
Revision v2 resolves the two stage-1 blockers: runtime thumbnail derivation is removed in favor of caller-supplied pre-sized files with explicit `imageFile` validation, and `dimension` is narrowed back to the six core interview dimensions with palette and asset moved into metadata. The atomic write and Codex dry-run WATCH item is also concretely addressed, but overall status remains WATCH because Codex reload behavior is still empirical until the release gate is executed.

## Analysis
### Stage-1 BLOCK1: thumbnail derivation and invalid `imageFile`
The blocker is resolved. Stage 1 required no runtime image processing, only real pre-sized files or explicit `plain`, and exit 2 for invalid declared images. Revision v2 states that thumbnail derivation is removed and the board CLI never generates, resizes, clips, converts, captures, or mutates images; it embeds only caller-supplied pre-sized files that pass validation (`/tmp/revision_v2.md:20`). The revised image policy requires existing regular local files, pre-sized caller responsibility, sidecar, PNG/JPEG/WebP extension plus magic bytes where practical, per-image byte budget, and final HTML budget (`/tmp/revision_v2.md:64-78`). Failure behavior is explicit exit 2 for missing file, missing sidecar, MIME mismatch, unsupported MIME, file budget, and final HTML budget (`/tmp/revision_v2.md:80-86`). The silent fallback risk is closed because caller fallback must be explicit `plain`, and the CLI must not downgrade a declared `imageFile` (`/tmp/revision_v2.md:86`). The removed list also excludes resize, screenshot clipping, conversion, thumbnail generation, use of `src/screenshot.js` outputs unless separately pre-sized, and new runtime image dependencies (`/tmp/revision_v2.md:88-95`). This aligns with the spec constraint of zero new runtime dependencies (`.gjc/specs/deep-interview-visual-interview.md:71`) and with the observed package shape where Puppeteer is only a devDependency (`package.json`).

The fixture matrix reinforces the contract: valid reference images require a real `ref-thumb.png` plus sidecar, missing files and sidecars exit 2, unsupported MIME and MIME mismatch exit 2, budget failures preserve output, and unavailable assets use an explicit valid `plain` fallback (`/tmp/revision_v2.md:178-185`, `/tmp/revision_v2.md:222-224`). This is the correct root-cause fix rather than a fallback that hides broken inputs.

### Stage-1 BLOCK2: dimension leakage
The blocker is resolved. The core model has exactly six scoring dimensions: audience, mood, brand, structure, conversion, and reference (`core/interview.md:9-14`). Revision v2 explicitly restricts `dimension` to `audience|mood|brand|structure|conversion|reference` and states that `palette` and `asset` are not score dimensions, moving them to `questionKind`, `visualRole`, and `asset` metadata (`/tmp/revision_v2.md:19`). The top-level schema keeps `dimension` six-only and adds `questionKind` as a separate reason/context field (`/tmp/revision_v2.md:31-36`). Option fields define `visualRole` as rendering metadata, not scoring dimension, and `asset` metadata as supplemental rather than authorizing missing files (`/tmp/revision_v2.md:42-47`).

The visual union no longer conflicts with the six-dimensional model. `visual.type` is now the discriminant `swatches|wire|moodChips|ctaSample|imageFile|plain`, while palette, asset, and reference context live in `visualRole` or `questionKind` (`/tmp/revision_v2.md:50-57`, `/tmp/revision_v2.md:60-62`). Implementation tasks repeat this boundary for `src/board.js`, `core/interview.md`, and `SKILL.md` (`/tmp/revision_v2.md:132-136`, `/tmp/revision_v2.md:150-158`). Tests reject non-core `palette` and `asset` dimensions and include a SKILL schema doc contract check (`/tmp/revision_v2.md:175-177`, `/tmp/revision_v2.md:202`).

The original spec still contains older broad wording in the ontology row for `dimension` (`.gjc/specs/deep-interview-visual-interview.md:127`) and acceptance text that says thumbnail derivation (`.gjc/specs/deep-interview-visual-interview.md:92`). Revision v2 intentionally narrows those ambiguous phrases to satisfy the stronger constraints. That is acceptable for ralplan revision as long as implementation treats v2 as the governing execution plan and updates runtime guidance so the old wording is not reintroduced.

### Stage-1 WATCH: atomic write and Codex gate
The WATCH item is addressed in the plan. Revision v2 specifies same-directory unique temp files, exclusive create with `open(tempPath, "wx")`, full write and close, rename only after successful write, existing output preservation on validation/render/write/open/close failure, unique temp names for concurrent sessions, complete-output last-writer-wins semantics, and exit 2 for user filesystem errors or temp collision exhaustion (`/tmp/revision_v2.md:21`, `/tmp/revision_v2.md:99-108`). The fixture matrix includes success, validation-failure sentinel preservation, write failure, and concurrent unique-temp last-writer-wins tests (`/tmp/revision_v2.md:198-201`). This is materially stronger than the current preview CLI direct `writeFile` path, which writes preview output directly (`src/cli.js:245`), and it is correctly scoped to the new board lane.

The Codex reload ambiguity is also moved from optional observation to release gate. Revision v2 says Codex open/reload marker dry-run is release-blocking (`/tmp/revision_v2.md:22`), SKILL integration must gate before enabling the feature (`/tmp/revision_v2.md:158`), and failure of any listed open/reload marker requirement blocks release even if CLI tests pass (`/tmp/revision_v2.md:215-221`). This matches the spec that host-display behavior depends on Codex empirical behavior (`.gjc/specs/deep-interview-visual-interview.md:38-39`, `.gjc/specs/deep-interview-visual-interview.md:52`, `.gjc/specs/deep-interview-visual-interview.md:102`).

### New contradiction or regression check
No new blocking contradiction is introduced. The CLI dispatch plan still needs to add `board` to the whitelist and put the branch before preview parsing, which matches current dispatch shape (`src/cli.js:101`, `src/cli.js:226-245`) and the revision plan (`/tmp/revision_v2.md:112-118`, `/tmp/revision_v2.md:167`). The shared inert module plan remains aligned with preview primitives: `PREVIEW_CSP`, exported `stripActiveContent`, private remote URL neutralization, and private `collectHeadStyles` are observable in `src/preview.js:10`, `src/preview.js:22`, `src/preview.js:127`, and `src/preview.js:153`; revision v2 keeps preview chrome behavior unchanged and shares only inert primitives (`/tmp/revision_v2.md:120-128`). `src/assets.js` remains advisory-only while exporting `classifyKind` and `parseSidecar` (`src/assets.js:3`, `src/assets.js:40`, `src/assets.js:113`), and v2 correctly says not to promote advisory audit to S2 authority (`/tmp/revision_v2.md:138-141`).

## Root Cause
The stage-1 root cause was schema and fallback overloading: `dimension` was carrying score targets, visual render categories, and asset gates, while `imageFile` was serving as desired visual, validation contract, and fallback candidate. Revision v2 fixes that root cause by separating score dimension from `questionKind` and `visualRole`, and by making unavailable visuals an explicit caller-emitted `plain` card while invalid declared files are exit-2 input errors.

## Findings
| Severity | File/reference | Impact | Fix suggestion |
|---|---|---|---|
| MEDIUM / WATCH | `/tmp/revision_v2.md:215-221`, `.gjc/specs/deep-interview-visual-interview.md:38-39`, `.gjc/specs/deep-interview-visual-interview.md:52`, `.gjc/specs/deep-interview-visual-interview.md:102` | Codex open/reload freshness remains empirical. If the host does not reload the overwritten local file, the visual aid can be stale even though text remains authoritative. | Keep the release gate exactly as written and record manual evidence before enabling visual board integration. Do not claim live refresh unless the marker dry-run proves it. |
| LOW / WATCH | `/tmp/revision_v2.md:75`, `/tmp/revision_v2.md:182` | The phrase "magic bytes where practical" could be read too loosely even though supported PNG/JPEG/WebP signatures are practical in Node stdlib and the MIME-mismatch fixture expects exit 2. | Treat magic-byte checks as mandatory for all supported image formats during implementation; keep extension plus signature mismatch as exit 2. |

## Recommendations
1. Proceed from revision v2; the two stage-1 blockers are resolved and no new blocker is present.
2. During implementation, make v2 the governing contract over older spec wording for `dimension` and thumbnail derivation, then update SKILL/core guidance as v2 already requires.
3. Preserve the focused verification scope: board schema, image validation, atomic write, CLI dispatch, inert HTML, and Codex release-gate dry-run. Do not run broad build/test/lint as part of this planning approval.
4. Tighten implementation wording so magic-byte validation is mandatory for PNG/JPEG/WebP, not optional.

## Architectural Status
`WATCH`

## Code Review Recommendation
`COMMENT`

## Trade-offs
| Option | Benefit | Cost | Decision |
|---|---|---|---|
| Runtime thumbnail derivation | Automatic normalization of arbitrary image files | Violates zero runtime dependency or invites fake CSS-only thumbnails and silent downgrade | Reject; v2 uses pre-sized real files plus explicit `plain`. |
| Six core dimensions plus metadata | Preserves scoring model and weakest-dimension targeting | Slightly more schema fields | Accept; v2 uses `questionKind`, `visualRole`, and `asset`. |
| Release-gated Codex dry-run | Prevents shipping stale-host behavior as a promise | Requires manual evidence before enablement | Accept; status remains WATCH until evidence exists. |

## Verdict
Architectural Status: `WATCH`. Code Review Recommendation: `COMMENT`.
