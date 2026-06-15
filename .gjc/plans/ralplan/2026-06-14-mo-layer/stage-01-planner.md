# RALPLAN-DR: MO(모션·인터랙션) 빌드 레이어 + 시각 크래프트 규율 통합

run-id: 2026-06-14-mo-layer / stage: planner / 상태: pending approval (승인 전, product 소스·audit·SKILL 미변경)

## 0. 배경 요약

실험으로 병목이 확정됐다. 동일 콘텐츠를 레퍼런스 파이프 없이 MO/시각 빌드 규율만 얹어 재빌드한 exp-skillshop-mo.html 은 audit slop 0% (0/15 fail, exit 0, WARN 0) + 진짜 인터랙션(hover7/focus-visible4/active1/@keyframes3/scroll-driven3/details1/sticky nav/smooth-scroll, 전부 prefers-reduced-motion 게이트). baseline v0-after-with-skill.html 은 7%(TY2 1 fail)·WARN2·인터랙션 0. 결론: 병목은 레퍼런스 추출 CLI(M7)가 아니라 빌드 레이어다. 따라서 M7을 후순위로 디스코프하고 MO/시각 레이어를 M8로 신설한다. 핵심 엔지니어링 통찰: CSS-first 모션(transition/@keyframes/animation-timeline scroll()·view()/:target/details)은 preview.js 의 script-src none inert 프리뷰에서도 그대로 렌더된다 → 보안/감사 모델과 충돌 없이 인터랙티브 가능.

## 1. Principles (이 통합을 지배하는 4원칙)

- P1 빌드레이어 우선, 레퍼런스 후순위. 사용자 불만(비인터랙티브·시각 아쉬움)의 원인은 생성 규율 부재이지 레퍼런스 데이터 부재가 아니다. 따라서 코드/문서 투자 1순위는 MO/시각 빌드 규율, M7 reference intelligence 는 후순위로 재배치한다.
- P2 cap-not-quota 불변. 모든 MO/시각 원칙은 상한이지 처방이 아니다. 모션 quota(반드시 N개), 고정 transition 디폴트, 매 페이지 동일 시그니처 모션은 그 자체로 새 텔이다. MO도 동일 테제 아래 둔다.
- P3 CSS-first·inert-safe·progressive-enhancement. 모든 인터랙션은 무JS(transition/animation/animation-timeline/:target/details/:focus-visible/sticky)로 구현해 inert preview(script-src none)와 audit 모델과 충돌하지 않게 한다. 미지원 브라우저는 @supports/정적 폴백으로 무해 degrade.
- P4 이중 채점 금지(불변식 보존). 기계 레인(정적/시각)이 커버하는 항목은 LLM 체크리스트에서 제거한다. 신규 기계검사 승격은 fixture + tests/quality/baseline.json 갱신을 한 커밋으로(M2 게이트). reduced-motion 가드는 이미 DE3 소유, 히트영역 44px 는 HI2 소유 → MO 신설 시 재기술이 아니라 교차참조만.

## 2. Decision Drivers (top 3)

- D1 인터랙티비티를 보안/감사 모델을 약화하지 않고 도입할 수 있는가. → CSS-first 가 inert preview·script-src none 에서 렌더된다는 실증이 이 드라이버를 해소한다. JS 도입은 즉시 기각(런타임 의존성 금지·inert 위반).
- D2 모션 추가가 anti-slop 테제를 훼손하지 않는가(균일·장식 모션 = 새 텔). → MO1 텔 목록(aurora/sparkle/shader/gradient-animation/패럴랙스/타자기루프/자동캐러셀)과 cap 규율로 방어. 장식 모션은 금지, 목적 모션만 허용.
- D3 어디까지 기계 레인으로 승격할 것인가(문서/프롬프트 vs 정적/시각 기계검사). → 적대 심사 통과분만 승격하고 우회·오탐에 약한 항목은 LLM 잔류. L3/TY3/DE2 기각 선례가 기준선.

## 3. Viable Options

### 옵션 A — 문서·프롬프트 통합만 (코드 무변경, LLM/빌드 레인)
core/design-principles.md 에 MO 원칙군(MO1~MO4) 신설 + 시각 임팩트 규율 추가, SKILL.md Phase2(토큰 커밋에 motion-role/시각 임팩트)·Phase3(빌드 규율)·Phase5(LLM 체크리스트) 통합. src/* 무변경.
- Pros: 가장 낮은 리스크. 코드/baseline/테스트 무영향. 즉시 빌드 품질 상승(실험이 이 레인만으로 0% 달성 입증). cap-not-quota·inert-safe 불변식 자연 준수.
- Cons: 인터랙션 유무·장식 모션은 전부 LLM 판단에 의존(결정론 부재). audit 가 모션을 보지 못해 회귀 방지 약함.

### 옵션 B — A + 정적/시각 기계검사 1~2종 승격 (fixture+baseline 동반)
A 전부 + 적대 심사를 통과하는 검사만 승격. 후보: (b1) reduced-motion 미가드 모션 정적검사(transition/animation 선언이 prefers-reduced-motion no-preference 블록 밖에 존재 → WARN 또는 fail), (b2) transition:all 금지(이미 DE3 정적 암에 존재 — 확인만), (b3) hover-only 어포던스 정적 검사(:hover 규칙 존재하나 대응 :focus-visible 부재).
- Pros: 모션 규율 일부를 결정론으로 고정 → 회귀 방지. 실험이 정적 검사 친화적 산출물을 입증(WARN0). M2 게이트로 품질 추적.
- Cons: 승격마다 fixture+baseline+테스트 비용. 오탐 리스크(정당한 무모션 페이지를 fail 처리 위험 → fail 아닌 WARN 권장). 적대 심사에서 b1/b3 가 우회 가능하면(빈 reduced-motion 블록·decoy focus 규칙) 기각될 수 있음.

### 옵션 C — B + M7.1 레퍼런스 큐레이션까지 동시 진행
B 전부 + reference-gallery 플랜의 M7.1(문서·프롬프트, 코드무변경) 병행, M7.2/3(reference-intake CLI)은 디스코프.
- Pros: 레퍼런스 무드보드 선명화를 저비용(문서만)으로 흡수.
- Cons: 실험이 레퍼런스가 병목이 아님을 입증 → 지금 끼우면 스코프 분산. P1 위반(빌드레이어 우선). M7.1 은 독립 가치라 별도 run 으로 미루는 게 응집도 높음.

## 4. 권고 옵션 + 시퀀싱

권고: 옵션 B. 근거 — A 의 문서/프롬프트 통합이 실험으로 입증된 즉효 핵심이고(P1), 여기에 적대 심사를 통과하는 최소 기계검사만 얹어 모션 규율을 결정론으로 고정(D3·P4)한다. C 의 레퍼런스는 P1·응집도 위반으로 이번 run 디스코프(M7.1 은 별도 run 으로 보존, M7.2/3 백로그 유지). A 단독은 회귀 방지가 약해 기각하되, B 의 어떤 기계검사도 적대 심사를 통과 못하면 자동으로 A 로 강등(아래 7장 게이트).

### 마일스톤 시퀀싱 (각 단계 정확한 파일·심볼 타깃)

- M8.1 문서·프롬프트 통합 (코드 무변경, A 범위)
  - core/design-principles.md: 새 절 "## 모션·인터랙션 (MO)" 추가(MO1~MO4, 5장 스케치대로), 새 절 "## 시각 임팩트" 추가(6장), "## 충돌 해소 기록" 에 모션 문법 결정(현재 1번 항목: 호버 효과 톤 스코프 기각·reduced-motion 가드만 채택)을 MO 군으로 승격·확장 기록, "## 알려진 공백(백로그)" 에 MO 기계 승격 후보 추가.
  - core/design-tells.md: "## 색·질감" 또는 신규 "## 모션" 절에 장식 모션 텔 등재(MO1 의 음성쌍: 장식 배경 애니메이션·패럴랙스·자동캐러셀·타자기루프). id 네이밍은 기존 체계와 일관(예: C6 animated-decoration 또는 신규 M1~). 레인 표기·대체 포함.
  - SKILL.md: Phase2 토큰 커밋 목록에 motion-role(none/orientation/feedback/progress/reveal/delight 중 빌드 전 잠금, cap=micro-only|one-signature)·시각 임팩트 헤드룸 추가; Phase3 빌드 규율에 MO1~MO4·CSS-first·inert-safe 명시(transition/@keyframes/animation-timeline scroll()·view()/:target/details/sticky/:focus-visible 어휘); Phase4 shot 자기검수에 첫 viewport 위계·모션 정적성 점검 추가; Phase5 LLM 체크리스트에 MO 군 LLM 암 추가(기계 승격분 제외).
  - templates/concept-sheet.md: 토큰 커밋 블록에 motion-role·시각 임팩트(타입스케일 드라마·대비 헤드룸) 칸 추가.
  - ROADMAP.md: M8 "MO/시각 빌드 레이어" 신설, M7 reference intelligence 를 M8 이후로 재배치(M7.1 유지·M7.2/3 디스코프 표기), 운영 원칙(이중 채점 금지·픽스처+baseline 동반) 재확인.
- M8.2 기계검사 승격 (B 범위, 적대 심사 통과분만)
  - src/audit.js: collectWarnings() 또는 checkQualityFloor() 확장으로 reduced-motion 미가드 모션 정적검사(b1) — extractCssRules 로 transition/animation 선언이 @media (prefers-reduced-motion: no-preference) 밖에 있는지. WARN 우선(납품 비차단), 적대 심사가 fail 승격을 정당화할 때만 finding. MACHINE_CHECKS 배열 등록.
  - hover-only 어포던스 검사(b3): :hover 규칙 대비 :focus-visible 부재 — audit.js 정적 암. 우회 취약하면 LLM 잔류.
  - tests/fixtures/{slop,clean}/ + tests/redteam/: 각 승격마다 양방향 분리 증명 픽스처 추가(미가드 모션 fixture, reduced-motion 가드 clean fixture, hover-only fixture, hover+focus clean fixture).
  - tests/quality/baseline.json: 신규 검사 failed 매핑 갱신(미가드 모션 fixture, principle-violations.html 갱신 가능), exp-skillshop-mo.html 은 여전히 clean.
  - tests/unit/audit.test.js: 오탐 방지·양방향 분리 단위 테스트.
- M8.3 시각 임팩트 규율 (대부분 LLM·빌드 레인, 기계 승격은 보류)
  - core/design-principles.md 시각 임팩트 절 확정(6장). 첫 viewport 위계·대비 헤드룸·타입스케일 드라마는 LLM/빌드 레인 잔류(기존 TY1 7색 하드캡·HI2 one-winner 와 충돌 회피 명문화). 기계 승격(첫 viewport CTA 카운트=HI2 백로그)은 LA3 듀얼렌더와 합류해 후속 후보로만 기록.
- M7.1 (별도 run 권장, 본 run 디스코프) reference 문서 큐레이션 유지. M7.2/M7.3(reference-intake CLI/visual) 디스코프 — 실험상 비병목.

## 5. MO 원칙군 스케치 (레인 배정 + 이중채점 회피)

- MO1 purposeful-motion-only [LLM + 빌드] — 모션은 방향·피드백·진행·상태변화 목적에만. 장식 모션은 텔: 배경 aurora/sparkle/shader/gradient-animation, 패럴랙스, 타자기 루프, 자동 캐러셀/마퀴. cap: 시그니처 모션 최대 1개(고정 quota 아님). design-tells 음성쌍과 단일 계기 공유(이중 채점 금지). 부분 기계 승격 후보(장식 배경 애니메이션 = @keyframes 가 background/filter/gradient 속성을 무한 반복) → M8.2 적대 심사 대상.
- MO2 motion-physics [부분 기계·정적 + LLM] — transform·opacity 위주(layout 트리거 금지), duration 120~400ms, ease-out 계열, 60fps 목표. reduced-motion 가드는 DE3 소유 → 재기술 금지, 교차참조만. transition:all 금지도 DE3 정적 암 소유. MO2 의 LLM 암 = duration/easing 취향 판단. 기계 암 후보 = transition:all(이미 DE3), 미가드(M8.2 b1, DE3 와 단일 계기로 묶어 이중 채점 회피).
- MO3 affordance [부분 기계·정적 + LLM] — 인터랙티브 요소는 hover + focus-visible + active 상태 동반, 포인터 커서, 히트영역 44px(HI2 소유 → 교차참조만), hover-only 금지. 기계 암 후보 = hover-only 검사(M8.2 b3, :hover 규칙에 대응 :focus-visible 부재). focus-visible 가시성은 DE3 가 이미 소유(outline:none 대체 없는 금지) → 재기술 금지. LLM 암 = active 피드백 적절성.
- MO4 css-first-inert-safe [빌드 + LLM] — 모든 인터랙션 무JS(transition/animation/animation-timeline scroll()·view()/:target/details/:focus-visible/position:sticky/scroll-behavior:smooth). @supports 로 scroll-driven 미지원 폴백, 정적 degrade 무해. inert preview·script-src none 호환 필수. 기계 승격 없음(LLM/빌드 잔류) — JS 인터랙션 탐지는 preview stripActiveContent 가 이미 제거하므로 산출물 자체엔 무의미.

이중채점 매트릭스: reduced-motion → DE3 단독. 히트영역 44px → HI2 단독. focus-visible outline → DE3 단독. transition:all → DE3 단독. MO 신설 검사는 위와 단일 계기(교차참조)로만 묶고 별도 denominator 추가 금지.

## 6. 시각 임팩트 규율

- 첫 viewport 위계: 첫 화면에 지배 요소 정확히 1개(HI2 one-winner 와 동일 계기, 재채점 금지). 근거 Lindgaard 2006(50ms 첫인상) → 첫 viewport 를 별도 QA 대상으로(reference-gallery 플랜 인용분).
- 대비 헤드룸: 위계 표현에 대비 여유 확보. DE3 대비 4.5:1 바닥선과 충돌 없음(DE3 는 가독성 바닥, 시각 임팩트는 그 위 헤드룸 활용 — 상한 아닌 권장).
- 타입스케일 드라마: 디스플레이↔본문 비율 극적 대비 허용. 단 TY1 7색 하드캡(가시 크기 ≤6, 하드캡7)과 충돌 회피 — 드라마는 새 크기 추가가 아니라 기존 스케일의 양 끝(웨이트·잉크 농도 포함, HI1 weight-before-size)으로 낸다. cap-not-quota: 고정 비율 메뉴 금지.
- 근거(reference-gallery 플랜 인용, paper-reported): Kurosu&Kashimura 1995 / Tractinsky 2000(미적-사용성) / Lavie&Tractinsky 2004(classical vs expressive 미학 → mood 축) / Lindgaard 2006(50ms) / Cyr 2010(컬러 어필, 문화 의존 → 범용 정답 금지). 전부 방향 근거로만, 전환율 직접 주장 금지.

## 7. 감사 레인 승격 후보 적대 심사

- b1 reduced-motion 미가드 모션 정적검사: 우회 — 빈 @media (prefers-reduced-motion: no-preference){} 블록을 두고 모션을 밖에 선언, 또는 reduced-motion reduce 블록만 두기. 오탐 — 무모션 페이지·서드파티 키프레임. 판정: fail 승격은 우회·오탐 둘 다 취약 → WARN 레인 권장(납품 비차단, warnings 배열). 빈 가드 블록 탐지(블록 내 선언 수 0이면 무효)를 추가하면 결정론 강화 가능하나 그래도 우회 잔존 → WARN 잔류가 안전.
- b3 hover-only 어포던스 검사: 우회 — decoy :focus-visible{} 빈 규칙으로 면피. 오탐 — :hover 가 순수 장식(비인터랙티브 요소). 판정: 빈 규칙 무효화하면 일부 견고하나 의미 판단(인터랙티브성)이 남아 우회 가능 → 정적은 WARN, 강한 판정은 LLM 잔류 권장.
- 어포던스 0 검사(인터랙션 전무): 우회 — 의미 없는 transition 한 줄로 면피. 오탐 — 정적 문서(proposal 장르)는 정당하게 인터랙션 0. 판정: 기각, LLM 잔류(L3/TY3/DE2 기각 선례와 동일 — 우회 취약·장르 의존).
- 결론: M8.2 는 b1(WARN), b3(WARN 또는 LLM) 만 승격 후보로 진입. 어느 것도 적대 심사를 견디지 못하면 옵션 A 로 강등하고 전부 LLM 잔류. 어떤 항목도 DE3/HI2 와 이중 채점하지 않는다.

## 8. 수용 기준 (코드 검증 가능)

- npm test green (unit + e2e). 신규 검사 추가 시 tests/unit/audit.test.js 양방향 분리·오탐 방지 테스트 포함 green.
- npm run benchmark: baseline 일치, 또는 의도된 baseline 변경(M8.2 신규 검사 매핑)이 같은 커밋에 동반되어 miss/fp 회귀 0.
- node src/cli.js audit exp-skillshop-mo.html --visual → 여전히 slop 0%(0 fail, exit 0). M8.2 신규 WARN 검사 추가 후에도 exp-skillshop-mo.html 은 WARN0 유지(전 모션 reduced-motion 게이트).
- node src/cli.js audit v0-after-with-skill.html --visual → 기존 판정(TY2 fail) 보존, 신규 검사가 baseline 외 새 fail 을 유발하지 않음.
- slop fixtures 여전히 fail / clean fixtures 여전히 pass(회귀 0). 신규 미가드-모션 fixture = fail(또는 WARN), reduced-motion-가드 clean fixture = clean.
- 문서 검증: core/design-principles.md 에 MO1~MO4·시각 임팩트 절 존재, SKILL.md Phase2/3/5 에 MO 통합, 이중채점 금지 문구(MO 검사가 DE3/HI2 재채점 안 함) 명시.

## 9. 리스크 + 완화

- R1 모션 추가가 anti-slop 테제 훼손(새 텔 도입). → MO1 장식 모션 텔 목록 + cap-not-quota(시그니처 모션 ≤1, quota 금지) + design-tells 음성 등재. shot 자기검수로 장식 모션 적발.
- R2 기계검사 오탐 회귀(정당한 무모션/정적 문서 fail). → fail 아닌 WARN 레인 우선, 적대 심사 통과분만 승격, 양방향 분리 픽스처 + baseline fp 가드, proposal 장르는 모션 검사 게이트 오프 고려.
- R3 이중 채점(reduced-motion·44px·focus 재채점). → 단일 계기 매트릭스(5장 말미) 강제, MO 검사는 교차참조만, MACHINE_CHECKS denominator 에 중복 ID 금지.
- R4 scroll-driven(animation-timeline) 미지원 브라우저. → MO4 @supports (animation-timeline: scroll()) 게이트 + 정적 폴백(progress bar 등 무해 degrade), reduced-motion 게이트와 중첩. 실험 산출물이 이 패턴을 이미 검증.
- R5 스코프 분산(레퍼런스 동시 진행 유혹). → M7 디스코프, 본 run 은 MO/시각만. P1 고정.
- R6 inert preview 회귀(JS 유입). → MO4 CSS-first 강제, preview stripActiveContent·CSP script-src none 불변 보존, 신규 런타임 의존성 금지.

## 10. 검증 단계 (단계별 명령)

- M8.1 후: 문서 diff 리뷰(MO 절·시각 임팩트·SKILL Phase2/3/5·concept-sheet·ROADMAP). 코드 무변경이므로 npm test / npm run benchmark 영향 0 확인.
- M8.2 후(각 신규 검사):
  - node --test tests/unit/audit.test.js (신규 검사 단위 + 오탐 방지)
  - npm test (unit+e2e green)
  - npm run benchmark (miss/fp 회귀 0, baseline 동반 갱신 검증)
  - node src/cli.js audit exp-skillshop-mo.html --visual (0%·WARN0 유지)
  - node src/cli.js audit v0-after-with-skill.html --visual (기존 판정 보존)
  - node src/cli.js audit tests/fixtures/slop/<신규-미가드-모션>.html (fail/WARN), tests/fixtures/clean/<가드>.html (clean)
- M8.3 후: 문서 일관성 리뷰(시각 임팩트 ↔ TY1/HI2 충돌 없음 명문). 기계 변경 없으면 test 영향 0.
- 통합 게이트: 위 전부 green + 이중채점 매트릭스 수기 점검 + node src/cli.js preview exp-skillshop-mo.html 로 inert preview 에서 모션 렌더(script-src none 호환) 육안 확인.

## 핸드오프

- 승인 후 실행: M8.1(문서·프롬프트)·M8.3(시각 임팩트 문서)은 executor 단일 슬라이스. M8.2(기계검사 승격)는 검사별 executor 슬라이스 + 각 슬라이스에 fixture+baseline+test 동반(M2 게이트). 적대 심사 판정이 갈리는 b1/b3 는 critic 으로 우회·오탐 재검 후 WARN/LLM 확정. 통합·최종 verification 은 부모가 보유.
- 미해결 결정(승인자 입력 필요): (1) b1/b3 를 WARN 으로 승격할지 전부 LLM 잔류(옵션 A 강등)할지, (2) MO 텔 id 네이밍 컨벤션(C6.. 확장 vs 신규 M1.. 군), (3) M7.1 을 별도 run 으로 분리하는 데 동의하는지.
