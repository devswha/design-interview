**OKAY**

**Justification**: 개정안은 pass-1의 BLOCK 원인인 WARN/finding 혼합을 루트에서 분리한다. 실제 코드 확인 결과 `auditHtml()`는 `warnings`를 `findings/failed/slopScore/pass`와 별도로 반환하고, 현 `combineAudits()`는 visual findings만 병합하며 static warnings만 보존한다. 개정안의 Commit 0은 이 실제 결함에 맞춰 `analyzeVisualTells()`를 `{ findings, warnings }`로 확장하고 `combineAudits()`에서 static+visual warnings를 concat하되 채점은 findings만 보도록 지정하므로, 채택 Option과 Principles가 모순되지 않는다. Architect pass1의 6개 지적은 stage-02 개정 및 Architect pass2에서 모두 해소됐고, 대표 구현 경로를 현 파일에 대입해도 실행자가 추측 없이 진행 가능하다.

**Summary**:
- Clarity: 충분함. 채택 option은 visual WARN channel + fail-only findings로 명확하고, Commit 0~3 순서가 데이터 모델 선행 후 검사 추가로 정렬되어 있다.
- Verifiability: 충분함. arm A fail/clean, B/C/① static WARN, ② visual WARN, TY2 no-main fail/footer clean, visual WARN exit 0/slopScore 불변이 `audit.test.js`, `geometry.test.js`, `pipeline.test.js`, `benchmark.mjs` 역할과 연결된다. `pipeline.test.js`의 `audit --visual` exit code 경로도 `src/cli.js`의 `process.exit(result.pass ? 0 : 1)`와 직접 맞는다.
- Completeness: 충분함. 스펙의 hangul A/B/C, webfont ①/②, TY2 no-main, 문서 lane taxonomy, puppeteer 선택 의존, baseline 한커밋 원칙을 다룬다.
- Big Picture: 맞음. design-interview의 3레인 모델을 보존하고, 기계 승격분만 LLM 체크리스트에서 제거하도록 요구한다. `SKILL.md`, `core/design-principles.md`, `core/design-tells.md`, `CLAUDE.md`의 현재 TY5/레인 표기와 갱신 방향도 일치한다.
- Principle/Option Consistency: 일관됨. 오탐0은 fail arm에 집중하고, WARN은 warning 배열로 무차단 처리한다. 단일레인은 arm-level taxonomy로 유지하고, 한커밋 원자성은 커밋별 코드+fixture+문서/baseline 갱신으로 반영된다.
- Alternatives Depth: 실행 전 의사결정에 충분함. WARN을 finding으로 넣는 안은 현 `combineAudits()`/`formatAuditReport()` 구조상 fail 오염 또는 WARN 미표시가 되어 공정하게 기각됐다. webfont fail gate 및 적극 metric probing은 headless/network/system-font 잡음과 puppeteer 선택 의존 훼손 때문에 기각됐고, 보수적 FontFaceSet WARN으로 좁힌 결정이 합리적이다.
- Risk/Verification Rigor: deliberate 기준 충족. pre-mortem 3개 시나리오가 각각 구체적이다: arm A는 Range rect 오판을 공백 없는 인접 한글 음절, line-box top 임계, br/inline/transform/ruby/vertical 제외 및 clean fixture로 막는다. webfont ②는 at-font-face 선언 + `document.fonts.check()` false 확정 케이스만 WARN하고 ambiguous case는 skip evidence로 남긴다. TY2 footer 오탐은 landmark/tag/visibility 제외, dominance/share 기준, clean no-main footer/legal fixture로 완화한다.

**Referenced artifacts verified**:
- `.gjc/plans/ralplan/2026-06-13-1410-fonttrust/stage-02-revision.md`: 평가 대상. Principles, options, commits, pre-mortem, expanded tests, acceptance criteria 확인.
- `.gjc/specs/deep-interview-font-trust-checks.md`: 원본 범위 확인. A만 fail, B/C/①/② WARN, TY2 no-main fail, puppeteer optional, no double scoring.
- `.gjc/plans/ralplan/2026-06-13-1410-fonttrust/stage-01-architect.md`: BLOCK 원인 확인. visual WARN path 부재, webfont API 현실, visual benchmark gap, TY2/footer risk, B/C selector risk, taxonomy gap.
- `.gjc/plans/ralplan/2026-06-13-1410-fonttrust/stage-02-architect.md`: CLEAR/APPROVE 및 6 findings 해소 확인.
- `src/audit.js`: `collectWarnings`, `auditHtml`, `combineAudits`, `formatAuditReport` 확인. 현재 warnings는 채점에서 분리되어 있고 visual warning concat은 아직 없어 Commit 0 위치가 정확하다.
- `src/geometry.js`: `pageAnalyzer()`, TY2 `<main>` skip, `document.fonts.ready`, `analyzeVisualTells()` array return 확인. return shape 변경과 TY2 body fallback 위치가 정확하다.
- `tests/quality/benchmark.mjs`: `auditHtml(html).failed`만 비교하는 정적 baseline 확인. visual checks를 geometry tests에 두겠다는 개정은 현 구조와 맞다.
- `tests/unit/geometry.test.js`: puppeteer skip guard, visual findings tests, combineAudits tests, TY2 no-main current skip test 확인. 개정 테스트가 들어갈 실제 위치가 있다.
- `tests/unit/audit.test.js`: static audit 및 warnings/report 테스트 확장 위치 확인.
- `tests/e2e/pipeline.test.js`: `audit --visual` CLI exit/report 검증 위치 확인.

**Representative implementation simulation**:
1. Visual WARN channel: `analyzeVisualTells()`가 `{ findings, warnings }`를 반환하면 현재 `tests/unit/geometry.test.js`의 direct array usages는 갱신이 필요하다. 개정안은 compatibility 또는 callsite 갱신과 `combineAudits()` normalize를 명시한다. `combineAudits()`에서 array legacy와 object shape를 모두 normalize하면 CLI와 기존 imports가 깨지지 않는다. visual warning을 `warnings`에만 concat하면 `failed`, `slopScore`, `pass` 산식이 변하지 않아 exit 0 테스트가 가능하다.
2. Hangul A/B/C: A는 `pageAnalyzer()` 내부에서 `Range.getClientRects()`와 기존 `isVisible()`를 재사용하는 경로가 맞고, fail ID는 findings에 둔다. B/C는 `collectWarnings()` 확장 위치가 맞으며, regex selector 한계를 broad selector/inline 조건으로 좁혔으므로 WARN 잡음이 fail로 오염되지 않는다.
3. TY2 no-main fallback: 현재 `mainEl && mainEl.contains(p)`가 `<main>` 없는 페이지를 skip한다. body root fallback을 이 arm에 추가하고 `footer/nav/aside/small/figcaption/[aria-hidden]` 및 hidden/offscreen exclusion을 기존 `isVisible()`와 함께 쓰면 spec gap을 닫는다. `tests/redteam/no-main-small-paragraph.html`의 기대는 fail로 바뀌고, 신규 clean footer/legal fixture가 오탐0 guard가 된다.

**Required fixes**: 없음. 구현 중 watchpoint: expanded test plan의 unit 항목에 적힌 TY2 body fallback selection은 실제 브라우저 DOM/geometry 성격상 `geometry.test.js`가 주 검증 위치다. helper를 추출하지 않는 한 `audit.test.js`에 억지로 넣지 말고, 개정안의 integration/visual 항목처럼 `geometry.test.js` 양면 fixture로 고정하면 된다.
