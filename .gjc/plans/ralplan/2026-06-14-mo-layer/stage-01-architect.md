# Architect 리뷰 — MO(모션·인터랙션) 빌드 레이어 + 시각 크래프트 규율 통합 (run 2026-06-14-mo-layer)

## Summary
문서/프롬프트 레이어(옵션 A / M8.1·M8.3)는 실험으로 입증되고 불변식을 자연 준수하는 CLEAR 슬라이스다. 그러나 기계검사 승격(옵션 B / M8.2)의 핵심인 b1(reduced-motion 미가드 정적검사)은 현재 extractCssRules 구조 위에서 구현 불가능하며, 계획 스스로의 수용 기준(exp WARN0)을 깨뜨린다 — 파서 확장이 선행돼야 한다. 방향은 옳고 자동 강등 게이트도 갖췄으나, M8.2 실행 핸드오프 전에 파서 결정·이중채점 경로·시각 픽스처를 확정해야 한다.

## Analysis (file-backed)
- 병목 재배치(P1: 레퍼런스 후순위, 빌드레이어 우선)는 exp-skillshop-mo.html(slop 0, WARN0, 인터랙션 풍부) vs v0-after-with-skill.html(7%, 인터랙션 0)로 근거가 확실하다. CSS-first가 inert preview에서 렌더된다는 통찰도 맞다(preview.js: script-src none + stripActiveContent).
- 단, 시각 감사 경로(geometry.js analyzeVisualTells)는 inert preview를 렌더하지 않는다 — pathToFileURL로 원본 빌드 HTML을 직접 puppeteer에 띄운다. 즉 스크립트는 audit에서 실제 실행된다. MO가 CSS-first라 무관하지만, 스틸맨의 inert-preview 전제는 사실과 다르다.

## Root Cause (가장 강한 발견)
extractCssRules의 정규식 `([^{}@]+){([^{}]*)}`는 중괄호 한 겹만 매칭하고 @media/@supports 헤더를 버린다(코드 주석이 명시). 따라서 `@media (prefers-reduced-motion: no-preference) { ... transition ... }` 안의 transition 선언은 가드 밖 선언과 구분 불가다. b1·MO1(@keyframes) 두 승격 후보의 공통 병목이 바로 이 단일레벨 파서다.

## Findings

### [HIGH] b1은 extractCssRules 위에서 구현 불가 + 수용 기준 자체모순
M8.2는 b1을 "extractCssRules로 transition/animation 선언이 prefers-reduced-motion 밖에 있는지" 판정한다고 명시하나, extractCssRules는 @media 내부/외부 정보를 전혀 제공하지 않는다(checklist b 답: NO, 파서 확장 필수). 증거: exp-skillshop-mo.html은 모든 transition을 가드 안(50-58행, 52행 transition 선언)에 둔다. 평탄화 파서로 만든 b1은 52행 transition을 가드 컨텍스트 없이 보고 WARN을 낸다 → 수용 기준 "exp WARN0 유지"(8장) 위반. 또한 heroIn/grow/shrink @keyframes(59-61행)는 현재도 from/to 셀렉터의 가짜 룰로 누출돼 DE1 그림자 집합에 들어간다(dedupe로 양성일 뿐). 수정: (a) extractCssRules를 건드리지 말고(TY4/CO1/DE1/DE3 의존) at-rule 중첩을 보존하는 별도 헬퍼를 추가, 양방향 픽스처(가드 clean=exp 포함 / 미가드 warn)로 고정하거나, (b) b1을 LLM 잔류로 강등(옵션 A). 핸드오프 전 결정 필수.

### [MEDIUM] M8.2가 단일 denominator·이중채점 금지 불변식과 자기모순
M8.2 문구 "collectWarnings() 또는 checkQualityFloor() 확장 ... MACHINE_CHECKS 배열 등록"은 두 경로를 섞는다. WARN(7장 권고)은 collectWarnings를 타고 findings/failed/slopScore/baseline에서 제외된다(auditHtml warnings 채널 + baseline.json은 failed만 비교, 확인됨). WARN을 MACHINE_CHECKS에 등록하면 별도 ID·별도 denominator가 생겨 5장/R3가 금지한 이중채점·cap-not-quota 위반이 된다. FAIL로 갈 거라면 신규 ID가 아니라 DE3 checkQualityFloor의 5번째 arm으로 접어야(단일 DE3 denominator) 한다. 둘 중 하나를 명시해야 executor가 새 denominator를 추가하지 않는다. 권고: WARN→collectWarnings 단독, MACHINE_CHECKS 미등록, baseline.json 무변경. FAIL→DE3 arm.

### [MEDIUM] 이중채점 매트릭스는 대체로 정확하나 reduced-motion 소유를 오표기
코드 대조: focus-visible outline→DE3 기계 arm(a) 확인; transition:all→DE3 기계 arm(b) 확인; 44px→HI2 LLM(기계검사 어디에도 없음) 확인, 교차참조만 옳음. 그러나 reduced-motion은 DE3 원칙 산문에만 있고 checkQualityFloor에 arm이 없다 — 현재 빌드/LLM 레인이다. 따라서 b1은 "기존 기계 arm 교차참조"가 아니라 reduced-motion 최초의 기계 승격이다. 문서레벨 "재기술 금지·교차참조"는 옳지만, 계획은 reduced-motion에 현행 기계 arm이 없음을 명시하고 b1이 M2 픽스처+baseline 게이트와 위 파서 요건을 충족해야 함을 적시해야 한다.

### [MEDIUM] MO1 장식 애니메이션 승격은 STATIC 레인이며 b1과 파서 병목 공유
checklist c: 장식 배경 애니메이션 = @keyframes가 background/filter/gradient를 무한반복 → CSS @keyframes 선언 분석이므로 정적 레인(audit.js)이 맞다. geometry는 부적합: scroll=0 단일 스크린샷이라 애니메이션을 표집 못 하고, 애니메이션 그라데이션 배경은 contrast 검사에서 이미 skip(backgroundImage에 gradient 포함 시). 단 extractCssRules는 @keyframes도 못 다룬다(from/to 누출). MO1 기계화는 b1과 동일한 중첩 파서 + @keyframes→animation-name→iteration:infinite 상관까지 필요. 계획이 MO1을 후보로만 둔 것은 옳으나 공통 파서 의존을 명시해 "저비용"으로 오인되지 않게 해야 한다.

### [LOW-MEDIUM] 시각 레인 × scroll-driven 초기상태 상호작용(선존재, 본 계획이 확대) — 단일페이지 증거
스틸맨의 "inert preview가 스크립트를 떼서 geometry가 오측정" 전제는 사실 오류(geometry는 원본 HTML 렌더). 그러나 변형은 유효하다: geometry는 scroll=0에서 측정하고 isVisible은 opacity<0.05를 비가시 처리하므로, opacity:0로 시작하는 scroll-driven reveal 콘텐츠는 L1/L2/S3/TY1/TY2/DE3 측정에서 제외된다. 효과는 주로 미탐(TY1 크기 과소계수, TY2 숨은 p 스킵)이며, 위폴드가 전부 중앙·비중앙 섹션이 reveal로 숨는 구성에서만 L2 오탐 가능성. MO 계획은 scroll-driven을 권장해 노출을 키운다. exp의 0%는 단일 페이지·단일 장르라 교차장르 견고성을 입증하지 못한다. 완화: opacity:0 + animation-timeline reveal 픽스처로 시각 레인이 오탐/은폐 없음을 증명(스틸맨의 경험적 해소 지점). BLOCK 아님 — WATCH.

### [LOW] M7 레퍼런스 플랜 5절(모션 역할 모델)이 M8.1 motion-role 토큰과 중복 — 명시적 de-dup 필요
docs/reference-gallery-feature-upgrade-plan.md 5절은 motion-role/motion-budget/reduced-motion-fallback + Phase2 토큰커밋 + Phase5 LLM 판정을 이미 제안한다. M8.1도 동일 motion-role을 Phase2에 추가한다. M7.1을 별도 run으로 미루되 M7.1 범위에 SKILL Phase2/3/5 편집·5절이 포함되므로, M8이 레퍼런스 플랜 5절을 흡수함을 기록해 후속 M7.1이 재추가(병행 컨벤션 표류)하지 않게 해야 한다.

### [LOW] proposal 장르 게이트는 존재하지 않는 audit 장르 배관을 가정
R2 "proposal은 모션 검사 게이트 오프 고려". 확인: audit.js/geometry.js/cli.js에 --page/장르 입력 없음(검색 무매치; PR1 백로그가 장르 플래그 필요를 명시). WARN 전용 b1/b3에는 무해(WARN은 납품 비차단)하나, 계획은 audit 장르 게이팅이 순신규 배관임을 적시해야 한다(현재는 SKILL/LLM 레인만 장르 인지). 어떤 모션 검사라도 FAIL로 승격되면 proposal 오탐(어포던스0)이 발생 — 그래서 어포던스0 기각은 유지가 옳다.

### [LOW] WARN 레인 검사는 baseline.json 변경 불필요 — 계획이 혼동
baseline.json은 failed만 비교(주석+benchmark 확인). WARN 검사(b1/b3가 WARN이면)는 픽스처+단위테스트만 추가하고 baseline.json은 무변경. M8.2의 "baseline.json failed 매핑 갱신"은 FAIL 승격분에만 해당. 검사별로 구분 표기 필요.

## Steelman (가장 강한 안티테제)
옵션 A가 B보다 우월하다는 주장이 성립한다: (1) b1은 빈 가드 블록·가드 밖 선언으로, b3는 decoy :focus-visible 빈 룰로 우회 가능(7장 자인). (2) b1을 결정론으로 만들려면 잘 검증된 공유 파서(extractCssRules: TY4/CO1/DE1/DE3 의존)에 중첩 인지를 더해야 하고, 이는 회귀면적이 큰 변경인데 산출물은 여전히 우회 가능한 WARN이다. (3) 계획의 수용 기준(exp WARN0)이 평탄화 파서 b1과 충돌하므로, B를 강행하면 감사 신뢰도(오탐 0 규율)를 깎는다. 즉 "결정론 이득 < 파서 비용 + 우회 잔존 + 오탐 리스크"라면 A가 우월하다. 본 리뷰는 이 안티테제를 상당 부분 수용한다 — B의 어떤 항목도 적대 심사를 못 견디면 A로 강등하라는 4장/7장 게이트가 정답이며, 발견[HIGH]는 그 게이트가 발화할 가능성이 높음을 코드로 보인다.

## Trade-offs
- 결정론(기계 승격) vs 우회취약성/파서비용: B는 회귀방지를 주지만 공유 파서 확장(회귀면적) + 우회 잔존(빈 가드/decoy) 비용. 발견[HIGH] + 7장 자인으로 A가 진짜 경쟁력 있음. 자동 강등 게이트가 안전판.
- MO 텔 id (C계 확장 vs 신규 M군): C1-C5가 전부 색·질감이라 aurora/gradient-animation 같은 장식-색-모션은 C계(예: C6 animated-decoration)가 택소노미 일관. 신규 M군은 모션을 1급 도메인으로 신호하나 레인표·audit ID 공간을 분기. 어느 쪽이든 기계 승격 id는 combineAudits에서 id 병합(신규 denominator 금지)이 필수.
- 장르 게이트 vs 모션검사 범위: proposal 정적정당은 어포던스0 기각으로 보호됨. WARN 전용 유지 시 장르 배관 불요.

## Synthesis (3안)
A를 즉시 출하 + 파서 인지형 단일 기계 WARN을 분리 후행. (1) M8.1/M8.3(문서·프롬프트·시각 임팩트)은 불변식 청정·실험 입증·코드 무위험이므로 본 run에서 즉시 진행. (2) b1/b3를 본 run 기계 슬라이스로 묶지 말 것. 대신 별도 게이트 M8.2 슬라이스의 첫 산출물로 extractCssRules를 보존한 채(기존 소비자 무영향) at-rule/@keyframes 중첩 보존 헬퍼 + 단위테스트 + scroll-driven reveal 시각 픽스처(발견[LOW-MEDIUM] 스틸맨 해소)를 만든다. (3) 그 헬퍼가 적대 심사를 통과한 뒤에만 b1을 WARN(DE3 단일계기·collectWarnings·MACHINE_CHECKS 미등록·baseline 무변경)으로 승격; b3는 decoy 우회(7장)를 닫기 전까지 LLM 잔류. 이로써 픽스처+baseline 단일커밋·cap-not-quota·이중채점 금지·A 자동강등 게이트를 보존하면서 파서 비용을 "저비용 WARN" 뒤에 숨기지 않고 명시한다.

## Recommendations (우선순위)
1. [HIGH] M8.2 실행 전 b1 파서 결정 확정: 중첩 보존 헬퍼 신설(extractCssRules 불변) + exp를 clean으로 고정하는 양방향 픽스처, 또는 b1 LLM 강등. (발견 1)
2. [MEDIUM] M8.2 문구에서 b1 경로 단일화: WARN→collectWarnings 단독·MACHINE_CHECKS 미등록·baseline 무변경; FAIL→DE3 arm. (발견 2)
3. [MEDIUM] 매트릭스에 reduced-motion 현행 기계 arm 부재 명시. (발견 3)
4. [MEDIUM] MO1을 정적 레인으로 표기 + b1과 공통 파서 의존 적시, 후보 유지. (발견 4)
5. [WATCH] scroll-driven reveal 시각 픽스처 추가로 오탐/은폐 없음 증명. (발견 5)
6. [LOW] M7 5절을 M8이 흡수함을 ROADMAP/충돌해소 기록에 명문화. (발견 6)
7. [LOW] audit 장르 배관 부재 명시, WARN 전용 유지. (발견 7)
8. [LOW] WARN 검사는 baseline 무변경임을 검사별로 구분. (발견 8)

## 불변식 점검 (명시 플래그)
- 이중채점 금지: 발견[MEDIUM] M8.2의 MACHINE_CHECKS 등록 문구가 신규 denominator를 낳아 위반 위험 — 플래그. WARN/DE3-arm 경로 확정으로 해소.
- cap-not-quota: 신규 denominator 추가가 cap 철학을 깬다 — 위와 동일 경로로 해소.
- inert-safe: MO4 CSS-first 강제로 보존, 단 audit 시각 레인은 inert preview가 아니라 원본 렌더임을 정정(스틸맨 전제 오류).
- 승인 전 product 미변경: 본 산출물은 pending plan, 코드/.gjc 미편집 — 준수.

## Architectural Status
WATCH

## Code Review Recommendation
COMMENT
