# Architect Review Pass 2: fonttrust revision

## Summary
개정안은 pass-1의 핵심 BLOCK 원인인 WARN과 finding 혼합을 데이터 모델 차원에서 분리하도록 고쳤다. 6개 finding은 모두 실질 해소로 판정하며, 남은 사항은 구현 시 확인해야 할 비차단 watchpoint다. BLOCK은 해제한다.

## Analysis

### Stage 1 — Spec compliance
- 원본 스펙은 한글 A만 fail, 한글 B/C와 webfont ①/②는 WARN, TY2 no-main은 fail 보강을 요구한다. 개정안은 TY5-A를 시각 fail 전용 ID, B/C를 정적 WARN, D/E를 LLM 잔류, webfont WARN을 warning name으로 분리해 이 요구와 일치한다.
- 현 코드에서 WARN은 이미 findings와 분리돼 있다. `src/audit.js:540-550`의 `collectWarnings()`가 별도 배열을 만들고, `src/audit.js:567-582`의 `auditHtml()`가 `warnings`를 반환하지만 `failed`, `slopScore`, `pass` 산식은 findings만 본다.
- pass-1의 불일치는 `src/audit.js:591-617`의 `combineAudits()`가 visual findings만 순회하고 `warnings: staticResult.warnings`만 보존하는 데서 발생했다. 개정안의 Commit 0은 `analyzeVisualTells()`를 `{ findings, warnings }`로 확장하고 `combineAudits()`가 static+visual warnings를 concat하도록 해 이 결함을 정면으로 수리한다.
- `src/audit.js:620-628`의 `formatAuditReport()`는 `result.warnings`만 WARN 라인으로 출력한다. 따라서 visual WARN이 이 배열로 들어오면 report와 exit 규율이 모두 스펙대로 유지된다.

### Stage 2 — Architecture and boundary fit
- `src/geometry.js:302-320`의 현재 `analyzeVisualTells()`는 findings 배열만 반환한다. 개정안은 이 경계를 변경하되 `combineAudits()`에서 legacy 배열 입력을 계속 받는 방향을 명시하므로 CLI 경로는 유지 가능하다. `src/cli.js:60-69`는 visual 결과를 그대로 `combineAudits()`에 전달하므로 normalize 지점은 `combineAudits()`가 맞다.
- 직접 배열을 가정하는 내부 테스트가 많다. 예: `tests/unit/geometry.test.js:13-31`은 `findings.find()`와 `findings.every()`를 직접 호출한다. 개정안이 말한 호출부 갱신 또는 compatibility 처리 대상이 맞다. 이것은 구현 체크리스트이지 설계 blocker는 아니다.
- benchmark 분리는 현 구조와 일치한다. `tests/quality/benchmark.mjs:19-26`은 `auditHtml(html).failed`만 비교하고 visual lane을 호출하지 않는다. `tests/quality/baseline.json`도 warnings 제외와 visual L1은 `geometry.test.js`에서 잡힌다는 note를 이미 갖고 있다. 개정안의 geometry.test.js 양면 fixture 전략은 선례와 맞다.
- 문서 taxonomy도 현 문서 상태를 정확히 겨냥한다. `core/design-principles.md:66`은 TY5 전체를 LLM으로 둔다. `SKILL.md:110-111`은 기계 레인과 LLM 레인을 분리하고 TY5를 LLM에 남긴다. 개정안의 arm-level lane table과 LLM 체크리스트 부분 제거는 이중채점 금지 원칙에 맞다.

### Stage 3 — Quality, correctness, and failure modes
- webfont ②는 computed `font-family` 비교를 폐기하고, 첫 선언 family가 `@font-face`이며 `document.fonts.check(...)`가 false인 확정 fallback만 WARN한다. 이는 실제 glyph used font를 증명하지는 않지만, 헤드리스 환경 잡음을 fail로 승격하지 않고 애매한 케이스를 skip evidence로 남기므로 스펙의 WARN 경계와 결정론 원칙을 지킨다.
- TY2 body fallback은 `src/geometry.js:170-192`의 현재 `<main>` 내부만 검사하는 arm b 구멍을 메우는 정확한 위치다. 개정안은 footer/nav/aside/small/figcaption/[aria-hidden] 및 hidden/offscreen 제외, 80자 이상 본문성 p, dominance 및 visible text share, clean no-main footer/legal fixture를 요구하므로 pass-1의 오탐 우려를 충분히 낮춘다.
- 정적 B/C는 현 regex CSS parser의 selector matching 한계를 인정하고 inline 한글 요소 또는 broad selector plus 문서 내 한글 존재로 좁혔다. WARN이므로 일부 보수적 miss와 낮은 수준의 false warning은 수용 가능한 trade-off다.

## Root Cause
pass-1의 근본 원인은 “DE3 warn channel”을 finding 내부 arm처럼 취급한 계획상의 모델 오류였다. 실제 코드는 WARN을 `warnings` 배열에 두고 findings와 채점을 분리한다. 개정안은 visual warnings 채널을 신설하고 병합 계층에서 warnings를 concat하도록 바꿔 root cause를 제거했다.

## Findings

### 1. 해소됨 — visual WARN channel and WARN/fail separation
- **Reference**: `src/audit.js:540-550`, `src/audit.js:567-582`, `src/audit.js:591-617`, `src/audit.js:620-628`, `src/geometry.js:302-320`, `src/cli.js:60-69`.
- **판정**: 해소. visual WARN을 finding으로 넣지 않고 `{ findings, warnings }`로 분리하면 `failed`, `slopScore`, `pass`가 findings만 보는 구조를 그대로 유지한다. WARN이 fail로 오염되는 경로가 사라진다.
- **호환성**: 내부 CLI는 `combineAudits()` normalize로 흡수 가능하다. 직접 array를 가정하는 `geometry.test.js`와 외부 direct import 사용자는 갱신 대상이다. 계획이 “기존 호출부 호환 처리”를 명시했으므로 비차단이다.
- **Fix suggestion**: `combineAudits(staticResult, visual)`에서 `Array.isArray(visual) ? visual : visual.findings ?? []` 및 `visual.warnings ?? []` normalize를 먼저 수행하고, visual warning exit 0 및 slopScore 불변 테스트를 Commit 0에 둔다.

### 2. 해소됨 — webfont ② headless-noise reduction
- **Reference**: `src/geometry.js:309-312`는 `document.fonts.ready` 후 브라우저 내부 값을 읽는다.
- **판정**: 해소. computed family 비교를 버리고 `@font-face` 선언 family plus `document.fonts.check(...) === false`인 확정 fallback만 WARN으로 낮춘 것은 헤드리스 시스템 폰트 차이에서 오는 잡음을 크게 줄인다.
- **Residual risk**: `document.fonts.check()`는 glyph별 paint font 증명이 아니라 FontFaceSet availability 신호다. 따라서 일부 실제 fallback은 miss될 수 있다. 하지만 WARN arm이고 ambiguous 케이스는 skip evidence로 남기므로 architecture blocker가 아니다.
- **Fix suggestion**: warning evidence에 checked count와 skipped reason을 포함하고, remote CDN 실패는 static webfont ① WARN과 중복돼도 fail로 오염되지 않게 한다.

### 3. 해소됨 — visual regression gate strategy
- **Reference**: `tests/quality/benchmark.mjs:19-26`, `tests/quality/baseline.json`, `tests/unit/geometry.test.js:13-31`.
- **판정**: 해소. benchmark는 정적 `auditHtml().failed` 전용이고 puppeteer를 요구하지 않는다. visual checks는 기존 L1/S3/TY1/TY2 선례처럼 `geometry.test.js`에서 clean/redteam 양면 fixture로 고정하는 편이 현재 구조와 맞다.
- **Fix suggestion**: visual fail IDs를 baseline에 넣지 않는다. arm A, webfont ②, TY2 no-main은 `geometry.test.js`에 양면 fixture와 puppeteer skip guard를 둔다.

### 4. 해소됨 — TY2 body fallback false-positive guard
- **Reference**: `src/geometry.js:170-192`.
- **판정**: 해소. 기존 arm b는 `<main>` 없으면 조용히 skip한다. 개정안의 body-root dominance fallback은 스펙의 scale gap을 닫고, footer/legal/caption/nav 등 비본문 exclusion과 clean no-main footer/legal fixture로 fail arm 오탐0 원칙을 방어한다.
- **Residual risk**: visible text share의 numeric threshold는 구현에서 확정돼야 한다. 이 값은 테스트 픽스처와 evidence로 고정하면 충분하다.
- **Fix suggestion**: no-main fail fixture와 no-main footer/legal clean fixture를 같은 test block에 두고, hidden/offscreen exclusion이 기존 `isVisible()` 규율을 재사용하는지 확인한다.

### 5. 해소됨 — static Hangul B/C within regex parser limits
- **Reference**: `src/audit.js:117-135`의 `extractCssRules()`는 regex 기반 style/rule 평탄화이고 실제 selector matching은 하지 않는다.
- **판정**: 해소. inline 한글 요소 또는 broad selector plus 문서 내 한글 존재로 제한한 것은 현재 parser 한계 안에서 실행 가능하다. WARN arm이므로 일부 miss를 택하고 잡음을 줄이는 설계가 맞다.
- **Residual risk**: broad selector warning은 더 구체적인 후속 selector가 올바른 한글 stack을 적용하는 페이지에서 false warning을 낼 수 있다. 비차단 WARN이고 테스트로 허용 범위를 고정하면 수용 가능하다.
- **Fix suggestion**: `collectWarnings()`를 `html, rules, vars` 입력으로 확장하거나 내부에서 rules를 재사용하도록 해 중복 parser divergence를 만들지 않는다.

### 6. 해소됨 — arm-level lane taxonomy
- **Reference**: `core/design-principles.md:66`, `SKILL.md:110-111`, `CLAUDE.md:42-44`.
- **판정**: 해소. TY5-A는 시각 fail, TY5-B/C는 정적 WARN, TY5-D/E는 LLM 잔류, webfont는 finding ID가 아닌 warning name으로 분리한다는 표기가 명확하다. DE3 denominator와 TY5 ontology가 섞이지 않는다.
- **Fix suggestion**: SKILL.md, core/design-principles.md, core/design-tells.md, CLAUDE.md의 레인 설명을 같은 커밋에서 갱신한다.

## Recommendations
1. Commit 0을 반드시 먼저 적용한다. visual warning channel, `combineAudits()` normalize, report output, visual WARN exit 0 및 slopScore 불변 테스트가 이후 구현의 전제다.
2. `analyzeVisualTells()` 반환 shape 변경은 내부 callsite와 tests를 전부 갱신한다. legacy array input은 `combineAudits()`에서만 보장하면 충분하다.
3. webfont ②는 “확정 fallback WARN” 문구를 유지하고, computed `font-family` 비교나 metric probing을 fail 조건으로 확장하지 않는다.
4. TY2 body fallback은 fail arm이므로 dominance/share threshold와 exclusion evidence를 테스트 이름에 드러낸다.
5. 문서 레인 표는 arm-level로 써서 TY5-D/E LLM 잔류와 A/B/C 기계 승격이 동시에 보이게 한다.

## Architectural Status
`CLEAR`

## Code Review Recommendation
`APPROVE`

## Trade-offs
| Option | Benefit | Cost | Decision |
|---|---|---|---|
| Visual WARN as finding | 작은 변경 | WARN이 fail/pass 채점에 섞임 | 기각 유지 |
| Visual `{ findings, warnings }` channel | WARN semantics, exit 규율, 이중채점 방지 | return shape 변경과 callsite 갱신 | 채택 |
| webfont computed family comparison | 구현 쉬움 | 실제 used font 증명 불가, headless false warning | 기각 |
| webfont `@font-face` plus `fonts.check` false only | 헤드리스 잡음 최소, nonblocking WARN | fallback miss 증가 | 채택 |
| visual benchmark 확장 | baseline 하나로 통합 | puppeteer 선택 의존과 `npm run benchmark` 안정성 위협 | 기각, geometry.test 유지 |
| TY2 body dominance fallback | `<main>` 누락 구멍 폐쇄 | legal/cookie text 오탐 위험 | exclusion plus clean fixture로 채택 |
