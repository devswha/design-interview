# RALPLAN-DR rev2 — flip-redesign Architect 재리뷰 (stage architect/2)

run-id: 2026-06-14-flip-redesign · read-only · product/.gjc 미변경 · 대조: stage-02-revision.md vs stage-01-architect.md/stage-01-critic.md + 코드(src/audit.js·cli.js·benchmark.mjs·tests)

## Summary
개정안(rev2)은 1차 두 HIGH(분할선 재설정·게이트 2분리)와 P1/P2 4건을 코드정합하게 모두 해소했다. 잔존 BLOCK급 없음. 신규 결함은 e2e 2/4b의 'FAIL S3' 단언이 S3→advisory 강등 + 2섹션 출력 재라벨과 충돌하는 핸드오프 정밀도 갭(MEDIUM) 1건뿐이며, 수용기준 'npm test green(unit+e2e)' 게이트가 강제 해소하고 수정이 사소하다. → CLEAR / COMMENT.

## Analysis (해소 항목별 코드대조 판정)

1. **분할선 재설정 — 해소 OK (1차 HIGH-1).** rev2 개정요지·Principles 3·M9.1 분류표·M9.2 채널·audit 가드레일 상세 모두 C1·T1·T2·T4를 blocking 유지, advisory엔 억제 휴리스틱(TY4·CO1·DE1·S5·시각 L1/L2/S3·TY1/TY2)만 둔다. M9.1 doctrine 대 M9.2 channel 1:1 명문화로 자가모순 제거. 코드대조: baseline.json examples/slop-source.failed=[C1,T1,T2,T4] → 전부 blocking → blockingFailed 비어있지 않음 → exit 1. tests/e2e/pipeline.test.js:37-40 'slop must not pass'(C1/T1/T2/T4 FAIL + 납품불가) 보존. 불변식 강등범위(표현 억제 규칙) 준수, 지문 강등 없음.

2. **게이트 2분리 — 해소 OK (1차 HIGH-2).** rev2 M9.5: (a) CLI exit=blockingFailed만, (b) benchmark=auditHtml().failed 전체(blocking∪advisory) miss+fp 비교 유지. '의도 초과는 product 산출물에만, 탐지기 픽스처엔 미적용' 명시. 코드대조: benchmark.mjs:23 actual=auditHtml(html).failed는 severity 무관 전체 fail을 반환하므로 비교 로직 무변경, baseline {expectedBlocking,expectedAdvisory} 정적 9검사 분할은 union 복원으로 miss/fp 동등. '시각 advisory(L1/L2/S3/TY1/TY2) 회귀는 benchmark(.failed·--visual 미실행)가 아니라 geometry.test.js가 게이트'를 정확히 짚어 critic 강제기준 5(개수 정합) 해소.

3. **수용기준 무모순 — 해소 OK (1차 MEDIUM/critic P1-3).** 세 클레임(v6 blockingFailed 빈배열·slop exit 1·benchmark 전체 miss+fp)이 동일 분할선 하에서 상호 무모순. slop은 baseline상 C1/T1 blocking 발화, v6는 비발화. v6 비발화 경험적 근거 재확인: v6-skillshop-flipped.html에 outline:none/transition:all/user-scalable/maximum-scale/img 태그 부재(DE3 정적 4암 통과·focus-visible 정상 outline line49), 하이프 매치는 전부 CSS transform 선언(T2는 본문텍스트만 검사→무발화), C1은 1차 critic 확인(repeating-linear-gradient+var, 인디고 solid). 검증단계 4가 executor 재현.

4. **클레임보존 Phase5 분리 — 해소 OK (1차 MEDIUM).** rev2 수용기준 '클레임 보존은 Phase5 수동 diff — exit-1 픽스처 목록과 분리(기계 arm 없음)' + 'audit 가드레일 설계 비차단·비기계' 절에 CLAUDE.md:66/SKILL.md:115 근거 명기. exit-1 픽스처와 비혼동.

5. **결정론 방어 명문화 — 해소 OK (1차 critic P1-4).** Principles 4 '결정론적 방어=하드텔 blocking+품질바닥선, POV/큐레이션은 LLM 비결정론'. R1에 '결정론적 게이트 정전(HIGH)' 위험 + 완화책(하드텔 blocking 유지) 등재.

6. **L1 신호손실 — 해소 OK (1차 MEDIUM/P2-5).** rev2 R6에 L1 advisory 신호손실 리스크 등재 + 대안(b: L1 blocking 유지 + 다이어그램 면제), 기본권고(a) 스코핑 단순, Option C로 정제 디스코프. executor 슬라이스 결정점 명시.

7. **slopScore 존속 + severity — 해소 OK (1차 LOW 2건).** rev2: slopScore 키 존속(별칭, failed/total 그대로) + blockingScore/advisoryScore 추가. 코드대조: geometry.test.js:39/47/55/64/74 merged.slopScore 단언과 audit.test.js:31 r.slopScore===0 보존(.failed가 union 유지하므로 audit.test.js:41/43/64/69 .failed.includes(TY4/S5) 단언도 전부 보존). severity 누락 finding=blocking 기본(fail-safe), combineAudits existing.severity 캐리 명문화, geometry.test.js 슬라이스1 동시갱신 핸드오프 포함.

8. **reduced-motion 과대진술 — 해소 OK (1차 INFO).** rev2 '현행도 exit 게이트 아님→강등 없음, 불변식 텍스트에서 현행 blocking으로 칭하지 않음(과대진술 금지)'. audit.js:181 WARN 전용과 정합.

## Root Cause
없음(개정이 1차 근본원인=분할선 오설정+게이트 혼동을 정면 해소). 1차 root cause는 '지문(C1/T1/T2/T4)과 억제 휴리스틱을 한 묶음으로 강등 + 납품/탐지기 게이트 혼동'이었고, rev2가 분할선을 지문+바닥선=차단/억제휴리스틱=권고로, 게이트를 CLI=blocking·benchmark=union으로 재구획해 제거.

## Findings (신규 + 잔존)

### [MEDIUM] e2e 2/4b 'FAIL S3' 단언이 S3 advisory 강등 + 2섹션 출력과 충돌 (신규)
rev2는 S3(perfect-symmetry)를 advisory로 내리고 cli.js 출력을 'BLOCK/advise 2섹션'으로 바꾼다. 그러나 tests/e2e/pipeline.test.js:45 단언은 'FAIL 공백 S3 perfect-symmetry' 정규식으로 S3가 FAIL 라벨로 출력될 것을 요구한다. formatAuditReport가 advisory finding을 FAIL이 아닌 다른 문구(advise 등)로 재라벨하면 2/4b가 깨진다. rev2의 'e2e 갱신 불필요'는 slop must-not-pass(2/4·정적·exit 1)에 한정되며 2/4b(시각 advisory 라벨 단언)를 reconcile하지 않는다. (L1 단언 line46은 FAIL 프리픽스 없어 무관, exit code는 blocking C1/T1/T2/T4로 1 유지.)
- 영향: 비차단. 수용기준 'npm test green(unit+e2e)'가 강제 노출·해소, 수정 사소.
- 수정: 슬라이스1/2 핸드오프에 명문화 — (권장 a) advisory finding도 per-finding FAIL 라벨 유지하되 BLOCK/advise는 섹션 헤더·마커로 구분(2/4b 보존), 또는 (b) e2e 2/4b:45 단언을 advise 라벨로 갱신. '갱신 불필요'를 정적 2/4로 한정 표기.

### [LOW] geometry.test.js combineAudits pass===false 단언과 severity 상호작용 미명시 (신규/경미)
geometry.test.js:40·57 merged.pass===false 단언은 severity 모델에 민감. line57(DE3)은 blocking이라 pass=false 유지. line40 L1 합성 finding은 severity 미부여→fail-safe blocking→pass=false 유지(현행 그대로 green). 단 executor가 production 반영차 L1에 severity advisory를 부여하면 pass=true로 뒤집혀 단언 갱신 필요. rev2가 'geometry.test.js severity 동시갱신'은 적되 pass 단언 플립은 미명시.
- 수정: 슬라이스1에 'advisory-only 실패 시 pass=true; 합성 finding severity 부여 여부에 따라 pass 단언 동기화' 한 줄 추가. fail-safe 기본 덕에 미부여 시 무수정 green.

### [INFO] formatAuditReport '납품 불가'/slop score 요약 문구 일관성
v6는 blockingFailed 빈배열→pass=true→'machine checks clean'이나 advisory(TY4 등) FAIL이 떠 slop score>0. rev2가 'BLOCK/advise 2섹션' 재서술로 명시 의도. 코드조치는 슬라이스1 범위 내, 결함 아님.

## Recommendations
1. (MEDIUM) 슬라이스1/2 핸드오프에 e2e 2/4b S3 라벨 처리 명문화: advisory도 FAIL per-finding 라벨 유지(권장) 또는 2/4b:45 갱신. '갱신 불필요'를 정적 slop(2/4)로 스코프 한정.
2. (LOW) 슬라이스1에 advisory-only pass=true 의미와 geometry.test.js pass 단언 동기화 규칙 한 줄 추가.
3. 그 외 8개 해소 항목은 추가 조치 불요(과잉 재지적 금지).

## 신규 결함(개정이 만든 새 모순) 여부
불변식 위반 신규모순 없음: 클레임 보존(Phase5 수동, 분리)·inert 보안(범위밖 무변경)·품질바닥선 차단(DE3 4암+시각DE3대비+TY5-A 전부 blocking)·이중채점 금지(DE3 단일ID 병합+severity 캐리 명문화) 전부 보존. .failed가 union 유지되어 audit.test.js의 .failed.includes(S5/TY4) 단언군 무손상. 신규는 위 MEDIUM/LOW 테스트정합 갭뿐.

## 잔존 리스크
- BLOCK급: 없음. 두 HIGH 모두 코드정합 해소.
- executor 핸드오프 가능 수준: 예. 슬라이스1(audit 2채널)·2(baseline/benchmark/픽스처/e2e)·3(문서)·검증단계1~8 구체. 위 MEDIUM 1건만 슬라이스 명세에 한 줄 보강 권장(비차단, 게이트가 강제).

## Architectural Status
CLEAR

## Code Review Recommendation
COMMENT

## Trade-offs
| 항목 | 1차 계획(as-is) | rev2 |
| 결정론 슬롭 게이트 | 정전(C1/T1 advisory) | 보존(하드텔 blocking) |
| 회귀망(benchmark) | blocking-only 12검사 손실 | union 전체 miss+fp |
| e2e/baseline | 깨짐(slop must pass 거짓) | 보존(2/4) / 2/4b 라벨만 보강 필요 |
| 비용 | — | 소(분할선·스키마·문구) |
| 잔존 위험 | HIGH x2 | MEDIUM x1(테스트라벨, 게이트 강제) |
