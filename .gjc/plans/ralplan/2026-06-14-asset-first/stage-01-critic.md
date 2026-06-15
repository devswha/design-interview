# Critic Evaluation — design-interview 에셋 우선(asset-first) 개편 (deliberate)

정본: .gjc/specs/deep-interview-asset-first-pipeline.md · 계획: stage-01-planner.md · 아키텍처: stage-01-architect.md
게이트: Critic 합의. 모드: deliberate.

## [ITERATE]

토폴로지·접근(독립 assets CLI, 새 Phase 미신설, SSRF 가드 무변경 재사용, 빌드 비차단 exit 0)은 스펙과 1:1로 건전하고, pre-mortem 4건·확장 테스트 4레인(unit/integration/e2e/observability)도 충분하다. 그러나 계획의 핵심 강제 메커니즘이 코드로 검증한 결과 수학적으로 거짓이며, AC6는 현 범위에서 산출 불가다. 골격은 살아있고 수정은 한정적·구체적이므로 REJECT가 아니라 ITERATE — 아래 P0 두 건을 계획에 반영 후 실행.

## Justification (코드로 검증)

- F1 치명적·확정 (브랜드 가중 강제 거짓): core/interview.md 검증 — brand 가중 0.10, 임계 0.80 = 시그마(차원x가중). audience+mood+structure+conversion = 0.20x4 = 정확히 0.80. 따라서 brand=0(+reference=0)이어도 Phase 2 진입 가능. quick 모드는 audience/mood/conversion 평균 0.75로 brand를 평가에서 제외. 명료 기준(1.0) 텍스트 격상은 점수 산식을 바꾸지 않는다. 계획 3.1·AC1의 (점수 미달로 Phase 2 진입 불가 = 계획 강제) 주장은 거짓이며, 스펙 하드 제약(sourcing plan 선택을 건너뛸 수 없게 한다=필수)이 두 강제 지점 모두에서 미충족(두 번째 concept-sheet도 advisory 경고일 뿐). Architect F1 판정은 정확하며 치명적. 헤드라인 목표(에셋 반드시 해결)가 계획대로면 구성적으로 달성 불가 → 실산출물은 advisory 린터 + 인터뷰 넛지에 그친다.
- F2 확정 (AC6 산출 불가): src/intake.js readCappedBody는 Buffer.concat 후 utf8 toString, fetchSource 텍스트 전용. 바이너리 이미지 수집 경로 부재 → 크롤 본래 목적(실재 로고/스크린샷=바이너리)의 결과 에셋이 이 범위에서 생성 불가. AC6(provenance/license sidecar를 남기는 결과 에셋) 미충족. 계획은 바이너리 fetch를 후속 슬라이스로 분리하면서 AC6은 그대로 둠 → 모순.
- exit 0 자기모순 확정: src/cli.js audit 분기는 process.exit(result.pass 면 0 아니면 1)로 끝남. 계획 2절이 (audit 패턴 참고)라 적어 executor가 그대로 따르면 exit 0 계약 파손(F4). 6절에 (누락·의심 있어도 exit 0 고정) 테스트가 있으나 명명된 합격기준(AC)으로 승격되지 않음 → 계약 고정이 약함.

## Summary

- Clarity: 양호. 파일별 변경·CLI 명세·게이트 통합 구체. 단 2절 (audit 패턴 참고)가 자기모순(F4).
- Verifiability: AC1이 약점. (brand 4경로 텍스트 존재 + 명료 기준에 sourcing plan 포함)은 텍스트 존재 검증일 뿐 강제를 검증하지 못함(거의 tautology). 머신 검증 가능한 강제 신호로 재작성 필요. AC2/AC3는 exit 0·출력 3종을 코드로 검증 가능(양호). exit 0 잠금 테스트는 AC 승격 필요.
- Completeness: 토폴로지·번들샘플·문서 4종·테스트 픽스처까지 포괄. F2로 AC6 범위 미정.
- Big Picture: 스펙 토폴로지와 1:1. 양성 철학·이중채점 금지·단일HTML·런타임0 정합(Architect PASS 확인). 단 F1로 헤드라인 목표 자체 미달.
- Principle/Option Consistency: 강제를 (advisory exit 0 + 0개 허용 + 저가중 brand) 위 가중 총점에 의존시킨 것이 원칙↔옵션 모순. Opt B/C 기각 사유(입력모델 충돌, Non-Goal 위반)는 타당. 강제는 점수에서 분리해야 일관.
- Alternatives Depth: Opt A/B/C 명시·기각 근거 구체(공정). 단 F1이 드러낸 (강제 위치) 축(가중점수 vs must-answer 머신신호)이 옵션 비교에 누락 — Architect 보강 축을 흡수해야 함.
- Risk/Verification Rigor: pre-mortem 4건(사문화/슬롭범람/SSRF우회/오탐) + 4레인 테스트 + 8 검증단계 + benchmark 회귀 — deliberate 기준 충족. REJECT 트리거(pre-mortem/테스트 빈약) 해당 없음.

## 필수 수정 (실행 전, 우선순위)

1. (P0/F1) 강제 메커니즘 재설계 — 점수 의존 삭제. 3.1·AC1의 (점수 미달로 Phase 2 진입 불가) 주장 삭제/정정. 강제를 (a) 인터뷰 스킬 must-answer 규율(sourcing plan 선택을 프롬프트 레벨에서 진짜 건너뛸 수 없게) + (b) concept-sheet 에셋 계획 섹션 non-empty 머신 신호로 이중 표현. brand 가중/임계는 불변(회귀 0). AC1을 (머신 검증 가능한 non-empty 신호 + 미선택 시 Phase 5 요약에 억제 불가 advisory)로 재작성.
2. (P0/F2) AC6 범위 확정 — (a) 동일 SSRF 가드·5MB/30s 캡 적용한 바이너리 fetch를 범위에 포함하고 결과 에셋 sidecar 검증을 AC로; 또는 (b) AC6을 (절차 명문화 + 가드 재사용 + 텍스트/메타 sidecar)까지로 공식 축소하고 합격기준 문구 재작성. 현 상태(바이너리 보류 + AC6 불변)는 모순이므로 불가.
3. (P1/exit) exit 0 계약 고정 — 2절 (audit 패턴 참고) 제거, (검사 결과와 무관하게 무조건 process.exit(0))만 명시. suspect/missing non-empty에도 exit 0임을 잠그는 테스트를 명명된 합격기준(AC)으로 승격. 입력 오류 exit 2도 AC로.
4. (P1/F3) 휴리스틱 면책·권위 단일화 — assets 리포트에 (best-effort 휴리스틱, S2 권위 = LLM 레인 built.html) 면책 문구 + reason 노출 유지 + sidecar 명목적/trademark/주체 근거 시 음성. (CLI 통과 = 깨끗) 거짓안심 방지 문서화.
5. (P2/F5) assets 항상 exit 0·CI 게이트 금지 사용법/문서 강조(푸터 이미 존재 — 문서로도 명문).

## Routing
- 계획 개정(F1 재설계, AC1/AC6 재작성, exit AC 승격) → planner.
- 개정안 재검토 시 architect WATCH→재평가, 본 Critic 재게이트.
