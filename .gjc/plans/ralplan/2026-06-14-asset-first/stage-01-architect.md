# Architect Review — design-interview 에셋 우선(asset-first) 개편 (Planner stage-01)

정본: .gjc/specs/deep-interview-asset-first-pipeline.md · 계획: .gjc/plans/ralplan/2026-06-14-asset-first/stage-01-planner.md
모드: deliberate · 레인: 아키텍처 건전성 + 코드리뷰 규율

## Summary
토폴로지 결정(독립 assets CLI 분리, 새 Phase 미신설, SSRF 가드 무변경 재사용, 빌드 비차단 exit 0)은 아키텍처적으로 건전하고 스펙 토폴로지와 1:1로 맞는다. 그러나 에셋-우선의 핵심 강제 메커니즘이 수학적으로 성립하지 않는다 — brand 가중치 0.10·총점 임계 0.80 구조에서는 sourcing plan 미선택으로도 Phase 2 진입이 가능하므로, 스펙 하드 제약(sourcing plan 선택을 건너뛸 수 없게 한다=필수)이 충족되지 않는다. 또한 consent 크롤의 결과 에셋(AC6)이 현 범위에서 산출 불가다. 이 두 spec-compliance 갭 때문에 변경을 요청한다.

## Analysis (file-backed)
- core/interview.md: 6차원 가중합, brand 0.10, 임계 0.80(=Σ dim×weight). 핵심 4차원(audience 0.20 + mood 0.20 + structure 0.20 + conversion 0.20)만으로 정확히 0.80. --quick=audience/mood/conversion 3차원 평균 0.75로 brand를 아예 제외. 명료 기준(1.0) 텍스트 격상은 점수 산식을 바꾸지 않는다.
- src/cli.js: 허용커맨드 [intake,preview,audit,shot], 가드 (!includes||rest.length===0)→usage() exit 2. audit 분기는 process.exit(result.pass ? 0 : 1)로 끝나고, intake 실패도 exit 1, 입력오류는 fail(...,2). 즉 기존 분기 중 exit 0 고정은 없다.
- src/intake.js: assertSafeUrl(2단)+guardedLookup(연결시점 재검증)+리다이렉트 hop 재검증+5MB/30s 캡. fetchSource는 utf8 텍스트 전제(readCappedBody→텍스트). 바이너리 수집 경로 부재.
- src/audit.js: 이중채점 금지는 같은 원칙 ID를 같은 denominator에 두 번 넣지 않는 것(combineAudits 병합)으로 구현. S2는 기계 레인 비대상.
- core/design-tells.md: S1/S2는 LLM 레인 하드차단(built.html). 기계 레인이 커버하는 텔은 LLM 자기채점 금지.
- core/asset-library.md 인벤토리: icons/{openai,anthropic...}는 트레이드마크-명목적 참조 한정, 근거 없으면 S2. 즉 정당한 명목 로고가 휴리스틱 오탐 후보.

## Root Cause
강제를 가중 총점 임계에 의존하도록 설계했다. 그러나 양성 철학(advisory exit 0 + 0개 허용 + 저가중 brand)과 가중 총점은 구조적으로 강제를 만들 수 없다. asset-first는 본질적으로 차단 없는 강제를 요구하는데, 계획은 이를 점수로 풀려다 모순에 빠졌다 — 정작 강제되는 지점이 어디에도 없다.

## 강력한 Steelman 안티테제
advisory-only + 가중 점수 위에서 에셋-우선은 용어 모순이다. 어디서도 막지 않고(전부 exit 0), 0개도 허용되며, brand 가중치 0.10은 임계 0.80을 움직이지 못하고, concept-sheet 빈 섹션 경고도 advisory다. 그렇다면 first는 순전히 희망사항이며 실제로 만들어지는 것은 (1) 인터뷰가 질문을 일찍 던지고 (2) 메모를 한 줄 남기는 것뿐이다. 사용자(또는 디폴트로 수렴하는 에이전트 자신)는 samples를 한 번 찍거나 brand 차원을 통째로 건너뛰고도 모든 게이트를 통과해 동일한 슬롭을 빌드할 수 있다. 계획은 premortem #1에서 이 사문화를 스스로 인정한다. 가장 설득력 있는 반대: 스펙 헤드라인 목표(에셋을 반드시 해결)는 자기 제약 아래서 구성적으로 달성 불가능하며, 실제 산출물은 asset-first 파이프라인이 아니라 advisory 에셋 린터 + 인터뷰 프롬프트 넛지다. 정직하게 재명명하거나, 철학이 허용하는 단 하나의 하드 게이트를 도입하라: 파일이 아니라 sourcing plan 선택 자체를 인터뷰 프롬프트 레벨에서 진짜로 건너뛸 수 없게(must-answer) 만들고, 그 결과를 Phase 5 납품 요약에 억제 불가 advisory로 노출.

## 진짜 Tradeoff 긴장
1) advisory-only(exit 0) vs 에셋-우선 실효성: 안 막으면 정말 first가 강제되는가 — 아니오. 비차단은 정의상 강제를 만들지 못한다. 계획은 점수를 강제 장치로 제시했지만 위 산수로 거짓이다. 해소: 파일이 아닌 결정을 강제 — sourcing plan 선택을 인터뷰에서 must-answer로(머신검증 가능 신호 = concept-sheet 에셋 계획 섹션 non-empty), 빌드 exit 0은 유지하되 미선택을 Phase 5 요약에 억제 불가 경고로 가시화.
2) 독립 assets CLI vs audit 통합: 분리는 exit 계약(audit는 fail시 exit 1)과 입력 모델(audit=단일 파일, assets=디렉터리)을 보존(정답). 대가는 명령 3개째와 S2 의미 중복. 해소: 분리 유지 + 권위 단일화(S2 하드라인 권위 = LLM 레인 built.html; assets CLI = 빌드 전 결정론 힌트)를 문서에 명문.
3) S4/S2 기계 검증 불가능성: 게으른/범용/안 어울림(슬롭 룩)과 실재 날조 판정은 본질적으로 의미 판단 → LLM 레인 잔류가 맞다. 계획은 S4를 LLM 레인에 유지하고 기계 비승격을 명시하므로 정합. 해소 불필요(이 부분은 올바름). assets CLI는 provenance/sidecar/날조-메타만(결정론), genericness 판정은 절대 하지 않는다 — 계획이 이 경계를 지킴.

## Synthesis (긴장 해소 방향)
- 강제를 점수에서 분리하라: brand 가중/임계는 손대지 말고(회귀 0), sourcing plan 선택을 인터뷰 스킬의 must-answer 규율 + concept-sheet 섹션 non-empty 머신 신호로 이중 표현. 빌드는 계속 exit 0.
- assets CLI suspect와 LLM 레인 S2는 서로 다른 denominator(디렉터리 vs built.html)이므로 이중채점이 아니다 — 단, defense-in-depth로 상보적임과 권위 소재를 문서로 못박아 혼선을 차단.
- 크롤은 텍스트 절차/가드 재사용까지만 이번 슬라이스로 인정하고 AC6를 그 범위로 공식 축소하거나, 바이너리 fetch를 범위에 포함하라(현 상태로는 AC6 미충족).

## Findings

### F1 (HIGH) — 강제 메커니즘이 수학적으로 거짓 / 스펙 하드제약 미충족
참조: stage-01-planner.md §3.1, §2 core/interview.md / core/interview.md:1-20
영향: 계획은 "sourcing plan 택1해야 brand 명료 기준 도달 → 미선택 시 점수 미달로 Phase 2 진입 불가(=계획 강제)"라 한다. 그러나 임계 0.80은 가중 총점에 걸리고 brand는 0.10이다. audience+mood+structure+conversion=0.80만으로 임계 충족 → brand=0(+reference=0)이어도 Phase 2 진입 가능. --quick은 brand를 평가에서 제외. 따라서 스펙 제약 "sourcing plan 선택을 건너뛸 수 없게 한다(필수)"가 두 강제 지점 모두에서 성립하지 않음(두 번째 지점 concept-sheet도 advisory 경고일 뿐). 수정: 강제를 per-dimension 플로어가 아니라 인터뷰 프롬프트 must-answer + concept-sheet 에셋 계획 섹션 non-empty(머신 검증)로 구현하고, 계획 문서에서 점수-강제 주장을 삭제/정정. 빌드 exit 0 유지.

### F2 (MEDIUM-HIGH) — AC6 결과 에셋 산출 불가(크롤 바이너리 미구현)
참조: stage-01-planner.md §2 src/intake.js 절, §7 AC6 / src/intake.js fetchSource
영향: 스펙 AC6은 크롤 결과 에셋에 provenance/license sidecar를 남길 것을 요구. 그러나 fetchSource는 utf8 텍스트 전용이고 계획은 바이너리 fetch를 후속 슬라이스로 분리. 크롤의 본래 목적(실제 로고/스크린샷=바이너리 이미지) 산출물이 이 범위에서 생성 불가 → AC6 부분 미충족. SSRF 가드 재사용 자체는 올바르나 결과 에셋이 없다. 수정: (a) 바이너리 fetch(캡/가드 동일 적용)를 범위에 포함하거나 (b) AC6을 절차 명문화+가드 재사용까지로 공식 축소하고 합격기준 재작성 후 승인.

### F3 (MEDIUM) — S2 휴리스틱 회피 용이 / 거짓안심 위험
참조: stage-01-planner.md §2 detectFabrication, §5 premortem #4 / core/design-tells.md S1·S2 LLM 레인
영향: 3신호는 파일명 + 정직한 sidecar source에 의존. 날조 로고를 partner-1.svg로 개명하면 신호1 회피, 가짜 스크린샷에 source=AI생성을 안 적으면 신호2 회피 → 가장 위험한 거짓 음성(false negative)에 취약. 또 known-brand 파일명 목록은 신규 브랜드 미포착으로 노후화. 정당한 명목 로고(인벤토리의 openai.svg 등)는 거짓 양성 후보. advisory로서는 수용 가능하나 "CLI 통과=깨끗"이라는 거짓안심을 막아야 함. 수정: 리포트에 "best-effort 휴리스틱, S2 권위는 LLM 레인" 면책 문구 + reason 노출 유지 + sidecar 명목적/trademark/주체 근거시 음성. LLM 레인 S2 하드라인 권위 유지(계획 준수). 

### F4 (LOW, footgun) — assets exit 0 가이드가 audit 패턴 참조로 모호
참조: stage-01-planner.md §2 src/cli.js 절("분기(audit 패턴 참고)") / src/cli.js audit 분기
영향: audit 분기는 process.exit(result.pass ? 0 : 1)로 끝난다. "audit 패턴 참고" 문구를 executor가 그대로 따르면 exit 0 계약이 깨진다. 계획이 "분기 끝 process.exit(0) 고정"과 테스트 고정을 명시해 완화하나 가이드 문구가 자기모순적. 수정: 가이드에서 audit exit 패턴 참조 제거, "검사 결과와 무관하게 무조건 process.exit(0)"만 남기고 suspect/missing 존재시 exit 0을 잠그는 테스트를 필수 합격기준으로.

### F5 (LOW) — CLI suite 간 exit 의미 분기로 CI 오게이팅 위험
참조: stage-01-planner.md §4 / src/cli.js
영향: audit/intake 실패=exit 1, assets=항상 0. CI 작성자가 assets를 게이트로 쓰면 문제 있어도 false green. 의도된 advisory 설계지만 혼동 위험. 수정: 사용법/문서에 "assets는 항상 exit 0, 게이트 금지" 명시(이미 푸터 있음 — 문서로도 강조).

## 원칙 위반 플래그 (deliberate, 명시 점검)
- 단일 HTML·런타임 0: PASS — src/assets.js는 node:fs/promises만 사용(신규 의존 0), 번들 샘플은 자가호스팅 SVG, 빌드 산출물/조립 경로 무변경. 크롤 바이너리 보류도 의존을 추가하지 않음.
- SSRF 안전: PASS(가드 무변경 재사용: assertSafeUrl 2단 + 연결시점 lookup 훅 + 리다이렉트 재검증 + 5MB/30s). 단 F2의 바이너리 경로는 미구현이라 동일 가드 적용은 후속에서 검증 필요.
- 이중채점 금지: PASS — assets CLI는 audit denominator에 합류하지 않는 별도 advisory 도구이며 audit가 보는 텔을 재판정하지 않고 에셋 파일 메타만 본다(계획 Principle 5·Opt B 기각 근거). WATCH: S2 의미 커버리지가 LLM 레인과 중복되나 동일 denominator가 아니므로 정의상 위반 아님 — 권위 소재 문서화 권고(F3).
- claim 보존: PASS — intake.js 클레임 추출/대조 파이프라인 무변경, 에셋 작업이 claim 경로를 건드리지 않음.
- advisory exit 0: 설계상 PASS, 단 F4 footgun + 계약 고정 테스트 필수.

## Recommendations (우선순위)
1. (P0/F1) 점수-강제 주장 정정 — 강제를 인터뷰 must-answer 규율 + concept-sheet 섹션 non-empty 머신 신호로 재설계. brand 가중/임계 불변 유지.
2. (P0/F2) AC6 범위 확정 — 바이너리 fetch 포함 또는 AC6 공식 축소 후 합격기준 재작성.
3. (P1/F3) 휴리스틱 면책 문구 + 권위 단일화(S2=LLM 레인) 문서화.
4. (P1/F4) exit 0 가이드 문구 정정 + suspect/missing 존재 시 exit 0 잠금 테스트 필수화.
5. (P2/F5) assets 항상 exit 0·게이트 금지 문서 강조.

## Architectural Status
WATCH

## Code Review Recommendation
REQUEST CHANGES

## Trade-offs
| 축 | Option A (계획 채택) | 대안 | 권고 |
|---|---|---|---|
| 강제 위치 | 가중 점수 의존(거짓) | 인터뷰 must-answer + concept-sheet non-empty 머신 신호 | 대안으로 교체(F1) |
| 검사 도구 | 독립 assets CLI(디렉터리, exit 0) | audit advisory 흡수 | A 유지(입력모델/exit계약 보존) |
| 크롤 범위 | 텍스트+절차만, 바이너리 보류 | 바이너리 fetch 포함 | 범위 확정 필요(F2) |
| S2 검증 | 결정론 휴리스틱(advisory) + LLM 하드라인 | 기계 승격 | A 유지 + 권위 단일화·면책(F3) |
| S4 검증 | LLM 레인 잔류(기계 비승격) | 기계 승격 | A 유지(의미 판단=LLM, 올바름) |
