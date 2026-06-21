## Summary
Read-only 3-lane review finds the board architecture mostly aligned with the approved shape: `src/inert-html.js` is the shared inert primitive, preview re-exports the compatibility surface, board remains a serializer, and CLI exit handling follows the existing 2/1 split. Approval is blocked because the implemented `options.json` schema diverges from the binding ralplan schema and because release/fixture gates that the plan made blocking are not evidenced in the inspected tree. No build/test/lint commands were run per the assignment boundary; evidence is from inspected files only.

3-lane verdict: architectureStatus=`WATCH`, productStatus=`BLOCK`, codeStatus=`BLOCK`; recommendation=`REQUEST CHANGES`.

## Analysis
### Stage 1 — Spec compliance / product lane
What is satisfied:
- Six-core `dimension` enforcement is present: `src/board.js:18` defines `audience|mood|brand|structure|conversion|reference`, and `src/board.js:131-134` rejects palette/asset dimensions.
- The renderer emits an inert board root, CSP, stale marker, equal fallback card, and restrained recommendation line: `src/board.js:287-317`.
- `imageFile` is pre-sized-only by implementation policy: `src/board.js:201-222` checks local regular files, per-image byte cap, sidecar, and png/jpeg/webp magic bytes before embedding a data URI.
- Docs state text authority, no-browser fallback, host seam, six-core dimensions, and release gate: `SKILL.md:93-95` and `core/interview.md:59-68`.

Blocking drift:
- The approved schema requires option-level `visualRole` and `asset` metadata, `wire.blocks[].role`, `moodChips.chips[].label` with optional `value`, and `imageFile` as `{type,path,alt,mime?}` plus option-level asset metadata (`.gjc/plans/ralplan/2026-06-19-visual-interview/pending-approval.md:24-59`). The implementation instead requires `wire.blocks[].label`, requires `moodChips.chips[].value`, requires `imageFile.kind`, ignores `mime`, and only reads top-level `visualRole`/`asset` as strings (`src/board.js:71-107`, `src/board.js:150-172`). Plan-compliant board payloads can be rejected before rendering, especially reference/asset boards.
- The approved matrix says invalid wire connector/arrow attempts must exit 2 and mentions connector/arrow fields explicitly. The implementation validates only the presence of `blocks` and required `label`, then silently drops any extra fields (`src/board.js:71-83`). That masks unsupported S6-ish input instead of rejecting it.
- The plan made fixture-backed acceptance and Codex/data-image dry-runs release blockers (`pending-approval.md:169-224`, `pending-approval.md:242-243`). `find` found no `tests/fixtures/board` directory, and the inspected unit tests use inline temp fixtures only (`tests/unit/board.test.js`, `tests/unit/board-cli.test.js`). No inspected artifact records Codex open/reload or data-image display evidence.

### Stage 2 — Architecture lane
- Shared inert primitive is correctly split: `src/preview.js:13-22` imports/re-exports from `src/inert-html.js`, while `src/board.js:14-15` imports `parseSidecar` and `INERT_CSP` without importing preview. Search found no reverse imports from inert/preview into board, so no circular import was introduced.
- CLI board dispatch is before preview parsing and keeps existing command style: whitelist/usage include `board` (`src/cli.js:38-43`, `src/cli.js:101-102`), and the board branch parses one positional plus required `--out` before the preview fallback (`src/cli.js:229-248`).
- Atomic write is structurally correct for the stated safety model: `renderBoardFile` validates/renders before touching `outPath` (`src/board.js:323-343`), then writes to a same-directory unique temp path with `flag:"wx"` and renames (`src/board.js:349-357`). Fsync is not present, but the plan made best-effort fsync optional.
- Residual architecture risk remains the empirical host lifecycle. Docs state the seam, but without recorded Codex marker evidence the open-once/overwrite-only behavior remains unproven.

### Stage 3 — Code/security/performance lane
- Escaping is consistently applied to user text and style-bearing inputs use narrowed types: `esc` covers HTML special characters (`src/board.js:49-53`), swatches require hex (`src/board.js:65-70`), wire widths are clamped numeric weights (`src/board.js:112-116`), and image `src` is internally generated data URI (`src/board.js:201-222`, `src/board.js:275-276`).
- `src/inert-html.js` centralizes CSP, active-content stripping, remote media/link stripping, and CSS URL neutralization (`src/inert-html.js:7-13`, `src/inert-html.js:48-88`), and preview tests cover re-exported sanitizer behavior.
- Test coverage is focused but does not match the acceptance matrix. Covered: basic schema rejects, image sidecar/magic/byte cap, inert rendering, atomic validation preservation, CLI usage/missing JSON/missing image. Missing from inspected tests: real fixture files, valid brand palette fixture, valid reference `imageFile` CLI fixture, missing sidecar/unsupported MIME/mismatch CLI cases, total HTML over-budget, write-failure/no-stack, concurrent last-writer-wins, invalid wire connectors, per-option metadata contract, docs contract, Codex open/reload evidence, and data-image display measurement.

## Root Cause
The implementation appears to have codified a local/test-derived schema shape instead of the approved ralplan schema. That caused field-level drift in the discriminated union and metadata placement, while the release-gate acceptance matrix was reduced to a smaller inline unit-test set rather than the binding fixture/manual evidence plan.

## Findings
### HIGH — Align `options.json` validation with the approved schema
- Reference: `src/board.js:71-107`, `src/board.js:150-172`; approved contract in `.gjc/plans/ralplan/2026-06-19-visual-interview/pending-approval.md:24-59`.
- Impact: Plan-compliant callers can be rejected: `wire.blocks[{role}]` fails because `label` is required; `moodChips` with `label` but no `value` fails; `imageFile` without implementation-only `kind` fails; option-level `visualRole`/`asset` metadata is not retained. This breaks the SKILL/board interface for palette/reference/asset rounds.
- Fix: Normalize to the plan: top-level `questionKind`; per-option `visualRole` enum and `asset` object; `wire.blocks[].role`; `moodChips` `{kind,label,value?}`; `ctaSample` `{text,tone?,context?}`; `imageFile` `{path,alt,mime?}` with option-level asset metadata. Add compatibility only if explicitly approved and tested; do not silently redefine the public schema.

### HIGH — Close the release-blocking acceptance gates before approval
- Reference: `.gjc/plans/ralplan/2026-06-19-visual-interview/pending-approval.md:169-224`, `.gjc/plans/ralplan/2026-06-19-visual-interview/pending-approval.md:242-243`; inspected tests in `tests/unit/board.test.js` and `tests/unit/board-cli.test.js`; `tests/fixtures/board` is absent.
- Impact: The plan explicitly made fixture-backed tests, Codex open/reload marker dry-run, and data-image display measurement release gates. Inline unit tests plus the reported 254-pass result do not prove the host lifecycle, data-image display, or many matrix cases.
- Fix: Add the named `tests/fixtures/board/*` cases or an equivalent committed matrix; add focused tests for missing sidecar, unsupported MIME, MIME mismatch, total HTML budget, write failure, concurrent writes, invalid wire connectors, and docs contract. Record Codex open/reload marker evidence and data-image display evidence before enabling the visual board integration.

### MEDIUM — Reject anti-tell connector/arrow attempts instead of silently dropping unknown wire fields
- Reference: `src/board.js:71-83`; matrix row in `pending-approval.md:184-185`.
- Impact: A caller can send connector/arrow/node fields and get a successful board. The renderer currently drops them, so the output remains abstract, but the CLI no longer tells the caller that their input attempted an unsupported S6 visual form.
- Fix: Add explicit deny/unknown-field validation for `wire` blocks and top-level wire objects (`connector`, `arrow`, `edge`, `node`, `line`, SVG-ish fields), with exit 2 and a clear message. Cover this with the invalid-wire-connectors fixture.

### MEDIUM — Expand tests from smoke coverage to the binding matrix
- Reference: `tests/unit/board.test.js:35-247`, `tests/unit/board-cli.test.js:24-113`.
- Impact: Current tests are valuable but narrower than the accepted contract. Gaps around metadata, write failures, concurrency, and release gates allow the schema drift above to pass.
- Fix: Treat the plan matrix as the test checklist, not just examples. Use shared fixtures under `tests/fixtures/board` so CLI and direct parser tests exercise the same payloads the SKILL will emit.

## Recommendations
1. Fix `parseBoardOptions`/`validateVisual` to match the approved schema exactly, including per-option metadata and union fields.
2. Add explicit anti-tell input rejection for connector/arrow/node fields rather than only preventing those fields from rendering.
3. Complete the fixture-backed matrix and record the Codex/data-image release evidence before enabling the feature.
4. Keep the current inert module split, CLI branch placement, and atomic write shape; those are good foundations and should not be redesigned.

## Architectural Status
`WATCH`

## Code Review Recommendation
`REQUEST CHANGES`

## Trade-offs
| Option | Pros | Cons | Recommendation |
|---|---|---|---|
| Keep implementation-local schema | Minimal code churn; current unit tests stay green | Breaks approved SKILL/CLI contract and rejects plan-compliant payloads | Reject |
| Align implementation to ralplan schema | Restores public contract; supports palette/reference/asset boards correctly | Requires validator/test updates | Adopt |
| Ship CLI before Codex/data-image evidence | Faster local serializer availability | Violates release-blocking gate and risks stale visual board behavior | Reject for feature enablement |
| Keep feature disabled until evidence exists | Preserves text authority and avoids stale-board promise | Requires manual evidence step | Adopt |

Blockers: schema mismatch; missing release/fixture gates.
