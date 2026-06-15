# RALPLAN-DR (rev2): MO(모션·인터랙션) 빌드 레이어 + 시각 크래프트 규율 통합

run-id: 2026-06-14-mo-layer / stage: revision / 상태: pending approval (승인 전, product 소스·audit·SKILL 미변경)

> rev2 변경 요약: Architect(WATCH/COMMENT)·Critic(ITERATE) 코드 대조 피드백 반영. [HIGH] b1 경로를 extractCssRules 폐기 → 중첩 보존 헬퍼 선신설 게이트로 재정의, 8장 자기모순(exp WARN0) 해소. b1 채점 경로 단일화(WARN→collectWarnings 단독·MACHINE_CHECKS 미등록·baseline 무변경 / FAIL→DE3 5번째 arm). 이중채점 매트릭스 정정(reduced-motion 현행 기계 arm 부재 = 최초 기계 승격). MO1 정적 레인·공통 파서 의존 명시. scroll-driven reveal 시각 픽스처 수용 기준화. 시각 레인=원본 HTML 렌더(inert preview 아님) 정정. M7 5절 흡수 명문화. audit 장르 배관 부재 명시. Architect Synthesis 3안 채택.

## 0. 배경 요약 + 정정

실험으로 병목이 확정됐다. exp-skillshop-mo.html(레퍼런스 파이프 없이 MO/시각 빌드 규율만 얹어 재빌드)은 audit slop 0%(0/15 fail, exit 0, WARN0) + 진짜 인터랙션(hover7/focus-visible4/active1/@keyframes3/scroll-driven3/details1/sticky nav/smooth-scroll, 전부 prefers-reduced-motion 게이트). baseline v0-after-with-skill.html은 7%(TY2 1 fail)·WARN2·인터랙션 0. 결론: 병목은 레퍼런스 추출 CLI(M7)가 아니라 빌드 레이어다. M7을 후순위 디스코프, MO/시각 레이어를 M8로 신설.

핵심 통찰: CSS-first 모션(transition/@keyframes/animation-timeline scroll()·view()/:target/details/sticky)은 preview.js의 script-src none inert 프리뷰에서도 렌더된다 → 산출물 자체가 무JS 인터랙티브.

**[정정 — 코드 대조]** 시각 감사 레인(geometry.js analyzeVisualTells)은 inert preview를 렌더하지 않는다. pathToFileURL로 원본 빌드 HTML을 puppeteer에 직접 띄우므로 스크립트가 audit 시점에 실제 실행된다. MO가 CSS-first라 본 결론(인터랙티브 도입이 보안/감사와 무충돌)은 불변이나, rev1의 "inert preview에서 geometry 측정" 전제는 사실 오류였다. 시각 레인 상호작용 분석은 6장·8장 scroll-driven 항목으로 재정의한다.

## 1. Principles (4원칙)

- P1 빌드레이어 우선, 레퍼런스 후순위. 실험으로 입증. 1순위는 MO/시각 빌드 규율, M7 reference intelligence는 후순위 재배치.
- P2 cap-not-quota 불변. MO/시각 원칙은 상한이지 처방이 아니다. 모션 quota·고정 transition 디폴트·매 페이지 동일 시그니처 모션은 새 텔.
- P3 CSS-first·inert-safe·progressive-enhancement. 무JS 구현으로 inert preview·신규 런타임 의존성 금지·산출물 단일 HTML 불변 보존. @supports/정적 폴백으로 미지원 무해 degrade.
- P4 이중 채점 금지(불변식). 기계 레인 커버 항목은 LLM 체크리스트에서 제거. 신규 기계검사 승격은 fixture + tests/quality/baseline.json 갱신을 한 커밋으로(M2 게이트). 단 WARN 검사는 baseline 무변경(7장 참조). reduced-motion·44px·focus-visible·transition:all 의 소유 레인은 5장 매트릭스로 코드 대조 확정.

## 2. Decision Drivers (top 3)

- D1 인터랙티비티를 보안/감사 모델을 약화하지 않고 도입 가능한가. → CSS-first가 산출물에 무JS로 실린다. JS 도입은 즉시 기각(런타임 의존성·preview stripActiveContent가 어차피 제거).
- D2 모션 추가가 anti-slop 테제를 훼손하지 않는가. → MO1 장식 모션 텔 목록 + cap 규율로 방어.
- D3 어디까지 기계 레인 승격할 것인가. → 적대 심사 통과분만, 그리고 **그 검사가 의존하는 파서가 존재할 때만** 승격. 우회·오탐 취약분과 파서 미구비분은 LLM 잔류. L3/TY3/DE2 기각 선례 + 본 rev의 extractCssRules 한계가 기준선.

## 3. Viable Options

### 옵션 A — 문서·프롬프트 통합만 (코드 무변경)
core/design-principles.md MO1~MO4 + 시각 임팩트 절, SKILL.md Phase2/3/4/5, design-tells.md 장식 모션 텔, concept-sheet.md, ROADMAP.md. src/* 무변경.
- Pros: 최저 리스크, baseline/테스트 무영향, 실험이 이 레인만으로 0% 입증, 불변식 자연 준수.
- Cons: 인터랙션 유무·장식 모션이 전부 LLM 판단(결정론 부재), audit가 모션 회귀를 못 막음.

### 옵션 B — A + 적대 심사·파서 요건을 통과하는 기계검사만 승격
A 전부 + (전제) at-rule/@keyframes 중첩 보존 파서 헬퍼 선신설. 후보: b1 reduced-motion 미가드 모션 정적검사(WARN), b3 hover-only 어포던스 검사. transition:all은 이미 DE3 정적 arm(신규 아님, 확인만).
- Pros: 모션 규율 일부를 결정론 고정. M2 게이트로 추적.
- Cons: **공유 파서 확장은 저비용이 아니다**(회귀면적), 승격해도 우회 잔존(빈 가드 블록·decoy focus). 파서 미통과 시 자동강등.

### 옵션 C — B + M7.1 레퍼런스 큐레이션 병행
- Cons: 실험상 레퍼런스 비병목 → P1 위반·스코프 분산. 기각, M7.1은 별도 run 보존.

## 4. 권고 옵션 + 시퀀싱 (Architect Synthesis 3안 채택)

권고: A를 본 run 즉시 출하 + 파서 인지형 단일 기계 WARN을 분리 후행(=옵션 B의 게이트형). 근거: M8.1/M8.3(문서·프롬프트·시각 임팩트)은 불변식 청정·실험 입증·코드 무위험이므로 즉시. b1/b3는 본 run 기계 슬라이스로 **묶지 않는다** — 별도 게이트 M8.2의 **첫 산출물이 파서 헬퍼**다. 헬퍼가 적대 심사를 통과한 뒤에만 b1 WARN 승격, b3는 decoy 우회를 닫기 전까지 LLM 잔류. 어느 검사도 적대 심사·파서 요건을 못 견디면 자동강등(옵션 A). C는 디스코프.

### 마일스톤 시퀀싱 (정확한 파일·심볼 타깃)

- **M8.1 문서·프롬프트 통합 (코드 무변경, A 범위, 본 run 즉시)**
  - core/design-principles.md: "## 모션·인터랙션 (MO)" 신설(MO1~MO4, 5장), "## 시각 임팩트" 신설(6장), "## 충돌 해소 기록" 1번(모션 문법) 항목을 MO 군으로 승격·확장하고 reference-gallery 플랜 5절(motion-role/budget/fallback) 흡수를 명기, "## 알려진 공백(백로그)"에 MO 기계 승격 후보(b1 파서 전제·MO1 정적·b3 LLM 잔류) 추가.
  - core/design-tells.md: 장식 모션 텔 등재(MO1 음성쌍: 배경 aurora/sparkle/shader/gradient-animation, 패럴랙스, 타자기 루프, 자동 캐러셀/마퀴). id 컨벤션은 승인 결정(C6 animated-decoration 확장 vs 신규 M군) — 어느 쪽이든 기계 승격 시 combineAudits id 병합(신규 denominator 금지).
  - SKILL.md: Phase2 토큰 커밋에 motion-role(none/orientation/feedback/progress/reveal/delight, cap=micro-only|one-signature) + 시각 임팩트 헤드룸; Phase3 빌드 규율에 MO1~MO4·CSS-first·inert-safe 어휘; Phase4 shot 자기검수에 첫 viewport 위계·모션 정적성 점검; Phase5 LLM 체크리스트에 MO 군 LLM 암(기계 승격분 제외).
  - templates/concept-sheet.md: 토큰 커밋 블록에 motion-role·시각 임팩트 칸.
  - ROADMAP.md: M8 신설, M7 재배치(M7.1 유지·M7.2/3 디스코프), **reference-gallery 플랜 5절을 M8이 흡수함을 운영 원칙·충돌해소 기록과 함께 명기**(후속 M7.1 재추가로 인한 병행 컨벤션 표류 차단).
- **M8.2 기계검사 승격 (B 범위, 별도 게이트 슬라이스 — 승인 후, 파서 우선)**
  - **첫 산출물(필수 선행): at-rule/@keyframes 중첩 보존 파서 헬퍼 신설.** extractCssRules(src/audit.js:115-130)는 **건드리지 않는다**(단일레벨 정규식 `([^{}@]+){([^{}]*)}`이 @media/@supports/@keyframes 헤더를 버림 — TY4/CO1/DE1/DE3 소비자가 이 평탄 동작에 의존하므로 불변 유지). 별도 헬퍼가 @media (prefers-reduced-motion: no-preference) 블록 경계와 @keyframes 블록을 인식해 "선언이 어느 at-rule 컨텍스트 안인가"를 돌려준다.
    - 단위테스트: tests/unit/audit.test.js — 가드 안/밖 transition 구분, @keyframes from/to 셀렉터 누출 없음, @supports 중첩.
    - 양방향 픽스처: tests/fixtures/clean/ 에 reduced-motion 가드 clean(**exp-skillshop-mo.html을 clean 케이스로 고정**), tests/fixtures/slop/ 또는 tests/redteam/ 에 미가드 모션 fixture.
  - **헬퍼가 적대 심사(7장)를 통과한 뒤에만** b1 승격. 채점 경로 단일 확정:
    - **WARN 경로(권고): collectWarnings()(src/audit.js:540 부근) 단독.** MACHINE_CHECKS 미등록, findings/failed/slopScore/exit 무영향, **baseline.json 무변경**(baseline은 failed만 비교 — audit.js:633).
    - FAIL이 적대 심사로 정당화될 때만: 신규 ID·신규 denominator 금지. checkQualityFloor(src/audit.js:494-535)의 **5번째 arm**으로 접어 단일 DE3 denominator 유지. 이 경우에만 baseline.json failed 매핑 갱신(같은 커밋).
  - b3 hover-only 어포던스: decoy :focus-visible 빈 룰 우회(7장)를 닫는 무효화 로직이 견고해지기 전까지 **LLM 잔류**. 승격 시 동일 헬퍼·동일 채점 경로 규율.
  - **scroll-driven reveal 시각 픽스처**(WATCH 해소, 8장 수용 기준): tests/redteam/ 에 opacity:0 + animation-timeline reveal 픽스처 추가, 시각 레인(geometry scroll=0, isVisible opacity<0.05)이 오탐/은폐 없음 단위 검증(geometry.test.js).
- **M8.3 시각 임팩트 규율 (LLM·빌드 레인, 기계 승격 보류, 본 run 문서)**
  - core/design-principles.md 시각 임팩트 절(6장): 첫 viewport 위계·대비 헤드룸·타입스케일 드라마는 LLM/빌드 잔류, TY1 7색 하드캡·HI2 one-winner 와 충돌 회피 명문. 기계 승격(첫 viewport CTA 카운트=HI2 백로그)은 LA3 듀얼렌더와 합류 후속 후보로만 기록.
- **M7.1**(별도 run 권장, 본 run 디스코프) / M7.2·M7.3 디스코프(실험상 비병목).

## 5. MO 원칙군 스케치 + 이중채점 매트릭스 (코드 대조 정정)

- MO1 purposeful-motion-only [LLM + 빌드, 부분 STATIC 후보] — 목적(방향/피드백/진행/상태변화) 모션만. 장식 모션은 텔. cap: 시그니처 모션 ≤1(quota 아님). design-tells 음성쌍과 단일 계기(이중채점 금지). **기계화 후보는 STATIC 레인(src/audit.js)** — geometry는 부적합(scroll=0 단일 스크린샷이라 애니메이션 미표집, 애니메이션 그라데이션 배경은 contrast에서 이미 skip). **b1과 동일한 중첩 보존 파서 + @keyframes→animation-name→animation-iteration-count:infinite 상관**이 필요(저비용 아님 — 공통 파서 의존). 후보 유지.
- MO2 motion-physics [부분 기계 + LLM] — transform·opacity 위주(layout 트리거 금지), 120~400ms, ease-out, 60fps. transition:all 금지는 **이미 DE3 정적 arm(b) 소유** → 재기술 금지, 교차참조. reduced-motion 가드는 아래 정정 참조. LLM 암 = duration/easing 취향.
- MO3 affordance [부분 기계 + LLM] — hover + focus-visible + active 동반, 포인터, 히트영역 44px(**HI2 LLM 소유, 기계 arm 없음** → 교차참조), hover-only 금지. focus-visible 가시성(outline 대체 없는 none 금지)은 **DE3 정적 arm(a) 소유** → 교차참조. 기계 후보 = b3 hover-only(LLM 잔류 중). LLM 암 = active 피드백 적절성.
- MO4 css-first-inert-safe [빌드 + LLM] — 무JS(transition/animation/animation-timeline scroll()·view()/:target/details/:focus-visible/sticky/scroll-behavior). @supports 폴백, 정적 degrade 무해. 기계 승격 없음(preview stripActiveContent가 JS 제거하므로 산출물 탐지 무의미).

**이중채점 매트릭스 (코드 대조 확정):**
- focus-visible outline → **DE3 기계 arm(a) 소유**(audit.js checkQualityFloor). MO3는 교차참조만.
- transition:all → **DE3 기계 arm(b) 소유**. MO2는 교차참조만.
- 히트영역 44px → **HI2 LLM 소유, 기계 arm 어디에도 없음**(audit.js/geometry.js 무매치). MO3는 교차참조만.
- **reduced-motion → 현행 기계 arm 부재.** DE3 원칙 산문(design-principles.md:245)에만 존재, checkQualityFloor는 4 arm(focus-visible/transition:all/viewport/img)뿐(audit.js:494-535)이라 reduced-motion arm 없음. 따라서 **b1은 교차참조가 아니라 reduced-motion 최초의 기계 승격**이다 — M2 픽스처+baseline 게이트 + M8.2 중첩 파서 요건 충족이 선결.
- 규율: MO 신규 검사는 위와 단일 계기(교차참조)로만 묶고, combineAudits denominator에 중복/신규 ID 추가 금지(cap-not-quota·이중채점 금지).

## 6. 시각 임팩트 규율

- 첫 viewport 위계: 지배 요소 정확히 1개(HI2 one-winner 단일 계기, 재채점 금지). 근거 Lindgaard 2006(50ms) → 첫 viewport 별도 QA.
- 대비 헤드룸: DE3 대비 4.5:1 바닥선 위의 헤드룸 활용(상한 아닌 권장, DE3와 무충돌).
- 타입스케일 드라마: TY1 가시 크기 ≤6·하드캡7과 충돌 회피 — 드라마는 새 크기 추가가 아니라 기존 스케일 양 끝 + 웨이트·잉크 농도(HI1 weight-before-size). 고정 비율 메뉴 금지(cap-not-quota).
- scroll-driven 시각 레인 상호작용(0장 정정 연계): geometry는 원본 HTML을 scroll=0에서 렌더하고 isVisible은 opacity<0.05를 비가시 처리 → opacity:0 시작 scroll-driven reveal 콘텐츠는 L1/L2/S3/TY1/TY2/DE3 측정에서 제외(주로 미탐, 위폴드 전중앙+비중앙 reveal 숨김 시 L2 오탐 가능). M8.2 픽스처로 오탐/은폐 없음 증명(8장).
- 근거(reference-gallery 플랜 인용, paper-reported, 방향 근거 한정): Kurosu&Kashimura 1995 / Tractinsky 2000 / Lavie&Tractinsky 2004(classical vs expressive→mood 축) / Lindgaard 2006(50ms) / Cyr 2010(컬러 어필 문화 의존→범용 정답 금지). 전환율 직접 주장 금지.

## 7. 감사 레인 승격 후보 적대 심사

- **파서 헬퍼(M8.2 첫 산출물) 자체 심사**: extractCssRules 불변 유지로 TY4/CO1/DE1/DE3 회귀 0 증명 + @keyframes from/to 누출 0 + 가드 안/밖 정확 분류. 이 헬퍼가 적대 심사를 못 견디면 b1/MO1 둘 다 자동강등(옵션 A).
- b1 reduced-motion 미가드: 우회 — 빈 @media (prefers-reduced-motion: no-preference){} 블록 + 모션 밖 선언, 또는 reduce 블록만. 오탐 — 무모션 페이지·서드파티 키프레임. 판정: **WARN 레인 권고**(납품 비차단). 빈 가드 블록 무효화(블록 내 선언 0이면 무시)로 일부 강화하나 우회 잔존 → WARN 잔류가 안전. FAIL은 우회·오탐 둘 다 취약해 비권고(정당화 시에만 DE3 5번째 arm).
- b3 hover-only: 우회 — decoy :focus-visible{} 빈 룰. 오탐 — 순수 장식 :hover. 판정: 빈 룰 무효화가 견고해지기 전까지 **LLM 잔류**.
- 어포던스 0(인터랙션 전무): 우회 — 무의미 transition 한 줄. 오탐 — proposal 등 정적 문서 정당. 판정: **기각, LLM 잔류**(L3/TY3/DE2 선례 + 장르 의존).
- **audit 장르 배관 부재 명시**: --page/proposal 게이트는 SKILL/LLM 레인에만 존재. cli.js/audit.js/geometry.js에 --page/장르 입력 무(검색 무매치, design-principles.md:254 doc-only). 따라서 audit 단의 장르 게이팅은 순신규 배관이며, b1/b3가 WARN 전용이면 불요(WARN은 납품 비차단). 어떤 모션 검사라도 FAIL 승격되면 proposal 오탐 발생 → 어포던스0 기각 유지가 옳다.

## 8. 수용 기준 (코드 검증 가능, 자기모순 해소)

- npm test green(unit + e2e). M8.2 진입 시 tests/unit/audit.test.js의 파서 헬퍼 양방향 분리·오탐 방지·@keyframes 누출 0 테스트 green.
- npm run benchmark: WARN 검사는 baseline 무변경으로 회귀 0. FAIL 승격분(있을 때만)은 baseline failed 매핑을 같은 커밋에 동반해 miss/fp 회귀 0.
- node src/cli.js audit exp-skillshop-mo.html --visual → 여전히 slop 0%(0 fail, exit 0). **신규 WARN 후에도 exp WARN0 유지는 M8.2 중첩 파서 + exp-clean 픽스처로만 보장된다 — 평탄 파서(extractCssRules) b1으로는 exp의 가드 안 transition을 거짓 WARN 처리하므로 충족 불가임을 명기.**
- node src/cli.js audit v0-after-with-skill.html --visual → 기존 판정(TY2 fail) 보존, 신규 검사가 baseline 외 새 fail 무유발.
- slop fixtures 여전히 fail / clean fixtures 여전히 pass. 미가드-모션 fixture = WARN(또는 FAIL 승격 시 DE3 arm fail), reduced-motion 가드 clean fixture(=exp 포함) = WARN/fail 없음.
- **scroll-driven 시각 픽스처**: opacity:0 + animation-timeline reveal 픽스처로 시각 레인이 오탐/은폐 없음 증명(geometry.test.js). 교차장르 ≥1(exp는 단일페이지·단일장르라 미입증).
- 문서 검증: design-principles.md MO1~MO4·시각 임팩트 절 존재, SKILL Phase2/3/4/5 MO 통합, 매트릭스 정정 반영(reduced-motion 최초 기계 승격 표기), reference-gallery 5절 흡수 기록.

## 9. 리스크 + 완화

- R1 모션 추가가 anti-slop 테제 훼손. → MO1 장식 모션 텔 목록 + cap-not-quota + design-tells 등재 + shot 자기검수.
- R2 기계검사 오탐 회귀(무모션/정적 문서 fail). → WARN 우선, 적대 심사·파서 요건 통과분만, 양방향 분리 픽스처 + baseline fp 가드. proposal 장르 FAIL 게이트는 순신규 배관이라 WARN 전용 유지로 회피(7장). **scroll-driven opacity:0 reveal 은폐/오탐은 M8.2 시각 픽스처로 증명**(8장).
- R3 이중 채점. → 5장 매트릭스(코드 대조) 강제, MO 검사 교차참조만, combineAudits denominator 중복/신규 ID 금지. WARN→collectWarnings 단독·MACHINE_CHECKS 미등록.
- R4 scroll-driven 미지원 브라우저. → MO4 @supports (animation-timeline: scroll()) 게이트 + 정적 폴백 무해 degrade + reduced-motion 중첩. **별개로 시각 감사 측정 은폐는 @supports 폴백이 아니라 M8.2 시각 픽스처로 커버**(R2 항목과 분리).
- R5 스코프 분산(레퍼런스 동시 진행). → M7 디스코프, P1 고정.
- R6 inert-safe/런타임 의존성 회귀. → MO4 CSS-first 강제, preview stripActiveContent·CSP script-src none·신규 의존성 금지 불변. (단 시각 audit은 원본 렌더라 스크립트 실행 — 0장 정정, MO4가 산출물에 JS를 넣지 않으므로 무관.)
- R7 파서 확장 회귀면적. → extractCssRules 불변(소비자 무영향) + 별도 헬퍼 + 단위테스트, 헬퍼 미통과 시 자동강등(옵션 A).

## 10. 검증 단계 (단계별 명령)

- M8.1 후: 문서 diff 리뷰(MO 절·시각 임팩트·SKILL Phase2/3/4/5·concept-sheet·ROADMAP·5절 흡수 기록). 코드 무변경이므로 npm test / npm run benchmark 영향 0 확인.
- M8.2 파서 헬퍼 후(b1 승격 전): node --test tests/unit/audit.test.js(가드 안/밖 분류·@keyframes 누출 0·@supports 중첩), npm test(green), npm run benchmark(WARN이면 baseline 무변경 회귀 0), node src/cli.js audit exp-skillshop-mo.html --visual(0%·WARN0), node src/cli.js audit v0-after-with-skill.html --visual(기존 판정 보존), node --test tests/unit/geometry.test.js(scroll-driven reveal 픽스처 오탐/은폐 없음).
- M8.2 b1 WARN 승격 후: 미가드-모션 fixture=WARN, exp/가드 clean fixture=WARN 없음, exp WARN0 유지 재확인. FAIL(DE3 arm) 승격 시에만 baseline 갱신 + npm run benchmark 재검.
- M8.3 후: 문서 일관성 리뷰(시각 임팩트 ↔ TY1/HI2 충돌 없음). 기계 무변경이면 test 영향 0.
- 통합 게이트: 전부 green + 이중채점 매트릭스 수기 점검 + node src/cli.js preview exp-skillshop-mo.html 로 inert preview 모션 렌더 육안(산출물 무JS 확인).

## 핸드오프

- 승인 후: M8.1·M8.3(문서)은 executor 단일 슬라이스. M8.2는 (1) 파서 헬퍼+테스트+scroll-driven 픽스처 슬라이스 → critic 적대 심사 → (2) 통과 시에만 b1 WARN 슬라이스(collectWarnings 단독). b3는 LLM 잔류 유지. 통합·최종 verification은 부모 보유.
- 미해결 결정(승인자 입력): (1) MO 텔 id 컨벤션(C6 animated-decoration 확장 vs 신규 M군), (2) b1 파서 헬퍼가 적대 심사 통과 시 WARN 확정 vs 보수적으로 옵션 A 잔류, (3) M7.1 별도 run 분리 동의.
