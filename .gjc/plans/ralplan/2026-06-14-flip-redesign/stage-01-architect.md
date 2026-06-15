# RALPLAN-DR — flip-redesign Architect 심사 (stage architect/1)

run-id: 2026-06-14-flip-redesign · read-only · product/.gjc 미변경

## Summary
뒤집기의 방향(audit의 cap/억제 공리가 표현을 무난함으로 수렴 → 차단 표면을 품질 바닥선으로 좁힘)은 코드 증거로 타당하고 Option B의 3중 장치 구상도 건전하다. 그러나 제안된 blocking/advisory 분할선이 잘못 그어졌다: (1) 기계 탐지 가능한 '하드 텔'(C1 보라 그라데, T1 이모지)을 advisory로 내려 **결정론적 슬롭 게이트가 정전된다** — 슬롭 소스가 audit 통과(exit 0)하게 됨을 e2e가 그대로 증명, (2) 벤치마크 게이트를 blocking-only로 좁혀 **탐지기 회귀망(detector-accuracy)을 납품 게이트와 혼동**해 12개 검사의 fp/miss 회귀 보호를 잃는다. 방향은 유지하되 분할선을 '결정론적 지문+품질바닥선 = 차단 / 억제 휴리스틱 = 권고'로, 그리고 두 게이트(납품=CLI exit, 탐지기=benchmark)를 분리해야 한다. → WATCH / REQUEST CHANGES.

## Analysis
코드 대조로 확인한 사실:
- **audit 구조**(src/audit.js): MACHINE_CHECKS는 9개 정적 검사 {id,name,run}(C1,T1,T2,T4,S5,TY4,CO1,DE1,DE3), severity 필드 없음. auditHtml→{findings,failed,slopScore=failed/total,pass=failed.length===0,warnings}. combineAudits는 시각 findings(L1,L2,S3,TY1,TY2,DE3-contrast,TY5)를 병합, **DE3 정적+시각 암을 같은 ID로 1개 finding 병합**(이중채점 방지, geometry.test.js:43-58이 고정). pass는 양쪽 다 failed.length===0. cli.js:77 process.exit(result.pass?0:1).
- **품질 바닥선 = DE3 4암**(checkQualityFloor: focus-visible kill 무대체 / transition:all / user-scalable·maximum-scale / img width·height 누락) + 시각 DE3 렌더 대비 + 시각 TY5-A 한글 어절 줄바꿈. 전부 현재 blocking.
- **reduced-motion**: design-principles.md:282가 '현행 기계 arm 없음(DE3 산문만)' 명시. checkReducedMotionGuard는 **WARN 전용**(audit.js:181 'findings/failed/slopScore/baseline 무영향'). 즉 reduced-motion은 지금도 exit 게이트가 아니다.
- **클레임 보존**: CLAUDE.md:66 + SKILL.md:40 + Phase5 step4(SKILL.md:115)에서 **Phase5 수동 diff**로 규정 — 기계 검사/ audit exit 대상이 아니다.
- **benchmark.mjs:23**: auditHtml(html).failed만 비교(정적 레인 전용, --visual 미실행). miss(탐지 후퇴)+fp(오탐 후퇴) 둘 다 exit 1. baseline.json은 {fixtures:{path:{failed:[]}}}.
- **e2e**(tests/e2e/pipeline.test.js:35-46): 슬롭 소스가 C1/T1/T2/T4로 **exit 1 '납품 불가'** 임을 단언. 시각 레인 합류 시 S3/L1도 단언.

## Root Cause
뒤집기는 audit의 *cap/억제* 공리가 표현을 과도 제약함을 정확히 짚었지만, 분할선을 '품질바닥선 vs 그 외 전부'로 그었다. 그 '그 외 전부'에 **결정론적 슬롭 지문(C1 보라 그라데·T1 이모지)**과 **표현 억제 휴리스틱(TY4 패밀리 cap·CO1 단일강조·DE1 그림자)**이 뒤섞여 있다. 불변식이 강등을 허락한 것은 후자('표현 억제 규칙')뿐인데 전자까지 함께 내려갔다. 동시에 **납품 게이트(CLI exit)**와 **탐지기 회귀 게이트(benchmark)**라는 목적이 다른 두 게이트를 같은 advisory/blocking 분할에 얹어 붕괴시켰다. 선을 다시 긋고 두 게이트를 분리하면 뒤집기 의도를 유지하면서 결정론적 망을 보존한다.

## Findings

### [HIGH] 기계 탐지 하드 텔(C1·T1)의 advisory 강등 — 결정론적 슬롭 게이트 정전
M9.2는 C1·T1을 advisory 채널로 넣는다. 그러나 design-tells.md:23은 'T1 emoji-bullets … 즉시 실격', C1(보라 그라데)은 전형적 클로드-룩 지문이다. M9.1 자신도 C1/T1을 '하드 텔(유지)'로 분류해 **M9.1 doctrine ↔ M9.2 channel 자가모순**. 강등 후 audit으로 차단되는 것은 DE3+TY5(대비·a11y·한글)뿐 — 보라 그라데+이모지 불릿 페이지는 exit 0. 3중 장치 중 POV·큐레이션은 LLM 판단이라 비결정론, 품질바닥선은 지문을 커버하지 않으므로 **지문에 대한 결정론적 차단이 0이 된다**. 결정적 증거: tests/e2e/pipeline.test.js:35-46이 슬롭 소스의 C1/T1/T2/T4 exit 1을 단언 — 이 분할이면 슬롭 소스가 audit 통과(exit 0)하고 e2e가 깨진다('slop must not pass'가 거짓이 됨). 불변식의 강등 허용 범위('표현 억제 규칙: 패밀리 cap·단일강조·webfont금지·절제강요')는 C1/T1을 포함하지 않는다 — 범위 초과 강등.
- 파일: stage-01-planner.md M9.2 advisory 목록; 대조 src/audit.js MACHINE_CHECKS, tests/e2e/pipeline.test.js:35-46, core/design-tells.md:23.
- 영향: 슬롭 재발 방지의 유일한 결정론적 장치 상실. 사용자의 핵심 비판은 'cap=절제 강요'였지 '지문 탐지 폐기'가 아니다.
- 수정: 기계 탐지 가능한 하드 텔(C1·T1, 가능하면 T2·T4도)을 **blocking 유지**. advisory로는 *억제 휴리스틱*(TY4·CO1·DE1·S5·시각 L1/L2/S3·TY1/TY2)만 내린다. e2e/baseline 갱신 불필요(게이트 보존).

### [HIGH] 납품 게이트와 탐지기 회귀 게이트의 혼동 — benchmark blocking-only로 회귀망 12개 손실
M9.5는 benchmark를 'blocking 회귀만 exit 1, advisory는 리포트만(스타일 텔은 의도 초과 가능)'으로 바꾼다. 그러나 '의도 초과 가능'은 **product 산출물**에 적용되는 자유지, **탐지기 픽스처**(slop-source·principle-violations·clean/restaurant·redteam)에 적용되는 게 아니다. benchmark는 *탐지기 정확도* 테스트다(benchmark.mjs 주석 'miss=탐지 후퇴, fp=오탐 후퇴'). advisory를 게이트에서 빼면: principle-violations.html의 advisory 7검사(C1/T2/T4/S5/TY4/CO1/DE1) 탐지 후퇴(miss)와 clean/restaurant·svg-attr-color-smuggle의 advisory 오탐(fp)이 **회귀로 안 잡힌다**. 시각 advisory 5종까지 합치면 12개 검사가 회귀망을 잃는다. 'blocking만 게이트가 안전한가'(critic 질문)의 답: 안전하지 않다 — 탐지력·오탐 회귀가 조용히 통과한다.
- 파일: stage-01-planner.md M9.5; 대조 tests/quality/benchmark.mjs:23-30, baseline.json.
- 영향: R1(슬롭 재발) 완화책으로 든 'advisory는 리포트에 남아 자각 강제'가 회귀 시 조용히 부정확해짐 — 망 자체가 약화.
- 수정: 두 게이트 분리. **CLI exit = blockingFailed만 차단(납품 게이트, 의도 초과 허용).** **benchmark = blocking+advisory 모두 miss+fp 게이트(탐지기 정확도 게이트).** baseline {expectedBlocking,expectedAdvisory} 분할은 유지하되 둘 다 회귀 비교.

### [MEDIUM] 수용 기준이 클레임 보존을 기계 차단 암과 혼동
'audit 가드레일 설계' 상세 절은 클레임 보존이 'Phase5 LLM 대조 — 코드 차단 아님. 유지'라고 **정확히** 구분한다. 그러나 수용 기준 'klleㅇ임 보존·대비·reduced-motion·focus-visible·img치수가 여전히 차단/검출됨 — 의도적 위반 픽스처로 exit 1 재현'은 클레임 보존을 exit-1 픽스처 항목에 묶는다. 클레임 보존은 기계 arm이 없어(CLAUDE.md:66, SKILL.md:115) exit-1 픽스처로 재현 불가.
- 파일: stage-01-planner.md 수용 기준 항목.
- 수정: 클레임 보존 검증을 'Phase5 수동 diff(보존 확인)'로, exit-1 픽스처 목록(DE3 4암·렌더대비·TY5-A)과 분리 명기.

### [MEDIUM] L1 전면 advisory 강등 — 실제 그리드 슬롭 신호 폐기
L1(geometry.js uniform-card-grid: 동일크기·동일행·등간격 3+ 카드)은 다이어그램에서 오탐(v6 반례)하지만 진짜 '동일 피처카드 6개' AI 랜딩에서는 유효 신호다. 전면 advisory는 노이즈를 죽이려 신호까지 버린다 — 정본 카드그리드 슬롭이 exit 0. 신호 보존 정제(구조 SVG/다이어그램 제외)는 Option C로 디스코프됨.
- 파일: stage-01-planner.md M9.2/M9.5, Option C 디스코프; 대조 src/geometry.js L1.
- 수정: 강등이 스코핑 결정임을 명시하고 'L1 실제-슬롭 탐지는 C 착수까지 희생'을 R-리스크로 등재; 또는 L1을 blocking 유지 + 최소 다이어그램 면제만 당겨오기.

### [LOW] slopScore 리네임 blast radius — geometry.test.js 미언급
audit.test.js:31(r.slopScore===0)·geometry.test.js:39/47/55/64/74(merged.slopScore)가 slopScore 키를 단언. 슬라이스 1 핸드오프는 audit.test.js만 명시, geometry.test.js의 combineAudits 단위(puppeteer 불요) 누락. slopScore를 '유지하되 리네임'이 키 제거를 뜻하면 5개 단언 붕괴.
- 수정: slopScore 키 보존(별칭) 또는 두 테스트 동시 갱신 명기; '유지'의 의미를 키 존속으로 확정.

### [LOW] 시각 findings·legacy-array 경로의 severity 미정의
시각 findings는 analyzeVisualTells 반환부에서 인라인 생성(MACHINE_CHECKS 경유 아님)이고 combineAudits는 legacy 배열(geometry.test.js:81)도 받는다. 계획은 geometry.js를 타깃으로만 들 뿐 severity 부여 방식·severity 누락 finding의 기본값을 정하지 않음. 병합부({...existing,pass,evidence})는 existing.severity만 보존 — DE3는 양쪽 blocking이라 안전하나 일반 규칙 부재.
- 수정: analyzeVisualTells 반환에 severity 부여; 분할 시 severity 누락 finding은 **blocking 기본(fail-safe)**.

### [INFO] 불변식 텍스트가 reduced-motion 현행 시행을 과대 진술
CONTEXT/수용 기준의 '품질바닥선(reduced-motion) 차단 유지'는 존재한 적 없는 게이트를 가정(design-principles.md:282 'reduced-motion 기계 arm 없음'). 계획은 WARN을 정확히 보존하고 승격을 백로그화 — **강등 없음**(no regression). 코드 조치 불요; reduced-motion을 현행 blocking으로 칭하지만 않으면 됨.

## Recommendations (우선순위)
1. (HIGH) 분할선 재설정: blocking = 품질바닥선(DE3 4암·렌더대비·TY5-A) **+ 기계 탐지 하드 텔(C1·T1, 권고로 T2·T4)**. advisory = 억제 휴리스틱(TY4·CO1·DE1·S5·시각 L1/L2/S3·TY1/TY2). e2e/baseline 게이트 보존.
2. (HIGH) 게이트 분리: CLI exit는 blockingFailed만(납품, 의도 초과 허용); benchmark는 blocking+advisory 모두 miss+fp 게이트(탐지기 정확도). baseline 양 채널 회귀 비교.
3. (MEDIUM) 수용 기준에서 클레임 보존을 Phase5 수동 검증으로 분리, exit-1 픽스처 목록과 비혼동.
4. (MEDIUM) L1 강등의 신호 손실을 리스크로 명시 또는 다이어그램 면제만 당겨 L1 blocking 유지.
5. (LOW) slopScore 키 존속 확정 + geometry.test.js 갱신 핸드오프 추가; 시각 findings severity 부여 + 누락 시 blocking 기본.

## Architectural Status
WATCH

## Code Review Recommendation
REQUEST CHANGES

## Trade-offs

| 축 | plan 현안(B as-is) | 권고(B′: 선 재설정+게이트 분리) |
|---|---|---|
| 표현 자유 | 최대(지문도 advisory) | 높음(억제 휴리스틱만 advisory, 지문은 차단) |
| 결정론적 슬롭 게이트 | DE3+TY5만 — 지문 무방비 | 품질바닥선+지문(C1/T1) 유지 |
| 회귀망(탐지기 정확도) | blocking 2종만, 12검사 무방비 | 전 검사 fp+miss 게이트 |
| e2e/baseline 영향 | 깨짐('slop must not pass' 거짓) | 보존(게이트 유지) |
| 비용 | 작음 | 작음(분할선·benchmark 비교만 조정) |
| 위험 | 슬롭 재발 + 침묵 회귀 | 낮음 |

| 차단/권고 경계 판단 | 강등 정당성 |
|---|---|
| C1 보라 그라데·T1 이모지 | **불가(지문, 불변식 범위 밖)** — 차단 유지 |
| TY4 패밀리 cap·CO1 단일강조·DE1 그림자·S5 | 정당(억제 규칙, 불변식 허용) — advisory |
| L1 균일 그리드 | 부분적(실그리드 유효/다이어그램 오탐) — 정제 동반 권장 |
| reduced-motion | 현행 WARN 유지(승격 백로그) |

## 원칙 위반 플래그
- 슬롭 재발 위험: **YES(HIGH)** — 결정론적 지문 게이트 정전(C1/T1 advisory), 슬롭 소스 exit 0.
- 회귀 게이트 약화: **YES(HIGH)** — benchmark advisory 비게이트화로 탐지력·오탐 회귀 침묵.
- 클레임 보존: 위반 아님(계획 상세는 Phase5 수동 유지). 단 수용 기준 표현 혼동(MEDIUM).
- inert preview 보안: 위반 없음(범위 밖, 변경 없음).
- 이중채점: 위반 없음(DE3 단일 ID 병합 보존 명시) — 단 severity 병합 캐리 규칙은 명문화 권장(LOW).
