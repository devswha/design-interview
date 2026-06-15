# RALPLAN-DR rev2 — design-interview 철학 뒤집기: 빼기→더하기 재설계 (Revision, pending approval)

run-id: 2026-06-14-flip-redesign · stage: revision/2 · 상태: 승인 전, product/.gjc 미변경
선행: planner/1 (Architect WATCH/REQUEST CHANGES, Critic ITERATE). 본 개정은 두 HIGH + 후속 결함을 코드정합하게 반영.

## 개정 요지 (planner/1 대비 변경점)
- **[P0-1] 분할선 재설정:** 기계 탐지 하드 텔 C1·T1·T2·T4는 **blocking 유지**. advisory엔 *억제 휴리스틱만* — TY4·CO1·DE1·S5·시각 L1/L2/S3·TY1/TY2. (planner/1이 C1·T1·T2·T4까지 advisory로 내려 결정론적 슬롭 게이트가 정전되고 e2e slop must not pass가 깨지던 자가모순 제거.)
- **[P0-2] 게이트 2개 분리:** CLI exit = blockingFailed만(납품 게이트, product는 advisory 의도 초과 허용) / benchmark = 전체 failed(blocking∪advisory) miss+fp 비교 유지(탐지기 정확도 게이트). baseline은 정적 9검사를 {expectedBlocking, expectedAdvisory}로 분할하되 benchmark 비교는 전체 유지.
- **[P1-3] 수용기준 보정:** v6 blockingFailed===[] + slop-source exit 1(C1/T1 blocking) + benchmark advisory도 miss/fp 세 클레임 무모순 명시. 클레임 보존은 Phase5 수동 diff로 분리.
- **[P1-4] 결정론 방어 명문화:** 결정론적 방어 = 하드텔 blocking + 품질바닥선. POV/큐레이션은 LLM 비결정론 인정. R1에 게이트 정전 위험 등재.
- **[P2-5] L1:** advisory 강등 시 실그리드 신호 손실 리스크 등재 + 대안(L1 blocking 유지 + 다이어그램 면제) 명시.
- **[P2-6] 구현 디테일:** slopScore 키 존속(별칭), 시각 finding severity 누락 시 blocking 기본, geometry.test.js 갱신 핸드오프 포함.
- **유지(불변):** 방향(더하기·에셋라이브러리·audit 가드레일화·디자인우선)·Option B·M9 시퀀싱 골격·출력 더 살리는 레버.

## Summary

현행 design-interview는 audit(AI 슬롭 탐지기)를 납품 게이트로 두고, design-principles 공리 "균일함이 AI 티다 → 모든 원칙은 상한(cap)"으로 표현을 절제 방향으로 cap한다. cap 철학은 매 출력을 무난한 "클로드 룩"으로 수렴시킨다. 실증(v6-skillshop-flipped.html: 자가호스팅 Hahmlet 세리프 + 藍/朱 2색 + 방안지 그리드 + scroll-driven SVG 드로잉)이 v5(절제·얌전)보다 살아있는데, 현행 audit이 TY4(3패밀리)로 v6를 fail 처리 — 더 나은 디자인을 *억제 휴리스틱*이 차단했다. 반면 품질 검사(대비·focus·접근성)와 *결정론적 지문*(C1 보라그라데·T1 이모지)은 v6에서 미발화/통과.

뒤집기의 본질은 **억제 휴리스틱의 게이트 권한 박탈**이지 결정론적 지문 탐지 폐기가 아니다. 따라서: (1) audit을 두 부류로 나눠 **차단 = 품질바닥선 + 기계 탐지 하드 텔(지문)**, **권고 = 억제 휴리스틱**, (2) cap 공리를 기본값(default)이되 의도로 초과 가능으로 재서술, (3) 에셋/레퍼런스 라이브러리를 1급 입력으로 추가, (4) 출력을 더 살리는 구체 레버를 빌드 규율에 명시. 또한 **납품 게이트(CLI exit)**와 **탐지기 정확도 게이트(benchmark)**는 목적이 다르므로 분리한다.

불변식: 승인 전 product 미변경, 클레임 보존 절대 유지(Phase5 수동 diff), inert preview 보안(SSRF/script-strip/CSP) 유지, 품질 바닥선(대비·focus·접근성)은 차단 유지, 이중채점 금지(DE3 단일 ID 병합) 유지. Pure ESM·node:test, 한국어 docs/영문 식별자. 강등 허용 범위는 *표현 억제 규칙*(패밀리 cap·단일강조·webfont금지·절제강요)뿐 — 지문(C1/T1/T2/T4)은 강등 불가. 자가호스팅 폰트·에셋 허용.

## Principles (재설계 공리, 4)

1. **더하기 > 빼기.** 디자인/인터랙션이 1순위, 슬롭 회피는 부산물.
2. **에셋/레퍼런스가 1급 입력.** 큐레이션된(아무거나가 아닌 고른) 에셋이 표현을 키우면서 난잡함을 막는다.
3. **audit은 가드레일이지 게이트가 아니다 — 단 결정론적 지문은 예외.** exit 1로 차단하는 것은 *품질 바닥선*(대비·focus·접근성) + *결정론적 슬롭 지문*(C1·T1·T2·T4). *억제 휴리스틱*(패밀리 수·색 예산·그림자 캡·radius·균일 그리드)만 권고(advisory)로 흐르고 납품을 막지 않는다.
4. **결정론적 방어 = 하드텔 blocking + 품질바닥선.** 슬롭 재발 3중 장치 중 POV·큐레이션은 LLM 비결정론 판단이다. 진짜 안전망은 결정론적 하드텔 차단 + 품질 바닥선이며, POV/큐레이션은 그 위의 방향 잠금이다. 셋이 합쳐 자유를 규율한다.

## Decision Drivers (top 3)

- **D1 사용자 핵심 비판:** cap=절제 강요가 출력을 무난함으로 수렴. → 차단 표면에서 *억제 휴리스틱*을 빼되 지문·바닥선은 남긴다.
- **D2 실증 증거:** v6가 v5보다 살아있는데 옛 audit이 TY4(억제 휴리스틱)로 v6를 차단. 결정적 반례. (v6는 C1 미발화 — repeating-linear-gradient+var(--grid)·인디고 solid이라 hue 230-300 미해당.)
- **D3 더 나아져야 요구:** v6도 부족. 출력을 더 살리는 구체 레버(성격 폰트·실이미지/텍스처·인라인 SVG·리치 모션·2색+)가 빌드 규율에 명시돼야 함.

## Viable Options

### Option A — audit 2분할 + 빌드 규율 디자인우선 재서술 (코드 최소)
src/audit.js를 blocking(바닥선+지문)/advisory(억제 휴리스틱) 2채널로 분할, cli.js exit은 blocking만. core 문서 cap→default 재서술, SKILL Phase3 디자인우선. 에셋 라이브러리·시각레인 미변경.
- 장점: 최소 변경으로 게이트→가드레일 핵심 달성. 위험 표면 최소.
- 단점: 더 살리는 레버가 문서 규율로만 존재(에셋 파이프 없음). 큐레이션 장치 약함 → 자유화가 슬롭 쪽으로 기울 위험. D3 부분 충족.

### Option B — A + 에셋/레퍼런스 라이브러리 파이프라인 (권고)
A에 assets/{fonts,textures,icons,palettes} + refs/{screenshots,brief} 규약, 인터뷰 reference·intake에서 수집, 빌드가 라이브러리에서 조립. 자가호스팅·라이선스·복제금지 보안 유지.
- 장점: 3중 장치 완비(POV·큐레이션·바닥선+지문). D1/D2/D3 모두 충족. M7 레퍼런스 인텔리전스와 합류.
- 단점: 표면 넓음(문서+규약+선택적 CLI). 라이선스/복제 규율 신규 문서화. 자가호스팅 폰트 file:// 미검출 가드 보강 필요.

### Option C — B + 시각레인 재설계 (디스코프)
geometry.js의 L1/L2/S3·TY1/TY2를 위반 탐지에서 표현 헤드룸 측정으로 재설계 + L1 신호/노이즈 정제(구조 SVG 면제).
- 장점: 시각레인까지 철학 일관, L1 신호 손실 해결.
- 단점: 가장 큰 위험·비용(puppeteer·픽스처·baseline 대량). 현 시점 D1/D2/D3는 B로 충족 — 과투자. **후속 run 후보.**

## 권고

**Option B 채택**, C는 후속 run으로 디스코프. B가 3중 슬롭 방지 장치를 완비하면서 D1·D2·D3를 충족하고 시각레인 대수술 위험을 피한다. A는 큐레이션 장치가 비어 단독 부적합(A는 B의 부분집합 = M9.1~9.2). 단일 옵션이 아니므로 대안 무효화 조항 해당 없음.

## 시퀀싱 (M9 — 철학 뒤집기 레이어, 디자인/인터랙션 우선순위순)

각 단계는 픽스처+baseline 동반(M2 운영원칙).

- **M9.1 — 공리 재서술 (core 문서, product 코드 0):** design-principles.md "핵심 테제: 균일=AI티 → cap"를 "균일=AI티 → 기본값(default), 의도로 초과 가능"으로 재서술. 각 *억제 cap* 원칙(TY4 패밀리≤2, CO1 단일 강조, HI2/LA2 시그니처≤1, SP3 고밀도≤1곳, S5 radius)에 "컨셉 시트가 의도를 명시하면 초과 합법" 단서. design-tells.md를 **하드 텔(차단/즉실격: 기계 C1·T1·T2·T4 + LLM S1 가짜후기·S2 가짜로고·M1~M4 장식모션)** vs **소프트 권고(advisory: TY4·CO1·DE1·S5·L1·L2·S3·TY1·TY2)**로 분할 표기. 이 분류표는 M9.2 채널과 1:1 일치해야 한다(자가모순 금지). SKILL.md Phase3 "AI 티 제거는 규율" → "디자인을 더하는 게 규율, 슬롭 회피는 바닥선+지문". CLAUDE.md Two hard gates·exit 규율 갱신.
  - 타깃: core/design-principles.md(핵심 테제 절·각 억제 cap 원칙), core/design-tells.md(감사 사용법 절·하드/소프트 분류표), SKILL.md(Phase3·Phase5), CLAUDE.md.
- **M9.2 — audit 2채널 분할 (src/audit.js·cli.js·geometry.js):** MACHINE_CHECKS 각 항목에 severity 필드(blocking|advisory) 추가.
  - **blocking(차단):** DE3(quality-floor 4암: focus-visible kill 무대체·transition:all·user-scalable/maximum-scale·img width/height 누락) + 시각 DE3 렌더 대비 + 시각 TY5-A 한글 어절 줄바꿈 + **기계 탐지 하드 텔 C1·T1·T2·T4**(결정론적 지문).
  - **advisory(권고, findings에 남되 exit 무영향):** TY4·CO1·DE1·S5 + 시각 L1·L2·S3·TY1·TY2.
  - auditHtml/combineAudits에서 blockingFailed/advisoryFailed 분리, `pass = (blockingFailed.length === 0)`. slopScore 키는 **존속(별칭 유지, 하위호환)** — failed/total 그대로; 추가로 blockingScore/advisoryScore 제공. cli.js audit 블록 `process.exit(result.pass ? 0 : 1)`은 코드 변경 없이 pass 재정의로 동작(출력 문구만 BLOCK/advise 2섹션). geometry.js의 analyzeVisualTells 반환 findings에 severity 부여(L1/L2/S3/TY1/TY2=advisory, DE3-contrast/TY5-A=blocking). **severity 누락 finding은 blocking 기본(fail-safe).** combineAudits 병합 시 existing.severity 보존 규칙 명문화(DE3 양쪽 blocking이라 안전). 기존 collectWarnings/warnings 채널(웹폰트·craft·reduced-motion WARN) 유지.
  - 타깃: src/audit.js(MACHINE_CHECKS, auditHtml, combineAudits, formatAuditReport), src/cli.js(audit 출력 문구), src/geometry.js(analyzeVisualTells severity).
- **M9.3 — 출력 더 살리는 빌드 레버 (SKILL.md Phase3 + design-principles 신설 절):** 아래 레버를 Phase3 양성 규율로 등재. 컨셉 시트 토큰 커밋에 에셋 선택 행 추가.
  - 타깃: SKILL.md(Phase2·Phase3), core/design-principles.md(시각 임팩트 절 확장), templates/concept-sheet.md(에셋 행).
- **M9.4 — 에셋/레퍼런스 라이브러리 (신규 docs + 디렉터리 규약):** core/asset-library.md 신설, SKILL Phase0 intake·Phase1 reference에 수집 시점 연결. src reference-intake CLI는 디스코프(M7 합류) — 이 run은 규약+문서+빌드 조립 규율까지.
  - 타깃: core/asset-library.md(신규), SKILL.md(Phase0/Phase1), CLAUDE.md(보안모델에 자가호스팅 에셋·라이선스), .gitignore.
- **M9.5 — 두 게이트 분리 + baseline 의미 재정의:**
  - **(a) 납품 게이트 = CLI exit:** blockingFailed만 차단. product 산출물은 advisory를 의도로 초과해도 exit 0.
  - **(b) 탐지기 정확도 게이트 = benchmark:** auditHtml().failed **전체(blocking∪advisory)**를 miss+fp로 비교 유지(현행 benchmark.mjs 동작 보존). "blocking 회귀만 exit 1" 문구 삭제 — "의도 초과 가능"은 product 산출물에만 적용되지 탐지기 픽스처(slop-source·principle-violations·clean·redteam)에는 적용 안 됨.
  - baseline.json은 **정적 9검사**(C1·T1·T2·T4·S5·TY4·CO1·DE1·DE3)를 {expectedBlocking, expectedAdvisory}로 분할 표기하되, benchmark 비교는 두 채널 합집합으로 miss+fp 유지. benchmark.mjs는 .failed만·--visual 미실행(정적 9검사 한정)이므로 **시각 advisory(L1/L2/S3/TY1/TY2) 회귀는 benchmark가 아니라 geometry.test.js가 게이트**임을 명시.
  - v6-skillshop-flipped.html·v5-skillshop-stationery.html을 픽스처로 추가, expectedBlocking: [] (품질바닥선+지문 통과)로 고정.
  - 타깃: tests/quality/baseline.json, tests/quality/benchmark.mjs(스키마 적응만, 비교 로직 보존), tests/fixtures 또는 tests/redteam에 v5/v6 복사.

## audit 가드레일 설계 (상세)

**차단(blocking → exit 1):**
- 품질 바닥선: DE3 4암(focus-visible 무대체·transition:all·user-scalable=no/maximum-scale=1·img width/height 누락), 시각 DE3 렌더 대비(단색배경, 이미지/그라데/반투명 skip), 시각 TY5-A 한글 어절 중간 줄바꿈.
- 결정론적 지문(하드 텔): C1 보라 그라데, T1 이모지 불릿, T2 hype 어휘, T4 대칭 3연 헤딩. (불변식 강등 허용 범위 밖 — 강등 불가.)

**권고(advisory → findings에 남되 exit 무영향):**
- 억제 휴리스틱: TY4 패밀리 규율, CO1 색 리터럴 예산, DE1 그림자 물리, S5 radius 균일, 시각 L1/L2/S3·TY1/TY2.

**비차단·비기계(분리 유지):**
- 클레임 보존: SKILL Phase5 수동 diff(기계 arm 없음 — CLAUDE.md:66, SKILL.md:115). audit exit 대상 아님.
- reduced-motion: 현행 WARN(checkReducedMotionGuard, extractRuleContexts 중첩 파서 존재). 현행도 exit 게이트가 아니므로 **강등 없음(no regression)** — WARN 유지, blocking 승격은 M8.2 게이트 통과 시 백로그. 불변식 텍스트에서 reduced-motion을 "현행 blocking"으로 칭하지 않는다(과대진술 금지).

**exit 경로 변경 요지:** auditHtml/combineAudits가 pass = (blockingFailed.length === 0). slopScore 키 존속(하위호환). cli.js exit 라인 코드 불변(의미만 변경). benchmark는 별도 게이트로 전체 failed 비교 유지.

## 에셋/레퍼런스 라이브러리

**디렉터리:** assets/fonts/(hahmlet-*.woff2 존재) · assets/textures/ · assets/icons/(인라인 SVG) · assets/palettes/(역할명명 토큰). refs/screenshots/(SSRF 가드 PNG) · refs/brief/(빌릴 것/버릴 것/복제 금지 마크다운).
**수집 시점:** Phase0 intake(소스 동반 자산) + Phase1 reference(URL → SSRF fetch + shot → refs/, brief 작성). 인터뷰가 고르는 행위 = 큐레이션.
**보안(유지):** 자가호스팅만(원격 CDN은 이제 권장 사항이되 자가호스팅 칭찬). 라이선스 sidecar 기록. 레퍼런스 복제 금지(brief 명시, 픽셀 카피 금지) — interview.md 규약 계승.
**빌드 조립:** Phase3에서 컨셉 시트가 잠근 에셋을 :root 토큰·@font-face·인라인 SVG로 단일 HTML 인라인/자가참조. 신규 런타임 의존성 0.

## 출력을 더 살리는 구체 레버

- **성격 있는 자가호스팅 폰트:** 시스템 산스 탈출(Hahmlet 등). 슬롭 회피: TY4 default 초과는 *역할 분담* 명시 시(세리프 디스플레이+산스 본문+모노 숫자 3역할 합법). advisory라 차단 안 됨.
- **실제 이미지/텍스처:** 종이결·방안지·노이즈. 슬롭 회피: S4 stock-illustration은 하드 회피 유지(undraw류 금지, 실제 텍스처/제품샷만).
- **인라인 SVG 일러스트/다이어그램:** 5단계 닫힌 고리 등 구조 다이어그램. 슬롭 회피: L1 advisory화로 다이어그램 차단 안 됨 + 의미 있는 도식만.
- **리치 모션:** scroll-driven reveal·그려지는 SVG(stroke-dashoffset)·sticky·:target. 슬롭 회피: MO1 목적성·@supports 게이트·reduced-motion 래핑. count-up은 **클레임 충돌 주의** — 동결 숫자 최종값만 동결, 중간 프레임 aria-hidden·비파싱.
- **2색+ 강조:** 단일 강조 강제 폐기 — 藍+朱 같은 역할 분리 다색. 슬롭 회피: CO1 advisory화 + 컨셉 시트가 각 색 역할 명시(C3 무지개 아이콘과 구분, 역할 없는 다색은 advisory 경고).

## core 문서 재구성 (요지)

- **design-principles.md:** 핵심 테제 cap→default+의도초과. 억제 cap 원칙에 의도 명시 시 초과 합법 단서. 시각 임팩트 절 확장 + 레버 등재.
- **design-tells.md:** 감사 사용법 절에 하드 텔(차단: C1·T1·T2·T4 기계 + S1/S2/M1~M4 LLM) vs 소프트 권고(advisory: TY4·CO1·DE1·S5·L1·L2·S3·TY1·TY2) 분류표. M9.2 채널과 1:1.
- **신규 core/asset-library.md:** 디렉터리·수집·라이선스·복제금지·빌드조립.
- **SKILL.md:** Phase3 디자인우선, Phase5 게이트→가드레일(blocking만 차단·지문 포함), Phase0/1 에셋 훅.
- **templates/concept-sheet.md:** 에셋 선택 행.

## 수용 기준 (세 클레임 무모순)

- [ ] **v6-skillshop-flipped.html: blockingFailed === []** — node src/cli.js audit v6 --visual → exit 0. (advisory에 TY4 등 떠도 무방. v6는 C1/T1/T2/T4 미발화·품질바닥선 통과 확인.)
- [ ] **slop-source.html(examples/): exit 1** — C1/T1(/T2/T4) blocking 발화로 납품 불가 재현. tests/e2e/pipeline.test.js slop must not pass 보존(갱신 불필요).
- [ ] **benchmark: 전체 failed(blocking∪advisory) miss+fp 비교 유지** — principle-violations.html의 advisory 탐지 후퇴(miss)·clean/svg-attr-color-smuggle 오탐(fp)이 회귀로 잡힘. blocking-only 아님.
- [ ] v5-skillshop-stationery.html 픽스처도 exit 0(대비군).
- [ ] 품질바닥선 차단 유지: 의도적 위반 픽스처(outline:none 무대체 / 저대비 / img 치수 누락 / 한글 어절 줄바꿈)로 audit → exit 1 재현.
- [ ] **클레임 보존은 Phase5 수동 diff(보존 확인)** — exit-1 픽스처 목록과 분리(기계 arm 없음).
- [ ] core 문서에 cap→default 재서술·하드/소프트 분류표(M9.2 채널과 1:1)·asset-library.md 존재.
- [ ] 이중채점 금지 불변식 유지(DE3 단일 ID 병합 회귀 없음). slopScore 키 존속(geometry.test.js 단언 보존).
- [ ] npm test green(unit+e2e), npm run benchmark green(전체 failed 비교).

## 검증 단계 (명령)

1. node --test tests/unit/audit.test.js — 2채널 분할 단위(blocking/advisory 분류, pass=blockingFailed===0 재정의, slopScore 키 존속).
2. node --test tests/unit/geometry.test.js — combineAudits 병합·merged.slopScore 단언 보존, 시각 finding severity(advisory) 확인.
3. node src/cli.js audit examples/slop-source.html; echo exit=$? → exit 1(C1/T1 blocking).
4. node src/cli.js audit v6-skillshop-flipped.html --visual; echo exit=$? → exit 0, advisory에 TY4 표기 확인.
5. node src/cli.js audit v5-skillshop-stationery.html --visual → exit 0.
6. 의도적 위반 픽스처(outline:none 무대체 / 저대비 / img 치수 누락)로 audit → exit 1 재현.
7. npm run benchmark → 전체 failed miss+fp 비교 green(advisory 회귀도 잡힘).
8. npm test 전체 green; preview/shot 보안 회귀 없음 e2e.

## 리스크 + 완화

- **R1 슬롭 재발 + 결정론적 게이트 정전 위험(HIGH):** 분할선이 지문(C1/T1/T2/T4)까지 advisory로 내리면 슬롭 소스 exit 0 → 게이트 정전. → **하드텔 blocking 유지**가 핵심 완화. POV/큐레이션은 LLM 비결정론이므로 결정론적 방어(하드텔+바닥선)가 진짜 안전망. advisory 텔은 리포트에 남아 의도 자각 강제.
- **R2 게이트 혼동(회귀망 손실):** benchmark를 blocking-only로 좁히면 12검사 회귀 침묵. → 납품 게이트(CLI)와 탐지기 게이트(benchmark) 분리, benchmark는 전체 failed 비교.
- **R3 baseline 스키마 변경:** expectedFailed → {expectedBlocking, expectedAdvisory} 정적 9검사 분할 + 마이그레이션 1회. benchmark 비교 로직은 합집합으로 보존.
- **R4 자산 라이선스/복제:** sidecar 라이선스·복제금지 brief·자가호스팅만.
- **R5 webfont file:// 미검출:** 자가호스팅 @font-face 상대경로 미로드를 시각레인이 못 잡을 수 있음 → webfont② WARN 유지·확장, 빌드 규율에 상대경로 검증.
- **R6 L1 advisory 신호 손실:** L1을 전면 advisory로 내리면 정본 동일-피처카드 6개 AI 랜딩(실그리드 슬롭)이 exit 0. → (a) 리스크로 등재하고 L1 실슬롭 탐지는 Option C 착수까지 희생 명시, 또는 (b) **대안: L1 blocking 유지 + 의도된 다이어그램(번호 시퀀스/구조 SVG) 면제 규칙만 당겨오기**(다이어그램 오탐만 닫고 실그리드 신호 보존). 채택은 executor 슬라이스에서 결정하되 기본 권고는 (a)(스코핑 단순), (b)는 신호 손실 우려 클 때.
- **R7 시각레인 scroll-reveal 은폐:** reveal opacity:0 시작 요소를 시각레인이 저대비로 오판 가능 → geometry가 document.fonts.ready+reveal 정착 후 측정 확인(현행 동작 회귀 테스트).
- **R8 count-up 클레임 충돌:** 동결 숫자 애니 중간값 노출 시 클레임 위반 → 최종값만 동결숫자, 중간프레임 aria-hidden·비파싱.

## 핸드오프 (승인 후 executor 슬라이스)

- **슬라이스 1 (executor):** M9.2 audit 2채널 분할 — src/audit.js(MACHINE_CHECKS severity·auditHtml blockingFailed/advisoryFailed·pass 재정의·slopScore 키 존속·combineAudits severity 캐리)·src/cli.js(출력 문구)·src/geometry.js(analyzeVisualTells severity, 누락 시 blocking 기본). 단위테스트: **audit.test.js + geometry.test.js(merged.slopScore 단언 5개·severity) 동시 갱신.** 가장 코드 위험 큼.
- **슬라이스 2 (executor):** M9.5 baseline {expectedBlocking,expectedAdvisory} 정적 9검사 분할 + benchmark 전체 failed 비교 보존 + v5/v6 픽스처(expectedBlocking:[]) + e2e slop exit 1 단언 보존 확인 — 슬라이스 1 의존.
- **슬라이스 3 (executor, 병렬 가능):** M9.1+M9.3+M9.4 core 문서(design-principles·design-tells 하드/소프트 분류표·SKILL·CLAUDE·asset-library.md 신설·concept-sheet 템플릿). 코드 무관.
- **architect:** audit 2채널 분할이 이중채점 불변식·exit 규율·게이트 분리를 정합 유지하는지 리뷰.
- **critic:** 세 수용 클레임(v6 blockingFailed===[], slop exit 1, benchmark 전체 비교)이 무모순 코드검증되는지, 분할선이 M9.1 분류표와 1:1인지 비평.
- **후속 run(범위 밖):** Option C 시각레인 재설계·L1 신호 정제·reduced-motion 기계 차단 승격(M8.2)·reference-intake CLI(M7).
