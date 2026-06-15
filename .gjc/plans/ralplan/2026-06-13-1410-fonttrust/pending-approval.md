# 합의 계획 (pending approval): 폰트/타이포그래피 신뢰 기계 검사

- run-id: 2026-06-13-1410-fonttrust
- 입력 스펙: `.gjc/specs/deep-interview-font-trust-checks.md`
- 합의: Planner(rev2) → Architect pass1 **BLOCK** → 개정(rev2) → Architect pass2 **CLEAR/APPROVE** → Critic pass2 **OKAY (필수 수정 없음)**
- 모드: deliberate
- 상태: **pending approval** (실행은 별도 승인 게이트)

## ADR

**Decision**: design-interview에 폰트/타이포 신뢰 검사를 추가하되, **fail 신호는 findings, WARN 신호는 별도 warnings 배열**로 분리한다. 시각 레인에 warnings 채널을 신설(`analyzeVisualTells()`→`{findings,warnings}`, `combineAudits()`가 static+visual warnings concat, 채점은 findings만)하고, 그 위에 3개 검사군을 얹는다.

**Drivers**:
1. 사용자 핵심 불안 = 한글이 눈에 보이게 깨지는 것 + 폰트 미적용 오측정(deep-interview R1/R2).
2. clean 픽스처 오탐 0 — 벤치마크 회귀 게이트가 강제. fail은 렌더된 사실에만.
3. puppeteer 선택 의존 — 정적/단위는 미설치에서도 동작.

**Alternatives considered**:
- WARN을 DE3 finding `pass`로 인코딩 → `pass=false`면 exit 1(WARN 무차단 위반), `pass=true`면 WARN 미표시. **기각**(Architect 코드 확인).
- webfont를 fail 게이트 / computed `font-family` 비교 / 적극 metric probing → 헤드리스 네트워크·시스템폰트 잡음, 환경 의존. **기각**.
- 시각 fail을 `benchmark.mjs` baseline에 통합 → puppeteer 미설치 시 `npm run benchmark` 붕괴. **기각**, 기존 L1/S3/TY1/TY2 선례대로 `geometry.test.js` 양면 픽스처 유지.

**Why chosen**: 채택안만이 스펙의 WARN 의미·exit 규율·오탐0·이중채점 금지·puppeteer 선택 의존을 모두 보존하며, 기존 findings/warnings 분리 구조를 그대로 존중한다.

**Consequences**:
- (+) WARN과 fail 의미가 데이터 모델로 분리돼 향후 모든 WARN 검사가 안전하게 합류 가능.
- (−) `analyzeVisualTells()` 반환 shape 변경 → 내부 callsite/테스트 갱신 필요(`combineAudits()`에서 legacy 배열 normalize로 흡수).
- webfont ②는 "확정 fallback"만 잡으므로 일부 실제 fallback miss 허용(WARN이라 무차단).

**Follow-ups**: D/E(한글 자간·행간), TY4 var()-only 스택, TY1 스케일 비율, axe-core 접근성 floor는 본 계획 범위 밖(별도 트랙).

## RALPLAN-DR Summary
**Principles**: ①결정론·환경무관 ②오탐0 우선 ③단일레인 1항목(이중채점 금지) ④최소변경·기존구조 재사용 ⑤한 커밋 원자성. **+WARN과 fail은 분리 경로**(warnings vs findings; 채점은 findings만).
**Decision Drivers**: ①한글 가시 깨짐+오측정 ②오탐0 게이트 ③puppeteer 선택의존.
**채택 Option**: 시각 warnings 채널 신설 + fail은 findings. (대안 기각 근거는 ADR/Architect Trade-offs 표.)

## 구현 단계 (커밋 단위)

### Commit 0 (선행, 리팩터·동작 불변) — WARN 데이터 모델 확장
- `src/geometry.js` `analyzeVisualTells()`: 반환 `{ findings, warnings }`.
- `src/audit.js` `combineAudits(staticResult, visual)`: **normalize** `Array.isArray(visual) ? visual : (visual.findings ?? [])` + `(visual.warnings ?? [])`. `warnings = [...staticResult.warnings, ...visualWarnings]`. `failed/slopScore/pass`는 findings만(불변).
- warning shape `{ name, lane:'static'|'visual', evidence }`; `formatAuditReport()`가 두 레인 WARN 출력.
- `collectWarnings()`는 `(html, rules, vars)` 입력으로 확장해 정적 신규 WARN이 CSS 파서를 재사용(파서 중복 divergence 방지 — Architect #5 fix).
- 테스트: 기존 통과 유지 + **visual WARN exit 0 / slopScore·pass 불변** 회귀(`geometry.test.js`+`audit.test.js`), `geometry.test.js`의 direct-array usages 갱신.

### Commit 1 — 한글 조판 (TY5 부분 승격)
- 시각 arm A(fail, 전용 finding ID): `pageAnalyzer()`에서 한글 보유 visible block의 `Range.getClientRects()` 라인 박스. **보수 조건**: raw text상 공백·구두점 없이 인접한 한글 완성형 음절 쌍이 line-box top 차이 > 폰트크기 절반. `<br>`/inline 경계/transform/ruby/vertical writing 제외, 기존 `isVisible()` 재사용.
- 정적 arm B/C(WARN, lane:'static'): B=한글 본문 존재 + 폴백 스택에 한글 폰트·sans-serif 제네릭 부재(broad selector 또는 inline 한정); C=한글 요소 inline/broad selector `font-style:italic`.
- 픽스처: clean(keep-all+폴백+비이탤릭) 무발화; redteam 어절중간 줄바꿈(A fail) + clean 한글(A 비발화 오탐가드), 폴백미비(B warn), 한글 italic(C warn).
- 문서 arm-level lane table: TY5-A=기계·시각 fail, TY5-B/C=기계·정적 WARN, TY5-D/E=LLM. 승격분만 SKILL.md/core LLM 체크리스트에서 제거.

### Commit 2 — 웹폰트 신뢰 (warning taxonomy)
- 정적 arm ①(WARN, lane:'static'): `@import`/`<link href>`/`@font-face src`가 외부 도메인 원격 URL → 자가호스팅·인라인 권장.
- 시각 arm ②(WARN, lane:'visual', 보수적): 첫 선언 패밀리가 `@font-face` 선언 + `document.fonts.check('<size> "<family>"')===false`(확정 fallback)만 WARN. 애매·시스템 정상 폴백은 skip evidence 카운트.
- 픽스처: clean(자가호스팅/인라인 로드됨) 무경고; redteam CDN @import(① warn); @font-face src 깨짐→check false(② warn).

### Commit 3 — TY2 `<main>` skip 구멍
- 시각(`pageAnalyzer` ty2, fail): `<main>` 부재 시 `<body>` 루트 지배 본문 블록 측정. **제외**: `footer/nav/aside/small/figcaption/[aria-hidden]`·hidden/offscreen(`isVisible()` 재사용). 80자+ `<p>` 중 글자수 최대 & visible text share 충분. 15.5px 미만 fail.
- 픽스처: `tests/redteam/no-main-small-paragraph.html`(이제 fail) + 신규 clean `no-main-footer-legal`(footer/약관만 작고 본문 정상→비발화). 양면, `geometry.test.js`.

## Pre-mortem (3)
1. arm A 오탐 → 보수 조건 + clean 한글 회귀 가드. 2. webfont ② 헤드리스 잡음 → @font-face+check-false 확정만, 나머지 skip, WARN 무차단. 3. TY2 footer 오탐 → landmark/tag/visibility 제외 + dominance/share + clean footer/legal 픽스처.

## 확장 테스트 계획
- **unit**(`audit.test.js`): arm B/C/① 정적 WARN 정·오, combineAudits가 visual warnings 보존+slopScore/pass 불변.
- **integration/시각**(`geometry.test.js`, puppeteer 게이트): arm A fail/clean 양면, webfont ② 확정fallback warn+정상 skip, TY2 no-main fail + footer/legal clean. **watchpoint(Critic)**: TY2 body fallback 선택 검증은 헬퍼 추출 안 하면 audit.test.js에 억지로 넣지 말고 geometry.test.js 양면 픽스처로 고정.
- **e2e**(`pipeline.test.js`): `audit --visual`이 arm A·TY2 fail에서 exit 1; B/C/①/② WARN은 exit 0 + WARN 라인(`src/cli.js` `process.exit(result.pass?0:1)`와 정합).
- **regression**: 정적 `benchmark.mjs`/`baseline.json` 변경 없음(WARN은 failed 아님). 시각 회귀는 geometry.test.js. puppeteer 미설치 시 `npm run benchmark` 정적 green 유지.
- **observability**: 리포트에 static/visual WARN 라인 + webfont ② "checked/skipped(reason)" 카운트(DE3 contrast 선례).

## 수용 기준 (검증 가능)
- [ ] arm A: 렌더 어절중간 줄바꿈 페이지 fail; keep-all 적용/한 줄 한글 통과(오탐0).
- [ ] arm B/C: 폴백 미비·한글 italic → WARN, exit 0.
- [ ] webfont ①(CDN 의존)·②(확정 fallback) → WARN, exit 0; 애매는 skip evidence.
- [ ] TY2: `<main>` 없는 14px 본문 fail; footer/약관만 작은 clean 페이지 통과(오탐0).
- [ ] visual WARN은 `failed/slopScore/pass`에 영향 없음(전용 회귀 테스트 존재).
- [ ] 승격 arm만 LLM 체크리스트에서 제거(arm-level lane table), D/E 잔류.
- [ ] 커밋별 코드+픽스처+문서/baseline 동반, `npm test`+`npm run benchmark` green, puppeteer 미설치에서도 정적·단위 green.

## 합의 기록
| Pass | Planner | Architect | Critic |
|---|---|---|---|
| 1 | 초안(stage-01-planner) | **BLOCK/REQUEST CHANGES** (6 findings, stage-01-architect) | — |
| 2 | 개정(stage-02-revision) | **CLEAR/APPROVE** (6 해소, stage-02-architect) | **OKAY** (필수수정 없음, stage-02-critic) |
