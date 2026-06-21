# 시각 인터뷰 보드 구현 계획 — planner stage 1

## Summary

Phase 1 객관식 질문에 붙는 시각 보드를 새 결정론 CLI 레인 `node src/cli.js board <options.json> --out <file>`로 생성한다. CLI는 options.json 검증과 inert 단일 HTML 직렬화, atomic overwrite만 담당한다. 옵션 생성, recommend 판단, 호스트 open, 사용자 답변 수집은 SKILL/host-display 레이어가 담당한다. 이 계획은 `.gjc/specs/deep-interview-visual-interview.md`의 7대 락포인트와 수용기준을 구현 단계, 파일, 테스트에 매핑한다.

## RALPLAN-DR

### Principles

1. Two-layer discipline: board CLI는 판단 없는 serializer만 한다. 추천 선정, 점수, 호스트 감지, 질문 제출은 SKILL/host-display에 남긴다.
2. Inert by construction: 무스크립트, 단일 HTML, 원격 리소스 차단, CSP script-src none 및 img-src data를 보장한다.
3. Rhythm preservation: 보드는 입력 UI가 아니며 텍스트 질문은 항상 같은 턴에 제출된다. 첫 라운드 1회 best-effort open, 이후 overwrite-only다.
4. No fake reality: reference/asset은 실제 파일과 sidecar가 있을 때만 data URI로 임베드한다. 없거나 예산 초과면 plain으로 강등하고 생성하지 않는다.
5. Opinion without convergence: recommend는 작은 동급 배지와 근거 한 줄만 허용한다. 우위 배치, preselect, 채택률 지표는 금지한다.

### Decision Drivers top 3

1. 보안과 inert 공유: preview와 board가 같은 sanitizer/CSP primitive를 써야 한다.
2. 브라운필드 최소 충격: `src/cli.js`의 if-block 레인 구조와 exit 2/1 규율을 그대로 따른다.
3. 호스트 리스크 격리: Codex open/reload는 경험적이므로 CLI 성공과 open 성공을 분리하고 open 실패는 `{opened:false, reason}`으로 관측한다.

### Viable Options

#### Option A — `src/preview.js`에서 `INERT_CSP` export

Pros: diff가 작고 기존 preview 테스트 영향이 적다. Cons: board가 preview chrome/radio-hack 모듈에 결합되고 이름도 preview 중심이다. Boundary: 빠른 패치에는 가능하지만 레이어 분리 원칙이 약하다.

#### Option B — `src/inert-html.js` 모듈 분리 선택

Pros: `INERT_CSP`, `stripActiveContent`, CSS 원격 URL neutralizer를 preview와 board의 단일 보안 소스로 둔다. board가 preview chrome에 의존하지 않는다. 공유 fixture 테스트가 쉬워진다. Cons: `preview.js` import와 re-export 조정이 필요하다. Decision: Option B를 채택한다. `preview.js`는 기존 테스트 호환을 위해 `stripActiveContent`를 re-export한다.

#### Option C — board 전용 sanitizer 복사

Pros: 가장 국소적이다. Cons: 보안 픽스가 갈라지고 스펙의 sanitize/CSP 공유를 위반한다. Decision: 무효 대안이다.

#### Host-display option

Codex hardcode는 빠르지만 host-agnostic seam을 위반한다. `renderBoard(optionsPath,outPath)`와 `openBoard(path)->{opened,reason}` seam을 선택한다. Codex adapter만 1차 연결하고 GJC/Claude는 같은 인터페이스 뒤 deferred로 둔다.

### Pre-mortem

1. Inert 우회: script, handler, javascript URL, base, meta refresh, iframe srcdoc, remote link/img/CSS url이 살아남는다. Mitigation: `src/inert-html.js` 공유 primitive와 board/preview 공통 악성 fixture.
2. data URI 폭증: fullPage PNG를 그대로 넣어 HTML이 과대해진다. Mitigation: png/jpeg/webp whitelist, per-image byte cap, total board HTML cap, thumbnail만 허용, 초과 시 plain 강등 또는 입력 오류.
3. stale 보드 오독: overwrite-only라 사용자가 이전 화면을 볼 수 있다. Mitigation: boardId/roundId/generatedAt marker를 상단에 표시하고 Codex dry-run에서 reload/marker 가시성을 확인한다.

## In scope / out of scope

### In scope

- `board` CLI 레인과 required `--out`.
- options schema validation: `schemaVersion`, `roundId`, `dimension`, `question`, `recommendedNumber|null`, `recommendReason|null`, `options[]`.
- visual discriminated union: `swatches`, `wire`, `moodChips`, `ctaSample`, `imageFile`, `plain`.
- inert board HTML builder with `#dsiv-board-root`, card/list board chrome, stale marker, restrained recommend badge.
- fixed-path atomic write via temp plus rename.
- imageFile budget and real file plus sidecar rule.
- SKILL Phase 1 render/open seam and no-browser text fallback.

### Out of scope

- Final result preview.
- Board-as-input UI.
- GJC browser or Claude artifact implementation beyond deferred seam.
- Missing image/logo/reference generation.
- Project-wide build/test/lint or formatter during planning.

## File-level changes

### `src/cli.js`

- Add `board` to whitelist and usage.
- Insert `if (cmd === "board")` before preview parsing.
- Parse exactly one positional options JSON and required `--out <file>`.
- Missing options, missing `--out`, bad JSON, schema error, missing asset, missing sidecar, over budget, write failure exit 2 with clean message and no stack.
- Renderer invariant or impossible normalized state exits 1.
- Lazy import `./board.js` to keep other lanes unchanged.

### `src/inert-html.js` new

- Export `INERT_CSP` with default-src none, img-src data, style-src unsafe-inline, font-src data, frame-src none, script-src none.
- Export `stripActiveContent(html)` and CSS neutralization helpers currently used by preview.
- Preserve current behavior: remove script/base/meta refresh, strip iframe srcdoc, remove inline handlers, neutralize javascript URLs, strip remote links/media, neutralize CSS imports and remote/javascript url().

### `src/preview.js`

- Import inert primitives from `src/inert-html.js`.
- Re-export `stripActiveContent` and optionally `INERT_CSP` for compatibility.
- Keep preview chrome and `buildPreviewHtml` behavior unchanged.

### `src/board.js` new

- Export `parseBoardOptions`, `buildBoardHtml(boardModel)`, and `renderBoardFile(optionsPath,outPath)`.
- Validate schema by explicit Pure ESM code, no new runtime dependency.
- Fields:
  - `schemaVersion`: exact supported version 1.
  - `boardId`: preferred required stable session id for marker.
  - `roundId`: required string.
  - `dimension`: audience, mood, brand, structure, conversion, reference, asset, palette if palette remains a board alias.
  - `question`: non-empty string.
  - `recommendedNumber`: option number or null.
  - `recommendReason`: non-empty iff recommendedNumber is not null, otherwise null.
  - `options`: non-empty array with unique number, label, rationale, visual.
- visual union:
  - `swatches`: limited color chips with hex and optional label, no gradients.
  - `wire`: abstract priority blocks only, no nodes, edges, arrows, or box-line diagrams.
  - `moodChips`: 2 to 3 color/type/texture chips.
  - `ctaSample`: text/button sample only, no funnel or arrow diagram.
  - `imageFile`: local png/jpeg/webp file with alt, kind reference or asset, sidecar path or adjacent sidecar.
  - `plain`: text fallback for audience, direct input, none, missing declared visual, or over-budget cases.
- Builder:
  - Root `#dsiv-board-root`, `dsiv-board-*` classes.
  - CSP meta from `INERT_CSP`.
  - Visible marker: boardId, roundId, generatedAt ISO.
  - Card numbers match text AskUserQuestion options.
  - Direct input/none cards equal visibility.
  - Recommend badge is small and neutral; no larger card, no brighter card, no order promotion, no checked/selected/preselect state.
- Image policy:
  - Resolve relative image paths from options file directory.
  - Require regular file and sidecar metadata.
  - Whitelist MIME png/jpeg/webp by extension plus magic bytes where practical.
  - Enforce per-image byte cap and total HTML cap before base64 embedding.
  - Do not embed fullPage screenshots from `captureFile` directly. First pass accepts only pre-derived small thumbnails or degrades/rejects.
- Atomic write:
  - Write temp file in same directory, then rename to outPath.
  - Clean temp best-effort on failure.

### `src/assets.js`

- Reuse exported `parseSidecar` and `classifyKind` for board image validation.
- Keep assets audit advisory only; S2 final judgment remains LLM lane.

### `src/screenshot.js`

- No behavior change in first pass. Plan explicitly forbids embedding fullPage PNG unless a thumbnail already satisfies caps.

### `core/interview.md`

- Add visual board note under round/recommend guidance: LLM prepares the same options for board and text question; board is advisory; text/free input wins; recommend badge mirrors recommend policy without preselect.

### `SKILL.md`

- Phase 1 insertion point:
  1. Compose weakest-dimension question and options.
  2. Build options.json with schema fields and visual union.
  3. Call `renderBoard(optionsPath,outPath)`.
  4. On first visual-capable Codex round only, call `openBoard(outPath)` best effort.
  5. Always submit the text AskUserQuestion in the same turn.
  6. Later rounds overwrite same stable path once per round and do not reopen.
- Define seam: `renderBoard(optionsPath,outPath)->{path}` and `openBoard(path)->{opened,reason}`.
- Document no-browser fallback: skip open and continue with current text interview.
- Document observability: keep `openBoard.reason` available without turning it into user noise.

## Sequencing and dependencies

1. Extract inert primitives to `src/inert-html.js`; update preview import/re-export; run focused preview/inert tests after implementation.
2. Implement board validators and image budget logic in `src/board.js`; unit-test schema reject matrix.
3. Implement `buildBoardHtml`; unit-test all visual types, stale marker, recommend badge, inert output, anti-tell fixtures.
4. Wire `src/cli.js` board block before preview; add required `--out`; classify exit 2 versus exit 1; integration-test atomic overwrite.
5. Update `SKILL.md` and `core/interview.md` Phase 1 guidance.
6. Perform manual/e2e Codex open/reload dry-run and data-image display measurement before release approval.

## Acceptance criteria mapping

| Requirement | Steps | Files | Tests |
|---|---|---|---|
| board CLI contract, dispatch before preview, usage, `--out`, schema, exit matrix | 2,4 | `src/cli.js`, `src/board.js` | board unit and board CLI tests |
| inert builder, shared sanitizer/CSP, board root, atomic write, stale marker | 1,3,4 | `src/inert-html.js`, `src/preview.js`, `src/board.js` | inert shared fixtures, board render tests, atomic integration |
| host-display seam and open failure non-exception | 5,6 | `SKILL.md` | manual Codex/no-browser dry-run |
| stable lifecycle open once and overwrite-only | 4,5,6 | `SKILL.md`, `src/board.js` | marker assertions, manual lifecycle dry-run |
| reference/asset data-image budget and real file plus sidecar only | 2,3,6 | `src/board.js`, `src/assets.js`, `src/screenshot.js` note | image validation and display measurement |
| anti-tell guard and restrained recommend | 3,5 | `src/board.js`, `core/interview.md`, `SKILL.md` | S6/S4/C1/L1/S2 redteam fixtures |
| SKILL Phase 1 integration and text fallback | 5 | `SKILL.md`, `core/interview.md` | doc contract review and manual fallback |
| Residual risk Codex dry-run | 6 | `SKILL.md` seam | open/reload manual evidence |
| Residual risk data-image measurement | 6 | `src/board.js` | real png/jpeg/webp sample measurement |

## Verification

### Unit

- `node --test tests/unit/inert-html.test.js tests/unit/preview.test.js`
- `node --test tests/unit/board.test.js`
- Cover every visual.type render path.
- Cover schema rejects: missing required fields, unsupported schemaVersion, duplicate numbers, bad recommendation, invalid dimension, invalid visual payload.
- Cover image rejects/degrades: missing file, missing sidecar, unsupported MIME, over per-image cap, over total HTML cap.
- Cover anti-tell fixtures: S6 node/box-line, C1 gradient, L1 uniform grid, S2 fake image, S4 generic image fallback.

### CLI and integration

- `node --test tests/unit/board-cli.test.js tests/unit/cli.test.js`
- End-to-end board input to HTML to required out path.
- Atomic overwrite keeps old file when validation fails and updates marker when successful.
- Exit matrix: input/schema/missing asset/write failure equals 2; renderer invariant equals 1; no stack trace for user errors.

### Inert/security assertions

- Assert absence of active script, inline handlers, javascript URLs, base, meta refresh, iframe srcdoc, remote link/img/source, remote CSS url, CSS import.
- Assert CSP contains default-src none, script-src none, img-src data, frame-src none.
- Reuse malicious fixtures for preview and board.

### E2E/manual

- Codex open/reload dry-run: first round opens once, later rounds overwrite only, marker visible and changes, focus does not flicker, text question appears same turn.
- No-browser run: board open skipped or returns `{opened:false, reason}`, text interview remains normal.
- Data-image measurement: png/jpeg/webp thumbnails display; oversized/fullPage files do not embed.

### Observability

- Board marker visibly shows boardId, roundId, generatedAt.
- Host seam records openBoard reason.
- CLI success prints only outPath, matching preview convention.

## Risks and mitigations

1. Schema becomes judgment layer. Mitigation: validators check shape, safety, budget only. Recommendation comes from SKILL.
2. Board becomes input UI. Mitigation: no form controls, no checked/selected, no handlers, explicit copy that answer happens in chat.
3. Recommend dominates. Mitigation: neutral small badge, same card size/order, render assertions for no dominance.
4. Image thumbnails need dependencies. Mitigation: no new runtime dependency; only pre-derived small files embed, others plain/reject.
5. Preview refactor breaks imports. Mitigation: preview re-export and focused preview tests.
6. Codex reload unreliable. Mitigation: marker plus manual dry-run; text question remains authority.
7. Board grid resembles L1. Mitigation: avoid product-like three-column icon/title/two-line template; use varied visual primitives and redteam guard.

## Handoff guidance

- Use `executor` for implementation, preferably two slices: inert plus board module/tests, then CLI plus SKILL/core docs/tests.
- Use `architect` for read-only review if the `src/inert-html.js` split or host seam placement is disputed.
- Use `critic` for deliberate plan critique if required by consensus workflow.
- Use `team` only if approved implementation is parallelized.
- Use `ultragoal` only if this grows into a longer release ledger.

## Plan status

Draft ready for ralplan deliberate review. No product source was edited, no tests/build/lint were run, no formatter was invoked, and no implementation command was executed.
