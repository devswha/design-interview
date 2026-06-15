# Planner Plan (Revision 2): 폰트/타이포 신뢰 기계 검사

Architect pass-1(BLOCK/REQUEST CHANGES, stage-01-architect)의 6개 findings를 전부 반영한 개정. 변경 요지: **WARN을 finding으로 인코딩하지 않는다** — 시각 WARN 채널을 신설하고, fail 신호만 findings에 둔다.

## Architect findings 해소 매핑
| # | Architect finding | 개정 반영 |
|---|---|---|
| 1 (blocker) | 시각 WARN을 DE3 finding으로 합류 불가 | **시각 warnings 채널 신설** — `analyzeVisualTells()`→`{findings,warnings}`, `combineAudits()`가 static+visual warnings concat, `failed/slopScore/pass`는 warnings를 절대 안 봄 |
| 2 (major) | webfont ② computed font-family 비교는 현실 불일치 | **재정의**: computed 비교 폐기. "확정 fallback"만 WARN — 첫 선언 패밀리가 `@font-face` 선언인데 `document.fonts.check()`가 false인 경우로 한정. 애매하면 skip evidence |
| 3 (major) | 시각 fail이 benchmark 게이트에 안 걸림 | **회귀 전략 확정**: 시각 검사는 기존 전통대로 `geometry.test.js` clean/redteam 양면 픽스처로 고정. `baseline.json/benchmark.mjs`는 정적 전용 유지(L1/S3/TY1/TY2 선례 동일). puppeteer 미설치 시 `npm run benchmark` 안 깨짐 |
| 4 (major) | TY2 body fallback 지배 블록 기준 부족 | **가드 명문화**: `footer/nav/aside/small/figcaption/[aria-hidden]`·hidden/offscreen 제외, 80자+ 본문성 `<p>` 중 글자수 최대 + 충분한 visible text share인 블록만. clean no-main footer/legal 픽스처로 비발화 증명 |
| 5 (major) | 정적 B/C selector↔한글 텍스트 연결 불안정 | **보수적 조건**: inline style의 한글 요소, 또는 broad selector(`body`/`p`/heading)+문서 내 한글 존재 동시일 때만 WARN. 잡음 허용 범위를 테스트로 고정 |
| 6 (minor) | ID/문서 레인 taxonomy 불명확 | **arm-level lane table**: TY5-A=기계·시각 fail(전용 ID, DE3 아님), TY5-B/C=기계·정적 WARN, TY5-D/E=LLM. webfont WARN=별도 warning name(finding ID 아님) |

## RALPLAN-DR Summary (개정)
### Principles (5) — 유지
1. 결정론·환경무관 2. 오탐 0 우선 3. 단일 레인 1항목 4. 최소 변경·기존 구조 재사용 5. 한 커밋 원자성.
**추가 명문화**: WARN과 fail은 데이터 모델상 분리된 경로다(warnings 배열 vs findings). 채점(slopScore/pass)은 findings만.

### Decision Drivers (top 3) — 유지
1. 한글 눈에 보이는 깨짐 + 폰트 미적용 오측정 2. 오탐0 게이트 3. puppeteer 선택 의존.

### Viable Options
**Option 1 (채택, 개정)**: 시각 warnings 채널 신설 + fail은 findings. arm A=시각 fail(전용 ID), B/C=정적 WARN, webfont ①=정적 WARN, ②=시각 WARN(보수적), TY2=시각 fail(가드).
- pros: 스펙 WARN 의미·exit 규율·오탐0 모두 보존, 기존 findings/warnings 분리 존중.
- cons: `analyzeVisualTells()`/`combineAudits()` 시그니처 변경(findings→{findings,warnings}) — 호출부 갱신 필요.

**Option A2 (기각)**: WARN을 DE3 finding pass로 인코딩 — Architect Trade-offs 표대로 기각(WARN↔fail 의미 오염).
**Option 3 (기각)**: webfont를 fail 게이트 / 적극 metric probing — 환경 의존·헤드리스 잡음(R4/R6 + Architect #2).

## 구현 단계 (커밋 단위)

### Commit 0 (선행) — WARN 데이터 모델 확장 (리팩터, 동작 불변)
- `src/geometry.js` `analyzeVisualTells()`: 반환을 `{ findings, warnings }`로. 기존 호출부(`src/audit.js` `combineAudits`, 테스트)가 배열을 직접 쓰던 곳 호환 처리.
- `src/audit.js` `combineAudits(staticResult, visual)`: `visual`이 `{findings,warnings}`면 findings는 기존대로 병합, `warnings = [...staticResult.warnings, ...visual.warnings]`. `failed/slopScore/pass`는 findings만(불변).
- warning shape 통일: `{ name, lane: 'static'|'visual', evidence }`. `formatAuditReport()`가 두 레인 WARN 모두 출력.
- 테스트: 기존 통과 유지 + "visual warning은 exit 0, slopScore 불변" 단위 테스트.

### Commit 1 — 한글 조판
1. 시각(pageAnalyzer) arm A: 한글 보유 visible text block에서 `Range.getClientRects()` 라인 박스 수집. **보수적 fail 조건**: 같은 블록 내 raw text상 공백·구두점 없이 인접한 한글 완성형 음절 쌍이 실질적으로 다른 line box(top 차이 > 폰트크기 절반)에 놓일 때만. `<br>`/inline 요소 경계/vertical writing/transform/ruby 제외. 전용 finding ID(예 `TY5`)로 fail.
2. 정적(collectWarnings 확장) arm B/C: B=한글 본문 존재 + font-family 스택에 한글 폰트/sans-serif 제네릭 부재(broad selector 또는 inline 한정) WARN; C=한글 요소 inline 또는 broad selector `font-style:italic` WARN. lane:'static'.
3. 픽스처: clean(keep-all+폴백+비이탤릭) 통과; redteam 어절중간 줄바꿈(A fail), 폴백 미비(B warn), 한글 italic(C warn). 시각 arm은 `geometry.test.js` 양면, 정적 arm은 `audit.test.js`.
4. 문서 arm-level lane table 갱신, TY5-A/B/C만 LLM 체크리스트에서 제거(D/E 잔류). baseline은 정적 B/C가 WARN이라 failed에 안 들어가므로 변화 없음 — clean 픽스처 fp 가드만 확인.

### Commit 2 — 웹폰트 신뢰
1. 정적(collectWarnings) arm ①: `@import`/`<link href>`/`@font-face src`가 외부 도메인 원격 URL → WARN(자가호스팅·인라인 권장). lane:'static'.
2. 시각(pageAnalyzer) arm ②(보수적): 첫 선언 패밀리가 `@font-face`로 선언됐고 `document.fonts.check('<size> "<family>"')`가 false(미로드)인 경우만 "확정 fallback" WARN. 시스템 폰트 정상 폴백·애매한 경우는 skip evidence 카운트(WARN 아님). lane:'visual'.
3. 픽스처: clean(자가호스팅/인라인, 폰트 로드됨) 무경고; redteam CDN @import(① warn); @font-face 선언했으나 src 깨짐→check false(② warn). 시각은 geometry.test.js.

### Commit 3 — TY2 <main> skip 구멍
1. 시각(pageAnalyzer ty2): `<main>` 없으면 `<body>` 루트에서 지배 본문 블록 선택 — 제외: `footer/nav/aside/small/figcaption/[aria-hidden]`, hidden/offscreen. 80자+ `<p>` 중 글자수 최대 & visible text share 충분한 블록. 15.5px 미만 fail(전용 기존 TY2 ID).
2. 픽스처: 기존 `tests/redteam/no-main-small-paragraph.html`(이제 fail) + **신규 clean** `no-main-footer-legal`(작은 footer/약관만 작고 본문은 정상 → 비발화) 양면. geometry.test.js.

## Pre-mortem (3 시나리오) — 개정
1. **arm A 오탐**: Range rect가 inline 경계/whitespace collapse를 어절중간으로 오판. 완화: 보수 조건(공백·구두점 없는 인접 음절 + line box top 차이 임계 + br/inline/transform 제외), clean 한글 픽스처 회귀 가드.
2. **webfont ② 헤드리스 잡음**: 시스템 폴백 정상인데 WARN 도배. 완화: `@font-face` 선언 + `fonts.check` false 확정 케이스만, 나머지 skip evidence. WARN이라 무차단.
3. **TY2 footer 오탐**: footer/약관 small text를 본문으로 오판해 fail. 완화: 랜드마크/태그 제외 + dominance + clean no-main footer/legal 픽스처.

## 확장 테스트 계획 (개정)
- unit(audit.test.js): arm B/C/① 정적 WARN 정·오 케이스(보수 조건), TY2 <body> 폴백 블록 선택(제외 규칙 포함), **combineAudits가 visual warnings 보존 + slopScore/pass 불변** 회귀.
- integration/시각(geometry.test.js, puppeteer 게이트): arm A fail/통과 양면(오탐 가드 픽스처 포함), webfont ② 확정 fallback warn + 정상 skip, TY2 no-main fail + no-main footer/legal clean.
- e2e(pipeline.test.js): `audit --visual`이 arm A·TY2 fail에서 exit 1; B/C/①/② WARN은 exit 0 + 리포트에 WARN 라인.
- regression: 정적 baseline(`benchmark.mjs`)은 변경 없음(WARN은 failed 아님). 시각 회귀는 geometry.test.js 양면 픽스처가 담당. puppeteer 미설치 시 `npm run benchmark` 정적 그대로 green.
- observability: 리포트에 static/visual WARN 라인 + webfont ② "checked/skipped(reason)" 카운트(DE3 contrast 선례).

## 수용 기준 (스펙 상속 + 개정 보강)
스펙 8개 + 보강: (9) visual WARN은 exit 0·slopScore 불변 테스트 존재; (10) clean 한글/clean no-main-footer/clean self-host 픽스처가 fp 0 증명; (11) 문서 arm-level lane table에 승격분만 LLM에서 제거.
