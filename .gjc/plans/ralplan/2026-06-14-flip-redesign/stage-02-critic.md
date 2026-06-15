# RALPLAN-DR rev2 — flip-redesign Critic 재리뷰 (stage critic/2)

run-id: 2026-06-14-flip-redesign · read-only · product/.gjc 미변경 · 대조: stage-02-revision.md vs stage-01-critic.md(P0/P1/P2) + Architect/2 + 코드(src/audit.js·cli.js·benchmark.mjs·tests/e2e·baseline.json)

**[OKAY]**

## Justification
rev2는 1차 P0 2건과 P1/P2 4건을 코드정합하게 모두 해소했다. 잔존은 Architect/2가 짚은 비차단 MEDIUM 1건(e2e 2/4b S3 라벨)·LOW 1건(geometry pass 단언)뿐이며, 둘 다 계획에 이미 박힌 npm-test-green 게이트(수용기준 9·검증 8)가 기계적으로 강제 노출·해소하고 fail-safe 기본이 green을 유지한다. 진짜 차단 결함 없음 → OKAY.

코드 1:1 대조:
- P0-1 해소. rev2 Principles 3·M9.1 분류표·M9.2 채널·가드레일 상세가 C1·T1·T2·T4 blocking 유지, advisory엔 억제휴리스틱(TY4·CO1·DE1·S5·시각 L1/L2/S3·TY1/TY2)만. M9.1 doctrine과 M9.2 channel 1:1 명문(자가모순 제거). baseline.json examples/slop-source.failed=[C1,T1,T2,T4] 전부 blocking → exit 1, e2e pipeline.test.js:39-40 slop must not pass(2/4) 보존. 불변식 강등범위(표현 억제) 준수.
- P0-2 해소. M9.5 (a)CLI exit=blockingFailed만 (b)benchmark=auditHtml().failed 전체 union miss+fp 유지. 코드대조: benchmark.mjs:23 actual=auditHtml(html).failed는 severity 무관 union 반환 → 비교 로직 무변경, baseline {expectedBlocking,expectedAdvisory} 정적9검사 분할은 union 복원으로 동등. cli.js:77 process.exit(result.pass?0:1)은 pass 재정의로 코드 불변. 시각 advisory 회귀는 benchmark(.failed·--visual 미실행) 아닌 geometry.test.js 게이트 명시로 개수 정합. 의도초과는 product 산출물에만으로 1차 게이트 혼동 제거.
- 수용 세 클레임 무모순·코드검증 가능. (1)v6 blockingFailed===[] → exit 0: v6 C1/T1/T2/T4 미발화(C1 repeating-linear-gradient+var·인디고 solid hue 230-300 미해당 audit.js:57, T2 본문텍스트만 검사)·DE3 정적4암 통과; advisory TY4 떠도 무블록. (2)slop exit 1: baseline blocking 발화. (3)benchmark union: .failed union 보존 → slopScore도 union failed/total 보존(audit.js:706). 셋이 동일 분할선 하 상호무모순.
- P1-3 해소. 수용기준에 slop exit 1 항목 추가 + 클레임보존 Phase5 수동 diff를 exit-1 픽스처 목록과 분리(CLAUDE.md:66/SKILL.md:115 근거).
- P1-4 해소. Principles 4 결정론 방어=하드텔 blocking+품질바닥선, POV/큐레이션은 LLM 비결정론 + R1에 게이트 정전 위험·완화책 등재.
- P2-5 해소. R6에 L1 advisory 신호손실 리스크 + 대안(b: L1 blocking 유지+다이어그램 면제), 기본권고(a), Option C 디스코프.
- P2-6 해소. slopScore 키 존속(별칭, failed/total 그대로)+blockingScore/advisoryScore 추가, severity 누락=blocking fail-safe, combineAudits existing.severity 캐리 명문, geometry.test.js(merged.slopScore 단언 5개) 슬라이스1 동시갱신 핸드오프.

Architect/2 비차단 2건 독립검증:
- (MEDIUM) e2e 2/4b S3 라벨 — 실제 비차단 확정. pipeline.test.js:45 FAIL S3 perfect-symmetry 정규식이 S3 advisory 강등 + formatAuditReport(audit.js:751-756 현재 비통과 전부 FAIL 라벨) 2섹션 재서술과 충돌 가능. 그러나 (i)2/4b exit 1 단언(line44)은 blocking C1/T1/T2/T4로 유지, (ii)2/4 정적 slop exit 1·FAIL 단언 별도 보존, (iii)green-test 게이트가 red를 강제 노출 → executor가 코드(권장 a: per-finding FAIL 라벨 유지+섹션 헤더로 BLOCK/advise 구분) 또는 단언(b: 45를 advise로 갱신) 중 어느 쪽으로 해소해도 정합. 잘못된-but-green 산출 경로 없음. 핸드오프 한 줄 보강이면 충분(차단 아님).
- (LOW) geometry.test.js pass 단언 — 실제 비차단. line40 L1 합성 finding severity 미부여 → fail-safe blocking → pass=false 유지(현행 green). executor가 L1에 advisory 부여 시에만 pass=true 플립 → 단언 동기화 필요. 핸드오프 한 줄(advisory-only pass=true 의미·pass 단언 동기화)이면 충분.

## Summary
- Clarity: 양호. M9.1 분류표와 M9.2 채널 1:1로 1차 자가모순 제거, 옵션 A(=B 부분집합)/B/C·슬라이스1~3 명확.
- Verifiability: 양호. 검증 1~8 구체. 수용기준에 slop exit 1·v6 blockingFailed===[]·benchmark union·green게이트 포함. 잔여 2건은 green게이트가 강제.
- Completeness: 양호. 클레임보존 분리·inert 보안·이중채점(DE3 단일ID+severity 캐리)·slopScore 존속·geometry.test.js 갱신 모두 명시. 핸드오프에 e2e 2/4b 라벨 한 줄만 보강 권장.
- Big Picture: 양호. 결정론 방어=하드텔+바닥선 명문, POV/큐레이션=LLM 비결정론 인정. D1/D2/D3 충족, Option C 디스코프 합리.
- Principle/Option Consistency: 정합. 불변식 강등범위(표현 억제만)와 분할선 일치, 지문 강등 없음.
- Alternatives Depth: 양호. A/B/C 구분·근거·무효화 조항 처리.
- Risk/Verification Rigor: 양호. R1(게이트 정전)·R2(게이트 혼동)·R3~R8 적절, benchmark .failed·--visual 미실행 정적레인 한정 정확.

## 강제 기준 판정
1. P0-1(분할선): 해소.
2. P0-2(게이트 2분리·benchmark.mjs 정합): 해소(.failed union·스키마 적응만).
3. 수용 세 클레임 무모순·코드검증: 해소.
4. P1/P2(클레임보존 분리·결정론방어·L1·slopScore): 4건 해소.
5. Architect/2 비차단 2건: 실제 비차단 확정. 최종 핸드오프 한 줄 반영(슬라이스1/2: e2e 2/4b S3 라벨 처리 명문 + advisory-only pass=true·geometry pass 단언 동기화)이면 충분. green게이트가 미반영시에도 강제 해소.

## 비차단 권고(핸드오프 보강, OKAY 차단 아님)
- 슬라이스1/2 핸드오프에 e2e 2/4b:45 S3 라벨 처리 한 줄 명문: 권장(a) advisory도 per-finding FAIL 라벨 유지+BLOCK/advise는 섹션 구분, 또는(b) 단언 advise 갱신. 갱신 불필요를 정적 slop(2/4)로 스코프 한정.
- 슬라이스1에 advisory-only 실패 시 pass=true; 합성 finding severity 부여 시 geometry.test.js pass 단언 동기화 한 줄.

## 불변식
승인 전 product/.gjc 미변경·클레임 보존(Phase5 수동 분리)·inert 보안 무변경·품질바닥선 차단 유지·이중채점 금지 전부 보존. 신규 모순 없음. executor 핸드오프 가능.
