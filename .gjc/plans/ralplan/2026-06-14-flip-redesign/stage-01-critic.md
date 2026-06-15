# RALPLAN-DR — flip-redesign Critic 평가 (stage critic/1)

run-id: 2026-06-14-flip-redesign · read-only · product/.gjc 미변경

**[ITERATE]**

## Justification
Planner 계획(stage-01-planner)은 뒤집기의 방향(audit의 cap/억제 공리가 표현을 무난함으로 수렴 → 차단 표면을 품질바닥선으로 좁힘)은 코드 증거로 타당하나, Architect가 짚은 두 HIGH 결함이 계획 본문에 **아직 반영되지 않았다**. 코드 대조로 두 결함 모두 사실 확인:

1. **분할선 오설정(슬롭 게이트 정전).** M9.2는 C1·T1·T2·T4·S5·TY4·CO1·DE1을 전부 advisory(exit 무영향)로 내린다. src/audit.js MACHINE_CHECKS의 9검사 중 blocking에 남는 건 DE3뿐. baseline.json상 slop-source.failed=[C1,T1,T2,T4] — 어느 것도 DE3가 아니다 → slop-source의 blockingFailed===[] → exit 0. tests/e2e/pipeline.test.js:37-40('slop must not pass', FAIL C1/T1/T2/T4, 납품 불가)이 **거짓이 되어 깨진다**. 결정론적 지문 차단이 0이 됨. 불변식이 허용한 강등 범위는 '표현 억제 규칙(패밀리 cap·단일강조·webfont금지·절제강요)'이지 결정론적 지문(C1/T1)이 아니다 — 범위 초과 강등. 게다가 M9.1 doctrine(C1/T1을 '하드 텔 유지'로 분류) ↔ M9.2 channel(advisory) 자가모순.

2. **게이트 혼동(회귀망 손실).** M9.5는 benchmark를 blocking-only(exit 1)로 좁히고 advisory는 리포트만. benchmark.mjs:23-30은 auditHtml().failed 전체를 miss+fp로 비교하는 *탐지기 정확도* 게이트다. blocking-only면 principle-violations.html이 기대한 8개 advisory(C1/T2/T4/S5/TY4/CO1/DE1; baseline상 9 failed)의 탐지 후퇴(miss)와 clean/restaurant·svg-attr-color-smuggle의 오탐(fp)이 침묵 통과. '의도 초과 가능'은 product 산출물의 자유지 탐지기 픽스처에 적용할 게 아니다.

방향은 유지하되 Architect 권고(분할선 재설정 + 게이트 2분리)를 계획에 반영하면 슬롭 게이트와 회귀망을 보존하면서 뒤집기 의도를 달성한다. 고치기 전엔 슬롭 게이트가 정전되므로 OKAY 불가 → ITERATE.

## Summary
- **Clarity**: 양호. 옵션 A/B/C·시퀀싱 M9.1~9.5·핸드오프 슬라이스 명확. 단 M9.1(하드텔 유지) ↔ M9.2(전부 advisory) 분류 자가모순으로 분할선이 모호.
- **Verifiability**: 부분. 검증 명령 1~7은 구체적·실행가능. 그러나 (a) 수용 기준에 'slop-source exit 1' 항목이 없어 게이트 정전을 잡지 못하고, (b) M9.5 benchmark blocking-only가 '회귀 0' 기준과 충돌(advisory miss/fp 비게이트). 세 핵심 클레임(v6 blockingFailed===[], slop exit 1, benchmark advisory도 miss/fp)은 *Architect 보정 분할선 하에서는* 동시 코드검증 가능·무모순(v6는 C1 미발화 확인 — repeating-linear-gradient+var(--grid), 인디고는 solid라 hex hue 230-300 미해당). 하지만 계획 현안은 두 번째·세 번째 클레임을 자기 본문에서 위반한다.
- **Completeness**: 보통. 클레임 보존(Phase5 수동)·보안(inert)·이중채점(DE3 단일 ID 병합) 보존은 정확히 명시. 빠진 것: slop-source 회귀 픽스처의 exit-1 수용기준, benchmark 양채널 비교, severity 누락 finding 기본값, slopScore 키 존속 범위(geometry.test.js 미언급).
- **Big Picture**: 양호. D1/D2/D3 드라이버와 3중 장치 구상 건전. 단 '결정론적 방어 = 하드텔 blocking + 품질바닥선'이라는 점이 흐려져, POV/큐레이션(LLM 비결정론)에 과의존하는 인상.
- **Principle/Option Consistency**: 위반. 불변식('표현 억제 규칙만 강등')과 M9.2(지문까지 강등) 불일치. 차단/권고 분류 정당성 결함(아래 4번).
- **Alternatives Depth**: 양호. A(부분집합)·B(권고)·C(디스코프) 구분·근거 충실, 대안 무효화 조항 처리도 명시.
- **Risk/Verification Rigor**: 보통. R1~R6 적절하나 R1이 '결정론적 지문 게이트 상실' 리스크를 누락(가장 큰 위험). benchmark baseline 분할이 benchmark.mjs(.failed만, --visual 미실행=정적 9검사 한정)와 정합하게 개수되는지 미확인 — 시각 advisory 5종은 benchmark가 도달 못 함.

## 강제 기준 판정
1. **원칙-옵션 일관성**: ✗ — Architect 분할선 재설정·게이트 2분리 미반영. ITERATE 사유.
2. **수용기준 검증가능성**: △ — 보정 분할선 하에선 세 클레임 무모순·코드검증 가능(v6 C1 미발화 확인). 그러나 계획 현안은 'slop exit 1'을 수용기준에서 누락하고 benchmark blocking-only로 세 번째 클레임을 위반 → 현 상태로는 상호 모순.
3. **슬롭 재발 구체성**: ✗ — POV/큐레이션이 LLM 비결정론임을 명시하지 않고, 결정론적 방어가 '하드텔 blocking + 품질바닥선'이라는 점을 못박지 않음. 오히려 하드텔을 advisory로 내려 결정론 방어를 비움.
4. **차단/권고 분류 정당성**: ✗ — C1·T1(결정론 지문)은 blocking이어야 함(불가 강등). T2 hype·T4 대칭3연도 결정론 지문 → blocking 권장(경계 명시 필요). TY4·CO1·DE1·S5·시각 L1/L2/S3·TY1/TY2(억제 휴리스틱)만 advisory 정당. L2(전부중앙)·L1(균일그리드)은 신호/노이즈 경계 → 명시 권고.
5. **구체 검증 단계 정합**: △ — benchmark.mjs는 .failed만, --visual 미실행(정적 9검사 한정; baseline feature-grid 노트가 'L1은 geometry.test.js'로 이를 고정). 따라서 baseline {expectedBlocking,expectedAdvisory} 분할은 **정적 9검사만** 열거해야 정합. 시각레인 advisory 회귀는 benchmark가 아니라 geometry.test.js가 게이트 — 계획이 'benchmark가 12검사 게이트'로 적으면 개수 불일치.

## Planner 다음 패스 필수 액션 (우선순위·섹션·방법)
**P0-1 (HIGH, M9.2 + audit 가드레일 설계 절):** 분할선 재설정. C1·T1을 advisory→**blocking**으로 이동. T2·T4도 **blocking 유지**(결정론 지문; 경계상 애매하면 그 사유를 한 줄 명시하되 기본은 blocking). advisory에는 억제 휴리스틱만 남김 = TY4·CO1·DE1·S5·시각 L1/L2/S3·TY1/TY2. M9.1 design-tells 분류표(하드텔 유지)와 M9.2 채널을 일치시켜 자가모순 제거. 결과: e2e/baseline 게이트 보존(갱신 불필요).

**P0-2 (HIGH, M9.5):** 게이트 2분리 명문화. (a) **CLI exit = blockingFailed만**(납품 게이트, product 산출물은 advisory 의도 초과 허용). (b) **benchmark = 전체 failed(blocking∪advisory) miss+fp 비교 유지**(탐지기 정확도 게이트). benchmark.mjs가 .failed만 보는 정적 레인 전용임을 명시하고, baseline {expectedBlocking,expectedAdvisory} 분할은 **정적 9검사만** 열거(시각 advisory는 geometry.test.js가 별도 게이트). 'blocking 회귀만 exit 1' 문구 삭제.

**P1-3 (MEDIUM, 수용 기준 절):** 'slop-source.html audit → exit 1 (C1/T1 blocking 재현)' 수용기준 추가. 클레임 보존을 exit-1 픽스처 목록(DE3 4암·렌더대비·TY5-A)에서 분리하여 'Phase5 수동 diff 보존 확인'으로 별도 명기(기계 arm 없음 — CLAUDE.md:66, SKILL.md:115).

**P1-4 (MEDIUM, Principles 4 + R1):** '결정론적 방어 = 하드텔 blocking + 품질바닥선'을 명시하고, POV/큐레이션은 LLM 비결정론임을 인정. R1에 '결정론적 지문 게이트 정전' 위험을 등재하고 완화책으로 하드텔 blocking 유지를 명기.

**P2-5 (LOW, M9.2/리스크):** L1 강등 시 실그리드 슬롭 신호 손실을 R-리스크로 등재, 또는 L1 blocking 유지 + 다이어그램 면제만 당김(C 디스코프 명시).

**P2-6 (LOW, 핸드오프 슬라이스 1):** slopScore 키 존속(별칭) 확정 + geometry.test.js(merged.slopScore 단언 5개) 갱신을 슬라이스 1에 추가. analyzeVisualTells 반환에 severity 부여, 누락 finding 기본값 = **blocking(fail-safe)** 명기.

## 영속화 메모
계획 현안은 슬롭 게이트 정전(C1/T1 advisory)과 회귀망 약화(benchmark blocking-only)로 OKAY 불가. 위 P0 2건 반영 시 다음 패스 OKAY 후보. 클레임 보존·보안·이중채점 불변식 위반 없음.
