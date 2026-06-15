# Critic 평가 — MO 빌드 레이어 + 시각 크래프트 통합 (run 2026-06-14-mo-layer)

## 판정: ITERATE

## Justification
방향(P1 빌드레이어 우선, 옵션 B + 자동강등 게이트)은 실험·코드로 입증되고 불변식을 대체로 준수한다. 그러나 M8.2의 핵심 승격 후보 b1이 계획이 지정한 구현 경로(extractCssRules)로는 구현 불가이며, 그 결과가 계획 자신의 수용 기준(8장 'exp WARN0 유지')과 자기모순을 일으킨다. 코드 대조로 확정: src/audit.js:122 extractCssRules 정규식은 한 겹 중괄호만 매칭하고 @media 헤더를 셀렉터 클래스에서 배제하므로(셀렉터 부분이 중괄호와 @를 제외) @media (prefers-reduced-motion: no-preference) 블록 안의 transition 을 가드 밖 선언과 구분 불가. exp-skillshop-mo.html은 모든 전이를 가드 안에 두므로 평탄 파서 b1은 거짓 WARN → 'exp WARN0' 위반. 또한 checkQualityFloor(audit.js:494)는 4개 arm(a focus-visible/outline, b transition:all, c viewport, d img dims)뿐 — reduced-motion 기계 arm은 부재. 즉 b1은 '교차참조'가 아니라 reduced-motion 최초의 기계 승격이며 5장 매트릭스의 '교차참조만' 표기는 사실 오류. M8.2 문구 'collectWarnings() 또는 checkQualityFloor() 확장 … MACHINE_CHECKS 배열 등록'은 WARN 채널(collectWarnings, baseline 무관, MACHINE_CHECKS 외부 — audit.js:540/634 확인)과 채점 채널을 혼용해 신규 denominator/이중채점 위험을 만든다. 방향이 옳고 자동강등 게이트가 안전판이므로 REJECT는 아니나, 이 결함들을 고치기 전엔 executor 핸드오프 불가 → ITERATE.

## Summary
- Clarity: 대체로 명확. 마일스톤별 파일·심볼 타깃이 구체적. 단 M8.2 b1/MO1의 '구현 경로'가 실제 파서 능력과 불일치(extractCssRules는 @media·@keyframes 미보존, audit.js:120-124) → executor가 따라가면 막힌다.
- Verifiability: 8장 명령 대부분 코드 검증 가능(npm test, npm run benchmark, cli audit 특정 파일). 그러나 'exp WARN0' ↔ 평탄 파서 b1 자기모순이 미해소 → 수용 기준이 통과 불가능한 상태.
- Completeness: scroll-driven opacity:0 reveal의 시각 레인 은폐/오탐 증명이 수용 기준(8장)에 부재. R4는 @supports 폴백만 다루고 측정 은폐는 미커버.
- Big Picture: P1~P4 ↔ 옵션 A(M8.1/M8.3)는 일관·청정. 옵션 B는 게이트 부착으로 단일옵션 강요 아님.
- Principle/Option Consistency: 부분 충족. B 권고 자체는 정당하나 b1을 '중첩 파서 선신설 전제'로 재정의해야 정합.
- Alternatives Depth: 공정. A는 실질 pros, C는 P1/응집도로 합리적 기각, 자동강등-to-A 게이트가 A를 살아있는 선택지로 유지, architect Steelman은 A>B까지 제시. PASS.
- Risk/Verification Rigor: R1~R6 대체로 실행 가능, 10장 명령 구체적(node --test, preview inert 렌더 육안). 단 R2/8장에 scroll-driven 시각 픽스처 누락, R3 매트릭스가 M8.2 MACHINE_CHECKS 문구와 충돌.

## 강제 기준 판단
1. 원칙-옵션 일관성: 옵션 B를 그대로(extractCssRules로 b1) 권고하는 것은 부당. 채택해야 할 해소 = (i) b1을 중첩 파서 신설 전제로 재정의. 즉 M8.2의 최초 산출물을 'extractCssRules 불변(TY4/CO1/DE1/DE3 소비자 무영향) + at-rule/@keyframes 중첩 보존 별도 헬퍼 + 단위테스트 + exp를 clean으로 고정하는 양방향 픽스처'로 두고, 그 헬퍼가 적대 심사를 통과한 뒤에만 b1을 WARN으로 승격. 파서 비용을 '저비용 WARN' 뒤에 숨기지 않고 명시. b3는 decoy :focus-visible 우회(7장 자인)를 닫기 전까지 LLM 잔류. 헬퍼가 적대 심사를 못 견디면 자동강등 게이트로 (ii)/(iii)=옵션 A 강등. → 1차 (i), 폴백 (ii)/(iii).
2. 공정한 대안: 충족. A/B/C 공정 평가, 단일옵션 강요 아님.
3. 리스크 완화 명확성: 미충족. scroll-driven opacity:0 reveal 은폐/오탐 픽스처가 수용 기준에 미명시 — 추가 필요.
4. 수용 기준 검증가능성: 미충족. 'exp WARN0' ↔ b1 자기모순 미해소(기준1 해소로 동시 해결).
5. 구체 검증 단계: 충족. 10장 명령 구체·실행 가능.
6. 이중채점/cap-not-quota: 부분 미충족. 5장 매트릭스의 '교차참조·단일 denominator' 의도는 옳으나 (a) reduced-motion에 현행 기계 arm 부재라 '교차참조만'은 사실 오류, (b) M8.2의 'MACHINE_CHECKS 등록' 문구가 신규 denominator를 낳아 매트릭스를 깬다 → 경로 단일화 추가 수정 필요.

## Planner 다음 패스 필수 액션 (우선순위)
1. [HIGH] M8.2 b1 경로 재정의 (4장·M8.2·7장·8장): 'extractCssRules로 판정' 문구 삭제. M8.2 첫 슬라이스를 'extractCssRules 불변 + @media/@supports/@keyframes 중첩 보존 헬퍼 신설 + 단위테스트 + 양방향 픽스처(가드 clean=exp 포함 / 미가드 WARN)'로 명시. 헬퍼 적대 심사 통과 후에만 b1 WARN 승격. 미통과 시 자동강등(옵션 A) 발화.
2. [HIGH] 수용 기준 자기모순 해소 (8장): '신규 WARN 후에도 exp WARN0 유지'를 1번의 중첩 파서 + exp-clean 픽스처로 보장한다고 명시. 평탄 파서로는 충족 불가임을 기록.
3. [MED] b1 채점 경로 단일화 (M8.2·5장·R3): 'collectWarnings() 또는 … MACHINE_CHECKS 등록' 혼용 제거. WARN→collectWarnings 단독·MACHINE_CHECKS 미등록·baseline.json 무변경. FAIL이 정당화되면 신규 ID가 아니라 checkQualityFloor의 5번째 arm(단일 DE3 denominator)으로 접기. 둘 중 하나로 확정.
4. [MED] 매트릭스 정정 (5장·MO2): reduced-motion은 DE3 산문(design-principles.md:245)에만 있고 checkQualityFloor에 arm 없음(audit.js:494-535, 4 arm) → '교차참조만'을 'reduced-motion 최초 기계 승격, M2 픽스처+baseline 게이트+중첩 파서 요건 충족 필요'로 수정.
5. [MED] MO1 레인·파서 의존 명시 (5장·7장): MO1 장식 애니메이션 기계화는 STATIC 레인(audit.js)이며 b1과 동일 중첩 파서 + @keyframes→animation-name→iteration:infinite 상관 필요. '저비용' 오인 방지 위해 공통 파서 의존 적시.
6. [MED→WATCH] scroll-driven 시각 픽스처 수용 기준화 (8장·R2): opacity:0 + animation-timeline reveal 픽스처를 추가해 시각 레인(geometry, scroll=0·isVisible opacity<0.05)이 오탐/은폐 없음을 증명. 교차장르(exp는 단일페이지·단일장르라 미입증) 1개 이상.
7. [LOW] WARN vs baseline 구분 (M8.2·8장): WARN 검사는 baseline.json 무변경(failed만 비교 — audit.js:633). 'baseline failed 매핑 갱신'은 FAIL 승격분에만 해당하도록 검사별 구분 표기.
8. [LOW] M7 5절 흡수 명문화 (ROADMAP·충돌해소 기록): reference-gallery 플랜 5절(motion-role/budget/fallback + Phase2/5)을 M8이 흡수함을 기록해 후속 M7.1 재추가(병행 컨벤션 표류) 차단.
9. [LOW] audit 장르 배관 부재 명시 (R2): '--page proposal 게이트 오프'는 순신규 배관 — cli.js/audit.js/geometry.js에 --page/장르 입력 무(검색 무매치, doc design-principles.md:254만 존재). WARN 전용 유지 시 불요, 어포던스0 기각 유지가 옳음을 적시.

## 정정 (architect 전제 확인)
- 시각 감사 레인은 inert preview가 아니라 pathToFileURL 원본 HTML 렌더 — architect 정정 채택. MO4 CSS-first라 결론 무관하나 스틸맨의 'inert preview' 전제는 사실 오류.

## 검증 출처 (코드 대조)
- src/audit.js:115-130 extractCssRules 단일레벨 정규식 — @media/@keyframes 미보존 확인.
- src/audit.js:488-535 checkQualityFloor 4 arm — reduced-motion arm 부재 확인.
- src/audit.js:540/606-616/633-634 collectWarnings 는 MACHINE_CHECKS 외부, baseline failed-only 확인.
- core/design-principles.md:245(reduced-motion 산문), :177-184(HI2 LLM, 44px), :254(--page proposal doc-only) 확인.
- src/cli.js/audit.js/geometry.js --page/proposal/genre 검색 무매치 — 장르 배관 부재 확인.
