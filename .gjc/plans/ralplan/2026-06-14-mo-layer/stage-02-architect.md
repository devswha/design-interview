# Architect 재리뷰 (pass 2) — MO 빌드 레이어 + 시각 크래프트 통합 rev2 (run 2026-06-14-mo-layer)

## Summary
개정안(stage-02-revision)은 1차 Architect/Critic의 HIGH 1건, MED 4건, WATCH 1건, LOW 3건 + 시각레인 정정을 전부 해소했고, 코드 대조로 모든 주장이 사실로 확인된다. 개정이 새 BLOCK급 결함을 도입하지 않았으며 게이트/자동강등 구조가 건전하다. 1차 WATCH/COMMENT에서 CLEAR/APPROVE로 상향한다 — 잔존은 executor 핸드오프 수준의 LOW 1건뿐.

## Analysis (코드 대조 재확인)
- `extractCssRules` (audit.js:107-130): 단일레벨 정규식 `([^{}@]+){([^{}]*)}` — @media/@supports/@keyframes 헤더 폐기, 코드 주석이 명시. rev2가 이를 불변 유지 대상으로 정확히 고정.
- `checkQualityFloor` (audit.js:494-535): 4 arm(a focus-visible/outline, b transition:all, c viewport, d img). reduced-motion arm 부재 확인 → rev2 매트릭스 정정과 일치.
- `collectWarnings` (audit.js:540-604): MACHINE_CHECKS 외부 별도 채널. `auditHtml`(606-638)는 failed/slopScore/pass를 MACHINE_CHECKS findings로만 산출, warnings는 분리. rev2 WARN→collectWarnings 단독 경로와 일치.
- `combineAudits`: 동일 원칙 ID는 단일 finding 병합(이중채점 회피) — rev2 denominator 무추가 규율과 정합.

## 항목별 해소 판정
- HIGH-1 (b1 extractCssRules 불가 + exp WARN0 자기모순): 해소. §3 옵션B 전제·§4 M8.2 "첫 산출물(필수 선행): 중첩 보존 헬퍼 신설, extractCssRules 불변(TY4/CO1/DE1/DE3 의존)"으로 재정의. §8 "평탄 파서 b1으로는 exp 가드 안 transition 거짓 WARN → 충족 불가" 명기로 자기모순 해소. 헬퍼 적대 심사 통과 후에만 b1 승격 게이트.
- HIGH-2 (exp WARN0 자기모순): 해소. §8이 exp WARN0은 중첩 파서 + exp-clean 픽스처로만 보장됨을 적시.
- MED-3 (채점 경로 단일화): 해소. §4 M8.2 — WARN→collectWarnings 단독·MACHINE_CHECKS 미등록·baseline 무변경 / FAIL→checkQualityFloor 5번째 arm(단일 DE3 denominator). 1차 MACHINE_CHECKS 등록 혼용 문구 제거.
- MED-4 (매트릭스 reduced-motion 최초 승격): 해소. §5 "reduced-motion 현행 기계 arm 부재 ... b1은 교차참조가 아니라 최초 기계 승격" 명기.
- MED-5 (MO1 STATIC·공통 파서 의존): 해소. §5 MO1 "STATIC 레인, geometry 부적합, b1과 동일 중첩 파서 + @keyframes 상관 필요(저비용 아님)" 명기.
- WATCH-6 (scroll-driven 시각 픽스처): 해소. §4 M8.2·§8 — opacity:0 + animation-timeline reveal 픽스처로 geometry 오탐/은폐 없음 증명(geometry.test.js) + 교차장르 ≥1 수용기준화.
- LOW-7 (M7 5절 흡수): 해소. §4 M8.1 ROADMAP·충돌해소 기록 명문화.
- LOW-8 (audit 장르 배관 부재): 해소. §7 "cli.js/audit.js/geometry.js 장르 입력 무, 순신규 배관, WARN 전용이면 불요" 명기.
- LOW-9 (WARN은 baseline 무변경): 해소. §4·§8 WARN/FAIL 검사별 구분 표기.
- 시각레인 원본 HTML 렌더 정정: 해소. §0 정정 — geometry는 pathToFileURL 원본 렌더(inert preview 아님), rev1 전제 오류 명시.

## 신규 결함 점검
- 중첩 파서 신설 ↔ TY4/CO1/DE1/DE3 소비자 충돌: 없음. extractCssRules 불변 + 별도 가산 헬퍼, §7이 회귀 0 증명을 적대 심사 기준으로 요구.
- 게이트 로직 모호: 없음. §7이 헬퍼 합격 기준(소비자 회귀 0 + @keyframes 누출 0 + 가드 안/밖 정확 분류)을 구체 명시.
- A 자동강등 조건 불명확: 없음. §4·§7·§9 R7 — 헬퍼 적대 심사 미통과 시 b1/MO1 동반 자동강등(옵션 A) 일관.

## Root Cause (1차)
extractCssRules 단일레벨 파서가 b1/MO1 공통 병목이라는 1차 진단이 근본 원인이었고, rev2는 이를 "별도 중첩 헬퍼 선신설 게이트"로 정면 수용 — 근본 해결.

## Findings
- [LOW] FAIL 경로(DE3 5번째 arm) 입력 출처 미명시. checkQualityFloor 시그니처는 `(html, rules)`이고 rules는 평탄 extractCssRules 산출이라 reduced-motion 가드 컨텍스트를 갖지 못한다. 5번째 arm은 평탄 rules가 아니라 신규 중첩 헬퍼(html)를 호출해야 한다. 헬퍼 선신설이 모든 승격의 선결이라 함의되어 있으나, executor가 평탄 rules로 가드 판정을 시도하지 않도록 5번째 arm이 중첩 헬퍼를 소비함을 한 줄 적시 권장. 비차단(WARN 경로가 권고이고 FAIL은 조건부).

## Recommendations
1. [LOW] M8.2 FAIL 경로 문구에 "DE3 5번째 arm은 평탄 rules가 아닌 신규 중첩 헬퍼(html)를 소비" 한 줄 추가. 핸드오프 후 executor 단에서 흡수 가능.
2. 미해결 승인자 결정 3건(텔 id 컨벤션 / 헬퍼 합격 시 WARN 확정 vs 옵션 A 보수 잔류 / M7.1 별도 run)은 정당한 승인자 입력 사항으로 적절히 표면화됨 — 추가 조치 불요.

## 불변식 점검
- 승인 전 product 미변경: 헤더 pending approval, 코드/.gjc 미편집 — 준수.
- 새 의존성 금지 / cap-not-quota / Korean docs·English identifiers: 준수.
- 이중채점 금지: 매트릭스 + collectWarnings 단독 + denominator 무추가 — 준수.
- 텔/검사 추가는 fixture+baseline 한 커밋: M2 게이트 유지, WARN은 baseline 무변경(코드상 warnings 무시) — 정확.

## 잔존 리스크
BLOCK급 없음. 유일한 실행 리스크(M8.2 파서 회귀면적·우회 취약 WARN)는 계획이 "헬퍼 선신설 → critic 적대 심사 → 통과 시에만 b1 WARN" 2-슬라이스 게이트 + 자동강등으로 정확히 펜싱. M8.1/M8.3(문서)은 즉시 executor 핸드오프 가능, M8.2는 게이트형 슬라이스로 핸드오프 가능.

## Trade-offs
- 결정론(B/M8.2) vs 파서비용·우회잔존: rev2가 파서비용을 "저비용 WARN" 뒤에 숨기지 않고 명시 + 자동강등 안전판 부착으로 균형. 1차 Steelman(A>B 가능성)을 게이트로 흡수.
- WARN vs FAIL 승격: WARN 권고(납품 비차단·baseline 무변경)가 오탐/우회 리스크 최소. 합당.

## Architectural Status
CLEAR

## Code Review Recommendation
APPROVE
