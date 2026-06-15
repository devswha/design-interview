# Critic 재리뷰 (pass 2) — MO 빌드 레이어 + 시각 크래프트 통합 rev2 (run 2026-06-14-mo-layer)

## 판정: OKAY (승인·실행 가능)

## Justification
1차 ITERATE의 필수 액션 9개(HIGH 2 / MED 4 / LOW 3)를 개정안과 1:1 대조한 결과 전부 해소됐고, 모든 코드 주장을 src/audit.js 직접 대조로 독립 확인했다. 잔여는 Architect 2차가 지목한 비차단 LOW 1건(FAIL 경로 DE3 5번째 arm의 입력 출처 한 줄 명시)뿐이며, WARN 경로가 권고이고 FAIL은 조건부라 실행을 막지 않는다. 최종 계획에 한 줄 반영 권고로 처리.

## 액션 1:1 대조 (stage-01-critic 필수 액션 → rev2)
- A1 [HIGH] b1 경로 재정의: 해소. §3 옵션B '(전제) 중첩 보존 파서 헬퍼 선신설', §4 M8.2 '첫 산출물(필수 선행): 중첩 보존 헬퍼 신설, extractCssRules 불변(TY4/CO1/DE1/DE3 의존)', 양방향 픽스처(exp=clean / 미가드 WARN), 적대 심사 통과 후에만 b1 WARN 승격, 미통과 자동강등(옵션A).
- A2 [HIGH] 수용 기준 자기모순: 해소. §8 'exp WARN0 유지는 중첩 파서 + exp-clean 픽스처로만 보장 — 평탄 파서 b1으로는 가드 안 transition 거짓 WARN → 충족 불가' 명기.
- A3 [MED] 채점 경로 단일화: 해소. §4 M8.2 WARN→collectWarnings 단독·MACHINE_CHECKS 미등록·baseline 무변경 / FAIL→checkQualityFloor 5번째 arm(단일 DE3 denominator). MACHINE_CHECKS 등록 혼용 문구 제거 확인.
- A4 [MED] 매트릭스 정정: 해소. §5 'reduced-motion 현행 기계 arm 부재 → b1은 교차참조가 아니라 최초 기계 승격' 명기.
- A5 [MED] MO1 레인·파서 의존: 해소. §5 MO1 'STATIC 레인, geometry 부적합, b1과 동일 중첩 파서 + @keyframes→animation-name→iteration:infinite 상관 필요(저비용 아님)'.
- A6 [MED→WATCH] scroll-driven 시각 픽스처: 해소. §4·§8 'opacity:0 + animation-timeline reveal 픽스처로 geometry 오탐/은폐 없음 증명(geometry.test.js) + 교차장르 ≥1' 수용기준화.
- A7 [LOW] WARN vs baseline: 해소. §4·§8 WARN은 baseline.json 무변경(failed만 비교 — audit.js:633), FAIL 승격분만 baseline failed 매핑 갱신으로 구분 표기.
- A8 [LOW] M7 5절 흡수: 해소. §4 M8.1 ROADMAP·충돌해소 기록 명문화(후속 M7.1 재추가 표류 차단).
- A9 [LOW] audit 장르 배관 부재: 해소. §7 'cli.js/audit.js/geometry.js 장르 입력 무, 순신규 배관, WARN 전용이면 불요, 어포던스0 기각 유지' 명기.

## 강제 기준 재점검
1. 원칙-옵션 일관성: 충족. b1을 '중첩 파서 선신설 게이트'로 재정의해 옵션 B와 정합. extractCssRules로 b1 판정하던 부당 경로 제거.
2. 수용기준 검증가능성: 충족. 'exp WARN0' ↔ b1 자기모순 실해소 — 중첩파서 + exp-clean 픽스처로 보장, 평탄 파서로 충족 불가임을 §8에 명기.
3. 이중채점/cap-not-quota: 충족. WARN→collectWarnings 단독·MACHINE_CHECKS 미등록·baseline 무변 / FAIL→DE3 5번째 arm 단일화 명확. 매트릭스 reduced-motion '최초 기계 승격' 정정 반영. combineAudits denominator 무추가 규율 유지.
4. 리스크 완화: 충족. scroll-driven opacity:0 reveal 픽스처가 §8 수용 기준에 진입, 교차장르 ≥1 명시.
5. Architect 잔여 LOW: 비차단 판정. checkQualityFloor 시그니처는 (html, rules)이고 rules는 평탄 extractCssRules 산출(코드 대조 확인)이라 FAIL 5번째 arm이 가드 컨텍스트를 가지려면 신규 중첩 헬퍼(html)를 소비해야 한다. 헬퍼 선신설이 모든 승격의 선결로 §4·§7에 함의되어 있고, WARN이 권고·FAIL은 조건부이므로 차단 아님. 최종 계획에 'DE3 5번째 arm은 평탄 rules가 아닌 신규 중첩 헬퍼(html) 소비' 한 줄 추가 권고로 처리.

## Summary
- Clarity: 충족. 마일스톤별 파일·심볼 타깃 구체, M8.2 게이트 2-슬라이스 구조 명확.
- Verifiability: 충족. §8 수용 기준 코드 검증 가능, exp WARN0 자기모순 해소로 통과 가능 상태.
- Completeness: 충족. scroll-driven 시각 픽스처·교차장르 요건이 수용 기준에 진입.
- Big Picture: 충족. P1~P4 ↔ 옵션 A(M8.1/M8.3) 청정, 옵션 B는 자동강등 게이트로 단일옵션 강요 아님.
- Principle/Option Consistency: 충족. b1 중첩 파서 전제 재정의로 옵션 B와 정합.
- Alternatives Depth: 충족. A 실질 pros, C는 P1/응집도로 합리적 기각, 자동강등-to-A로 A 유지.
- Risk/Verification Rigor: 충족. R1~R7 실행 가능, §10 명령 구체(node --test, cli audit 특정 파일, preview 육안). R2/R4 scroll-driven 은폐를 @supports와 분리해 픽스처로 커버.

## 코드 대조 검증 (독립)
- src/audit.js:115-130 extractCssRules: 정규식 ([^{}@]+){([^{}]*)} 단일레벨, 주석이 @media/@supports/@keyframes 헤더 폐기 명시 — rev2 불변 유지 대상 정확.
- src/audit.js:494-535 checkQualityFloor: 4 arm(a focus-visible/outline, b transition:all, c viewport, d img), reduced-motion arm 부재 — 5번째 arm은 신규 승격이 맞음. 시그니처 (html, rules)·rules 평탄 — Architect LOW 근거 확인.
- src/audit.js:540~ collectWarnings: MACHINE_CHECKS 외부 별도 채널, 주석 '절대 fail 승격 안 함, findings/failed/exit/benchmark가 warnings 무시'. failed=findings 기반·slopScore=failed/findings·baseline failed-only(:633) — WARN 단독·baseline 무변경 경로 정확.

## 결론
9개 액션 전부 해소, 5개 강제 기준 전부 충족, 신규 차단 결함 없음. 잔여는 비차단 LOW 1건 → 최종 계획 한 줄 반영 권고. 실행 핸드오프 가능.
