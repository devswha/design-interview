# Deep Interview Spec: 폰트/타이포그래피 신뢰 기계 검사

## Metadata
- Interview ID: fonts-20260613
- Rounds: 7
- Final Ambiguity Score: 12%
- Type: brownfield
- Generated: 2026-06-13
- Threshold: 0.05
- Threshold Source: default
- Initial Context Summarized: no
- Status: BELOW_THRESHOLD_EARLY_EXIT (잔여 12%는 구현 디테일 — ralplan 합의 단계가 해소)
- Auto-Researched Rounds: []
- Auto-Answered Rounds: [7]
- Architect Failures: 0

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.88 | 0.35 | 0.308 |
| Constraint Clarity | 0.88 | 0.25 | 0.220 |
| Success Criteria | 0.88 | 0.25 | 0.220 |
| Context Clarity | 0.90 | 0.15 | 0.135 |
| **Total Clarity** | | | **0.883** |
| **Ambiguity** | | | **0.117** |

## Topology
| Component | Status | Description | Coverage / Deferral Note |
|-----------|--------|-------------|--------------------------|
| hangul-typesetting | active | TY5 한글 조판을 LLM 레인에서 기계 레인으로 부분 승격 | A(어절 중간 줄바꿈)=시각 fail, B(폴백 스택)=정적 WARN, C(한글 italic)=정적 WARN, D(자간)·E(행간)=LLM 유지 |
| webfont-load-verify | active | 선언 폰트의 실제 적용·로드 신뢰성 표면화 | 둘 다 WARN(DE3 warn 채널): ① 정적 원격 CDN 폰트 의존, ② 렌더 시 선언≠실제 적용(fallback로 측정) |
| scale-family-gaps | active | 기존 타입 기계 검사 빈틈 보강 | ① TY2가 `<main>` 부재 시 본문크기 검사를 통째로 skip하는 구멍만 채택. ②(TY4 var()-only 스택 skip)·③(TY1 스케일 비율 검증)은 이번 범위 보류 |

## Goal
design-interview의 "폰트 불안"을 세 갈래의 검증 가능한 검사로 닫는다: (1) **한글 조판** — 한글이 실제로 어절 중간에서 줄바꿈되는 결함을 시각(geometry) 레인에서 fail로 잡고, 폴백 스택 미비·한글 가짜 이탤릭을 정적 WARN으로 표면화한다; (2) **웹폰트 신뢰** — 원격 CDN 폰트 의존(조용히 실패 가능)과 선언 폰트가 실제 적용되지 않고 fallback으로 측정·렌더되는 상황을 DE3 warn 채널로 알린다(납품 차단 없음); (3) **스케일 빈틈** — TY2 본문크기 검사가 `<main>` 부재 페이지에서 통째로 건너뛰던 구멍을 `<body>` 루트의 지배 본문 블록 측정으로 메운다. 모든 새 검사는 기존 3레인 분리(정적/시각/LLM)와 "clean 픽스처 오탐 0" 벤치마크 규율을 지킨다.

## Constraints
- arm A(한글 어절 중간 줄바꿈)만 **fail**(납품 차단). 나머지 신규 신호(폴백 스택, 한글 italic, CDN 의존, 선언≠적용)는 전부 **WARN** — DE3 warn 채널 재사용, pass/exit에 영향 없음.
- webfont 검증은 **런타임 로드 pass/fail을 채택하지 않는다**: headless Chromium의 네트워크 상태는 최종 사용자와 다르므로 환경 의존적이다. 정적 사실(원격 CDN 의존)과 렌더 결과(실제 적용 폰트)만 본다.
- "clean 픽스처 오탐 0" 벤치마크 게이트 유지 — fail 게이트(arm A)는 실제 렌더 어절 중간 줄바꿈에만 발화(정적 keep-all 누락만으로 fail 금지).
- 기계 레인이 커버하게 된 항목은 SKILL.md/core LLM 체크리스트에서 제거 — 이중 채점 금지(ROADMAP 운영 원칙).
- 신규 기계 검사는 픽스처 + `tests/quality/baseline.json` 갱신과 같은 커밋으로.
- puppeteer 선택 의존 유지: 정적 arm(B/C/CDN-의존)은 puppeteer 없이 동작, 시각 arm(A/선언≠적용)은 `--visual`에서만.
- 의미·숫자·극성·인과 보존(patina MPS) 불변.

## Non-Goals
- TY5 자간(D)·행간(E) 밴드의 기계화 — LLM 레인 유지(취향·성격 판단).
- TY4 `var()`-only 폰트 스택의 판정(②) — 이번 범위 제외.
- TY1 타입 스케일의 *비율* 검증(③, 개수 ≤6은 이미 있음) — 이번 범위 제외.
- 런타임 웹폰트 로드 성공/실패를 납품 게이트로 삼는 것.
- axe-core 등 외부 접근성 엔진 도입 — 이번 범위 밖(별도 트랙 B 후보).
- 다크 극성 수치, 반응형 테이블 — 별도 ROADMAP 항목.

## Acceptance Criteria
- [ ] (hangul A) `--visual` 감사에서, 한글 텍스트가 실제 렌더에서 어절 중간(공백 없는 인접 음절 사이)에 줄바꿈되는 페이지는 **fail**한다. word-break:keep-all이 적용돼 어절이 보존되거나 한 줄에 들어가는 페이지는 통과한다(오탐 0).
- [ ] (hangul B) 한글 본문이 있는데 font-family 스택에 한글 폰트도 sans-serif 제네릭도 없으면 **WARN**.
- [ ] (hangul C) 한글 텍스트 요소에 `font-style: italic`(가짜 기울임)이 적용되면 **WARN**.
- [ ] (webfont ①) `@import`/`<link>`/`@font-face src`가 외부 도메인 원격 URL로 폰트를 불러오면 **WARN**(자가호스팅·인라인 권장 메시지).
- [ ] (webfont ②) `--visual`에서 측정 요소의 실제 적용 폰트가 선언 스택의 첫 패밀리가 아니라 fallback이면 **WARN**(어떤 폰트로 측정됐는지 보고).
- [ ] (scale ①) `<main>`이 없는 페이지에서도 `<body>` 루트의 글자수 최대 지배 본문 블록을 측정해 15.5px 미만이면 **fail**. 푸터·약관·캡션 등 비지배 작은 글씨는 측정 대상이 아니다(오탐 0).
- [ ] 위 기계화 항목은 SKILL.md Phase 5 LLM 체크리스트와 core 문서 레인 표기에서 중복 제거된다.
- [ ] 각 검사마다 양성(통과)·음성(검출) 픽스처가 추가되고 baseline에 반영, `npm test` + `npm run benchmark` green.

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| "폰트가 런타임에 떴는지" 검사하면 신뢰가 생긴다 | Contrarian(R4): headless 네트워크 상태 ≠ 사용자 브라우저 → 환경 의존 불안정 | 런타임 로드 게이트 폐기. 정적 CDN-의존 사실 + 렌더 실제 적용 폰트만 판정 |
| TY5 전부를 기계로 잡아야 한다 | R2: 어떤 암이 명확한 결함인가 | A는 fail, B·C는 WARN, D·E(취향)는 LLM 유지로 분할 |
| 한글 줄바꿈은 정적으로(keep-all 누락) 잡으면 된다 | R5: fail 게이트는 오탐에 민감, keep-all 누락만으로 fail하면 한 줄 제목도 오탐 | 시각 레인에서 *실제* 어절 중간 줄바꿈에만 fail |
| 스케일·패밀리 빈틈을 폭넓게 보강해야 한다 | Simplifier 성향(R3): 실제 불안 지점은? | TY2 `<main>` skip 구멍 하나만 채택, var()/스케일비율은 보류 |
| 웹폰트 위반은 납품을 막아야 한다 | Simplifier(R6): 가장 단순하면서 가치 있는 버전은? | 전부 WARN(DE3 warn 채널), 납품 차단은 arm A뿐 |

## Technical Context
- **정적 레인 통합점**: `src/audit.js` `checkQualityFloor(html, rules)` — DE3가 이미 4개 fail 암 + warn 채널을 갖고 있다. hangul B/C, webfont ①, 그리고 warn 신호들은 이 함수의 warn 채널에 합류한다. CSS 규칙 파서 `extractCssRules`/`rootVarMap`/`resolveVars` 재사용.
- **시각 레인 통합점**: `src/geometry.js` `pageAnalyzer()`(브라우저 내부 실행, 외부 스코프 참조 금지) + `analyzeVisualTells()`. hangul A(어절 중간 줄바꿈)와 webfont ②(선언≠적용)는 여기에. `document.fonts.ready` 대기 이미 적용됨. `combineAudits()`가 DE3 정적/시각 암을 한 ID로 병합(이중 채점 방지) — 신규 시각 arm도 동일 병합 규약 준수.
- **TY2 위치**: `geometry.js` `pageAnalyzer()`의 ty2 — 현재 `<main>` 스코프. `<main>` 부재 시 `<body>` 루트 지배 블록으로 폴백.
- **벤치마크**: `tests/quality/baseline.json` + `tests/fixtures/{slop,clean}/` + `tests/redteam/`. 신규 검사마다 픽스처+baseline 한 커밋.
- **레인 표기 문서**: `core/design-tells.md`, `core/design-principles.md`(TY5 항목), `SKILL.md` Phase 5, `CLAUDE.md` 3레인 설명 — 승격 항목 이동 반영.
- **리서치 근거**: `.omo/ultraresearch/20260613-213056/SYNTHESIS.md` Track C(KRDS, W3C klreq — 한글 word-break/폴백/조판), verification.md.

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| WebFont | core domain | declaredFamily, fallbackStack, source(CDN/self-host/inline), applied? | Measurement이 WebFont로 렌더됨 |
| Measurement | core domain | element, fontSize, computedFamily, basisFont | TY1/TY2가 Measurement를 읽음 |
| HangulText | core domain | hasKeepAll, overflowWrap, letterSpacing, lineHeight, fakeItalic, midWordBreak | FontFamilyStack을 가짐 |
| FontFamilyStack | supporting | families[], endsWithGeneric, hasHangulFont | TY4/hangul B가 검사 |
| TypeScale | supporting | distinctSizes[], bodySizePx | scale-family-gaps가 검사 |
| AuditEnv | external system | headlessChromium, network, fontsReady | Measurement의 신뢰 경계 |
| Severity | supporting | fail / warn / llm | 각 검사 항목에 부여 |

## Ontology Convergence
| Round | Entity Count | New | Changed | Stable | Stability Ratio |
|-------|-------------|-----|---------|--------|----------------|
| 1 | 6 | 6 | - | - | N/A |
| 2 | 7 | 1 | 0 | 6 | 86% |
| 3 | 7 | 0 | 0 | 7 | 100% |
| 4 | 7 | 0 | 0 | 7 | 100% |
| 5 | 7 | 0 | 0 | 7 | 100% |
| 6 | 7 | 0 | 0 | 7 | 100% |
| 7 | 7 | 0 | 0 | 7 | 100% |

도메인 모델은 R3부터 5라운드 연속 안정(100%) — 엔티티가 굳었다.

## Interview Transcript
<details>
<summary>Full Q&A (7 rounds)</summary>

### Round 0 — 토폴로지 확정
3개 독립 컴포넌트(hangul-typesetting, webfont-load-verify, scale-family-gaps) 확정.

### Round 1 (webfont / goal)
**Q:** 산출물 폰트를 믿을 수 있게 만들 때 가장 무서운 시나리오는?
**A:** 적용 실패 + 그로 인한 오측정 + CDN 오프라인 깨짐(자가호스팅/인라인 필요여부) + 브라우저 간 일관성 — 전부.
**Ambiguity:** 69%

### Round 2 (hangul / goal)
**Q:** TY5 5개 암 중 기계가 반드시 잡을 것과 fail/WARN?
**A:** A(keep-all/overflow-wrap 누락)=fail, B(폴백 스택)·C(한글 italic)=WARN, D(자간)·E(행간)=LLM 유지.
**Ambiguity:** 69%

### Round 3 (scale-family / goal)
**Q:** TY1/TY2/TY4 알려진 빈틈 중 실제 불안한 것?
**A:** ① TY2 `<main>` 부재 skip 구멍만 메움. ②(var() skip)·③(스케일 비율) 보류.
**Ambiguity:** 48%

### Round 4 (webfont / constraints, Contrarian)
**Q:** "런타임에 떴는지" pass/fail은 환경 의존 불안정 — 정적 CDN-의존 게이트로 재구성?
**A:** 둘 다 — 정적 CDN-의존 게이트 + 렌더 시 선언≠적용(fallback 측정) 감지.
**Ambiguity:** 27%

### Round 5 (hangul / criteria)
**Q:** arm A 검출: 정적 keep-all 누락 vs 시각 어절중간 줄바꿈?
**A:** (b) 시각 — 실제 어절 중간 줄바꿈만 fail, geometry 레인, 오탐 0 준수.
**Ambiguity:** 23.5%

### Round 6 (webfont / criteria, Simplifier)
**Q:** 정적 CDN-의존 ①과 렌더 fallback ②의 심각도?
**A:** 둘 다 WARN, DE3 warn 채널로 표면화(가장 단순·기존 구조 재사용).
**Ambiguity:** 19%

### Round 7 (scale-family / criteria, auto-answered)
**Q:** `<main>` 부재 시 본문 글을 어떻게 찾을까?
**A (위임→에이전트 결정, 신뢰도 high):** (a) `<body>` 루트의 글자수 최대 지배 본문 블록 하나 측정 — 오탐 0, 기존 로직 재사용.
**Ambiguity:** 12%

</details>
