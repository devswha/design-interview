# 시각 인터뷰 보드 구현 계획 — revision stage 2

## Summary

Architect BLOCK 2와 Critic ITERATE 피드백을 반영해 stage-1 계획을 개정한다. 핵심 변경은 네 가지다. 첫째, `dimension`은 core 인터뷰 점수 차원 6개로만 제한하고 palette/asset은 별도 시각 메타로 분리한다. 둘째, 런타임 썸네일 파생을 완전히 제거하고 `imageFile`은 pre-sized 실제 파일만 허용한다. 셋째, atomic write를 same-directory unique temp + exclusive create + rename으로 구체화한다. 넷째, 수용기준을 실제 fixture 파일명과 기대 결과로 닫고 Codex open/reload marker dry-run을 release gate로 격상한다.

## RALPLAN-DR delta

### Principles retained

1. Two-layer discipline: board CLI는 판단 없는 serializer다.
2. Inert by construction: shared sanitizer/CSP, no script, data image only.
3. Rhythm preservation: text question is always authoritative and same-turn.
4. No fake reality: real pre-sized file plus sidecar only.
5. Opinion without convergence: small neutral recommendation badge only.

### Decision changes from stage 1

1. `dimension`은 `audience|mood|brand|structure|conversion|reference`만 허용한다. `palette`와 `asset`은 점수 차원이 아니므로 schema에서 제거하고 `questionKind`, `visualRole`, `asset` metadata로 표현한다.
2. Thumbnail derivation is removed. Board CLI never generates, resizes, clips, converts, captures, or mutates images. It embeds only caller-supplied pre-sized files that pass validation.
3. Atomic write is specified as same-directory unique temp file with exclusive create (`wx` / O_EXCL), full write/fsync best effort where available, then rename. Validation or write failure preserves existing out file.
4. Codex open/reload marker dry-run is a release-blocking gate, not an optional observation.

## Revised options.json schema

### Top-level fields

- `schemaVersion`: exact integer `1`.
- `boardId`: non-empty stable session id string.
- `roundId`: non-empty round id string.
- `dimension`: one of exactly `audience`, `mood`, `brand`, `structure`, `conversion`, `reference`.
- `questionKind`: optional enum describing why the visual is used without changing score dimension, e.g. `choice`, `palette`, `asset`, `reference`, `structure`, `conversion`, `fallback`.
- `question`: non-empty string matching the text question.
- `recommendedNumber`: integer matching an option number or `null`.
- `recommendReason`: non-empty string iff `recommendedNumber !== null`; otherwise `null`.
- `options`: non-empty array of option objects.

### Option fields

Each option has:

- `number`: positive integer, unique in the board.
- `label`: non-empty string.
- `rationale`: string, may be empty only for direct input/none fallback.
- `visualRole`: optional enum such as `palette`, `structure`, `mood`, `conversion`, `reference`, `asset`, `plain`. This is rendering/context metadata, not scoring dimension.
- `asset`: optional metadata object for actual files, e.g. `{ kind:"reference"|"asset", sourceLabel, licenseLabel? }`. This supplements `imageFile`; it does not authorize missing files.
- `visual`: discriminated union below.

### visual.type union

- `swatches`: `{ type:"swatches", colors:[{ hex, label? }] }`. Used mostly with `visualRole:"palette"` under a core dimension such as `brand` or `mood`; no gradient values.
- `wire`: `{ type:"wire", blocks:[{ role, weight? }] }`. Abstract hierarchy blocks only; no nodes, connectors, arrows, subway lines, box-line diagrams.
- `moodChips`: `{ type:"moodChips", chips:[{ kind:"color"|"type"|"texture", label, value? }] }`.
- `ctaSample`: `{ type:"ctaSample", text, tone?, context? }`. Button/text sample only; no funnel, arrow, or flow diagram.
- `imageFile`: `{ type:"imageFile", path, alt, mime? }` plus option-level `asset` metadata. File must already be pre-sized and must have sidecar.
- `plain`: `{ type:"plain", text }`.

### Explicit dimension separation examples

- Palette question for brand: `dimension:"brand"`, `questionKind:"palette"`, option `visualRole:"palette"`, visual `swatches`.
- Asset sourcing or asset choice: `dimension:"brand"` or the weakest applicable core dimension, `questionKind:"asset"`, option `visualRole:"asset"`, visual `imageFile` or `plain`.
- Screenshot/reference choice: `dimension:"reference"`, `questionKind:"reference"`, option `visualRole:"reference"`, visual `imageFile`.

## Revised imageFile policy

Board CLI performs validation and embedding only. It never derives thumbnails.

### Required conditions

For every declared `imageFile`:

1. `path` resolves to an existing regular local file.
2. File is already pre-sized for board display by the caller. The board CLI does not inspect dimensions unless a cheap metadata check exists without new dependency; byte budget remains authoritative.
3. Sidecar exists either at declared metadata path if added later or adjacent as `<file>.license.txt` / same project convention.
4. MIME is png, jpeg, or webp by extension and magic bytes where practical.
5. File byte size is at or below `BOARD_IMAGE_MAX_BYTES`.
6. Total final HTML size is at or below `BOARD_HTML_MAX_BYTES`.

### Failure behavior

- Missing file: exit 2, clean message, no stack.
- Missing sidecar: exit 2, clean message, no stack.
- MIME mismatch or unsupported MIME: exit 2, clean message, no stack.
- File over byte budget: exit 2, clean message, no stack.
- Final HTML over total budget: exit 2, clean message, no stack.
- Caller-controlled fallback: if the SKILL cannot prove a suitable pre-sized file exists, it must emit `plain` instead of `imageFile`. Board CLI does not silently downgrade a declared `imageFile`; declared image failure is user/input error.

### Removed from plan

- No resize.
- No screenshot clipping.
- No conversion.
- No thumbnail generation.
- No use of `src/screenshot.js` outputs unless the caller separately provides a pre-sized image that passes the above rules.
- No new runtime dependency for image processing.

## Revised atomic write contract

`renderBoardFile(optionsPath,outPath)` must:

1. Validate and fully render HTML in memory before touching `outPath`.
2. Resolve `outPath` directory and create a unique temp path in the same directory, e.g. `.<basename>.tmp-<pid>-<timestamp>-<random>`.
3. Open the temp file with exclusive create semantics: Node `open(tempPath, "wx")`, equivalent to O_CREAT | O_EXCL | O_WRONLY.
4. Write the full HTML to the temp file and close it. Best-effort fsync may be added if the project already uses it or Node APIs make it straightforward, but correctness must not depend on partial writes becoming visible.
5. Rename temp path to `outPath` only after complete successful write.
6. On validation/render/write/open/close failure, best-effort unlink temp and leave existing `outPath` unchanged.
7. Concurrent sessions use unique temp names to avoid temp collisions. Final `rename` is last-writer-wins; no partial file is exposed.
8. Write permission errors, ENOENT/ENOTDIR/EISDIR/EACCES/EPERM/EROFS/ENAMETOOLONG/ELOOP, or exclusive temp collision exhaustion are exit 2.

## File-level changes

### `src/cli.js`

- Add `board` to whitelist and usage.
- Insert `if (cmd === "board")` before preview parsing.
- Parse one positional `options.json` and required `--out <file>`.
- Reject missing `--out`, missing value, unknown extra positional, invalid JSON, schema errors, missing image files, missing sidecar, unsupported MIME, over-budget image/HTML, and write failures with exit 2 and no stack.
- Treat renderer invariant failures as exit 1.

### `src/inert-html.js` new

- Split shared inert primitives from preview: `INERT_CSP`, `stripActiveContent`, CSS remote URL neutralization.
- Preview and board import the same primitives.

### `src/preview.js`

- Import from `src/inert-html.js` and re-export `stripActiveContent` for existing tests/imports.
- Keep preview chrome behavior unchanged.

### `src/board.js` new

- Implement schema validator with dimension limited to the six core dimensions.
- Implement `questionKind`, `visualRole`, and `asset` metadata without treating them as scoring dimensions.
- Implement `buildBoardHtml(boardModel)` with `#dsiv-board-root`, marker, visual renderers, equal fallback card visibility, and restrained recommend badge.
- Implement imageFile validation and data URI embedding for pre-sized files only.
- Implement atomic write contract exactly as above.

### `src/assets.js`

- Reuse exported `parseSidecar` and `classifyKind` where useful.
- Do not promote advisory asset audit to S2 authority.

### `src/screenshot.js`

- No board dependency. Mention in docs/tests only that fullPage screenshot outputs are not acceptable unless pre-sized externally and validated as normal imageFile.

### `core/interview.md`

- Add visual board note: `dimension` remains one of six score dimensions; palette/asset boards are visual roles/question kinds only.
- Reinforce text/free input authority and restrained recommendation.

### `SKILL.md`

- In Phase 1, when preparing board options, select one of six `dimension` values from the current score target.
- Add `questionKind`/`visualRole` for palette/asset/reference rendering context.
- Emit `imageFile` only for pre-sized real files with sidecar and known budget compliance; otherwise emit `plain`.
- Keep `renderBoard(optionsPath,outPath)` and `openBoard(path)->{opened,reason}` seam.
- Codex open/reload marker dry-run is a release gate before enabling the feature.

## Sequencing

1. Extract inert primitives and preserve preview tests.
2. Implement revised board schema with six-only `dimension` and separate `questionKind`/`visualRole`.
3. Implement pre-sized-only imageFile validation and explicit exit 2 failures.
4. Implement board HTML renderer and recommendation badge.
5. Implement exclusive atomic write with same-directory unique temp and rename.
6. Wire CLI board command before preview block.
7. Update SKILL/core docs for Phase 1 integration.
8. Complete fixture-backed tests and release-gate manual dry-runs.

## Fixture-backed acceptance matrix

| Requirement | Fixture / test file | Expected result |
|---|---|---|
| Valid brand palette board with core dimension separation | `tests/fixtures/board/valid-brand-palette.json` | `dimension:"brand"`, `questionKind:"palette"`, `visualRole:"palette"`, renders swatches, exits 0 |
| Reject non-core dimension palette | `tests/fixtures/board/invalid-dimension-palette.json` | CLI exits 2; stderr mentions invalid dimension; no output overwrite |
| Reject non-core dimension asset | `tests/fixtures/board/invalid-dimension-asset.json` | CLI exits 2; stderr mentions invalid dimension; no stack |
| Valid reference image file | `tests/fixtures/board/valid-reference-image.json` with `tests/fixtures/board/images/ref-thumb.png` and `ref-thumb.png.license.txt` | exits 0; HTML contains data:image/png and alt text |
| Missing image file | `tests/fixtures/board/invalid-image-missing-file.json` | exits 2; existing out file unchanged |
| Missing sidecar | `tests/fixtures/board/invalid-image-missing-sidecar.json` with `images/no-sidecar.png` | exits 2; stderr mentions sidecar; no stack |
| Unsupported MIME | `tests/fixtures/board/invalid-image-svg.json` with `images/not-allowed.svg` | exits 2; no data URI emitted |
| MIME mismatch | `tests/fixtures/board/invalid-image-mime-mismatch.json` with `.png` text fixture | exits 2; stderr mentions MIME |
| Per-image over budget | `tests/fixtures/board/invalid-image-over-budget.json` with `images/too-large.png` | exits 2; existing out file unchanged |
| Total HTML over budget | `tests/fixtures/board/invalid-total-html-over-budget.json` | exits 2; no partial output |
| Caller plain fallback for unavailable asset | `tests/fixtures/board/valid-asset-plain-fallback.json` | exits 0; renders plain card; no image validation attempted |
| swatches renderer | `tests/fixtures/board/valid-swatches.json` | contains swatch labels and no gradient CSS |
| wire renderer anti-S6 | `tests/fixtures/board/valid-wire-blocks.json` | renders abstract blocks; no svg line, arrow, edge, connector class |
| reject wire connector attempt | `tests/fixtures/board/invalid-wire-connectors.json` | exits 2; stderr mentions unsupported wire connector/arrow field |
| moodChips renderer | `tests/fixtures/board/valid-mood-chips.json` | renders 2-3 chips with kind labels |
| ctaSample renderer | `tests/fixtures/board/valid-cta-sample.json` | renders CTA text; no funnel/arrow markup |
| plain renderer | `tests/fixtures/board/valid-plain.json` | renders text-only card |
| restrained recommend | `tests/fixtures/board/valid-recommendation.json` | one small badge and reason; no checked, selected, aria-current, promoted order, or larger card class |
| recommendation consistency reject | `tests/fixtures/board/invalid-recommendation-number.json` | exits 2 |
| missing recommend reason reject | `tests/fixtures/board/invalid-recommendation-reason.json` | exits 2 |
| duplicate option numbers | `tests/fixtures/board/invalid-duplicate-numbers.json` | exits 2 |
| inert malicious content | `tests/fixtures/board/valid-inert-malicious-labels.json` | output escapes label text and contains no active script/handler/javascript/base/meta-refresh/iframe-srcdoc |
| remote URL in CSS/HTML fixture | `tests/fixtures/board/valid-inert-remote-url.json` | remote link/img/CSS url not present; CSP present |
| atomic write success | `tests/unit/board-cli.test.js` using `valid-brand-palette.json` | temp not left behind; out file replaced only after success |
| atomic write validation failure preserves existing file | `tests/unit/board-cli.test.js` using `invalid-dimension-palette.json` | previous sentinel HTML remains byte-identical |
| atomic write write failure | `tests/unit/board-cli.test.js` out path directory fixture | exits 2; no stack |
| concurrent unique temp last writer wins | `tests/unit/board-cli.test.js` launches two valid board writes to same out | final file is one complete HTML, no temp collision, no partial content |
| SKILL schema docs | `tests/unit/skill-doc-contract.test.js` if doc contract tests exist, otherwise manual review checklist `tests/fixtures/board/skill-phase1-contract.md` | docs state six-only dimension and questionKind/visualRole separation |

## Verification commands after implementation

Focused only; no project-wide build/test/lint during implementation verification unless maintainers request it.

- `node --test tests/unit/inert-html.test.js tests/unit/preview.test.js`
- `node --test tests/unit/board.test.js`
- `node --test tests/unit/board-cli.test.js tests/unit/cli.test.js`

## Release gates

1. All fixture-backed tests in the matrix pass.
2. Codex open/reload marker dry-run passes and is release-blocking:
   - First visual-capable round opens the stable board path exactly once.
   - Later rounds overwrite the same path without refocus/reopen.
   - `boardId`, `roundId`, `generatedAt` marker is visible after overwrite/reload.
   - Text AskUserQuestion appears in the same turn and remains the answer authority.
   - `openBoard(path)` unavailable path returns `{opened:false, reason}` and does not throw.
   - Failure of any above item blocks release of visual board integration, even if CLI tests pass.
3. Data-image display gate passes:
   - pre-sized png/jpeg/webp data URI renders in Codex/browser preview.
   - over-budget or unsupported imageFile exits 2 with no partial output.

## Risks and mitigations

1. Score dimension pollution: palette/asset could sneak back into `dimension`. Mitigation: enum validation plus invalid fixture tests.
2. Hidden image mutation: implementation may try to be helpful by resizing. Mitigation: no image processing function in board module; tests assert oversized image exits 2 rather than resized output.
3. Partial write exposure: direct write could corrupt stable dashboard. Mitigation: exclusive temp plus rename and sentinel preservation tests.
4. Codex marker unreliability: browser may not reload overwritten file. Mitigation: explicit release gate blocks feature until observed.
5. Recommendation overemphasis: renderer CSS may bias. Mitigation: fixture assertions for no promoted order, size, selected state, or dominant class.

## Handoff guidance

Use `executor` only after approval. Implementation should be split into schema/image/atomic board module and CLI/docs/test integration slices. Use `architect` to re-review the six-dimension schema and atomic write before coding if consensus requires it. This revision remains planning-only and makes no source changes.

## Consensus Resolution (binding final amendments)

ralplan deliberate 합의 결과: Architect stage-2 = WATCH/COMMENT(BLOCK 2건 해소), Critic stage-2 = OKAY/APPROVE. 아래 2건은 최종 구현에 반드시 반영하는 구속 수정이다:

1. magic-byte 검증 필수: imageFile MIME는 확장자만으로 수용 금지. png/jpeg/webp는 magic-byte(파일 시그니처)로 반드시 검증하고, 확장자와 시그니처 불일치는 exit 2. (계획 본문의 "where practical" 문구는 이 조항으로 대체한다.)
2. Codex open/reload 드라이런 = 릴리스 차단 게이트: 시각 보드 통합을 활성화하기 전, 첫 라운드 open / 이후 overwrite-only / stale 마커 가시성 / 포커스 비탈취를 Codex에서 실측한 marker 증거를 남긴다. 증거가 없으면 릴리스를 차단한다.

## ADR

- Decision: design-interview에 결정론 board CLI 레인(node src/cli.js board <options.json> --out <file>)과 inert HTML 빌더를 추가해 Phase 1 객관식 질문을 시각 보드로 띄운다. 보안 primitive(INERT_CSP/sanitizer)는 새 src/inert-html.js로 분리해 preview와 board가 공유하고 preview는 re-export로 호환한다. 호스트 표시는 renderBoard(optionsPath,outPath) + openBoard(path)->{opened,reason} seam으로 분리하고 Codex를 1차 어댑터로 연결한다. 단일 고정 대시보드를 open-once + overwrite-only + stale 마커로 운영한다. 답은 항상 채팅 질문으로 받고 보드는 inert 보조 시각이다.
- Drivers: (1) preview와 board 간 inert 보안 단일 소스, (2) src/cli.js의 exit 2/1 및 if-block 디스패치 관례에 최소 충격, (3) Codex open/reload의 경험적 리스크를 seam 뒤로 격리(CLI 성공과 open 성공을 분리).
- Alternatives considered:
  - inert 공유: A(preview.js에서 INERT_CSP export — 결합되고 preview 중심 이름), C(board 전용 sanitizer 복사 — 보안 드리프트로 무효). 채택: B(src/inert-html.js 모듈 분리).
  - host: Codex 하드코딩(host-agnostic seam 위반으로 거부). 채택: renderBoard/openBoard seam, GJC/Claude는 deferred.
  - 렌더 소스: 전부 인라인 생성 / 전부 실제 파일. 채택: 하이브리드(deep-interview에서 확정 — 그릴 수 있는 차원은 inert 생성, 실재는 실제 파일만).
- Why chosen: Option B는 보안 단일 소스와 레이어 분리 원칙을 둘 다 만족한다. seam은 host-agnostic을 유지하면서 Codex를 먼저 출시한다. 하이브리드는 S2(가짜-실재) 회피와 시각 가치를 동시에 달성한다.
- Consequences: preview.js 리팩터(re-export 호환 필요), 신규 모듈 2개(src/inert-html.js, src/board.js), src/cli.js board 블록, SKILL.md와 core/interview.md 갱신. Codex open/reload는 릴리스 게이트 드라이런 전까지 경험적 잔존이며 텍스트 질문이 authority다.
- Follow-ups (deferred/게이트): Codex open/reload 드라이런(릴리스 차단 게이트), data-image MIME/크기 실측, GJC browser와 Claude artifact 어댑터(deferred), 최종 결과 미리보기(deferred).

## Status

pending approval — ralplan 합의 완료(Architect WATCH/COMMENT + Critic OKAY). 실행(ultragoal/team)은 별도 승인 단계다. 자동 실행/구현 없음.
