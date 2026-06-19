# 시니어 디자인 원칙 (design principles)

design-tells.md가 "하지 말 것"의 목록이라면, 이 문서는 **시니어 디자이너가 실제로 하는 것**의
목록이다. 빌드(Phase 3)의 양성 규율이며, 컨셉 시트(Phase 2)가 이 문서의 토큰 결정을 잠근다.

방법론: 10개 소스(Anthropic frontend-design 플러그인, spark-joy, Polaris, Carbon, Primer,
GOV.UK, Refactoring UI, 실용 타이포그래피·한글 조판 조사, 시니어 랜딩 테어다운, 제안서 리서치)에서
원시 원칙 207개를 수집, 적대적 종합·비평으로 24개로 압축했다 (2026-06-13, 기록:
`artifacts/research/`). 출처에서 아이디어만 채택했고 산문은 복사하지 않았다.

**핵심 테제: 균일함이 AI 티다.** 따라서 억제 원칙은 *기본값(default)*이지 절대 상한(hard cap)이 아니다 — **컨셉 시트가 의도를 명시하면 초과 합법**이다.
"시그니처 무브를 최대 1개"는 규율이고, "시그니처 무브를 반드시 1개"는 매 페이지를 똑같이 만드는
새로운 텔이다. 고정 디폴트(매번 17px 본문, 매번 같은 그리드 브레이크)는 세대 간 지문이 된다.

## 레인 표기

- **기계·정적** — `src/audit.js`가 HTML/CSS 파싱으로 판정 (`node src/cli.js audit`)
- **기계·시각** — `src/geometry.js`가 렌더 기하/계산 스타일로 판정 (`audit --visual`)
- **LLM** — SKILL.md Phase 5 체크리스트
- **빌드** — 생성 규율 + Phase 4 스크린샷 검수로 확인 (점수화하지 않음)

기계 레인이 커버하는 원칙은 LLM이 재채점하지 않는다 (design-tells와 동일한 이중 채점 금지 불변식).

## 타이포그래피

### TY1 single-type-scale [기계·시각]

모든 폰트 크기는 **하나의 선언된 스케일**에서 나온다: 서로 다른 크기 6개 이하(하드 캡 7).
17px, 1.45em 같은 일회성 값 금지 — 추가 차등은 웨이트·잉크 농도로 내고, 새 크기를 만들지 않는다.
스케일 비율(또는 수동 세트)은 컨셉 시트의 밀도 방침에서 도출해 시트에 기록한다 —
고정 비율 메뉴도, 장르→비율 매핑도 두지 않는다 (수렴 방지).
**적용**: 섹션 마크업 전에 `:root`에 `--fs-*` 토큰 선언, 모든 font-size는 토큰 참조.
(출처: spark-joy, Carbon, GOV.UK, Polaris, Refactoring UI, 실용 타이포그래피)

### TY2 readable-body-setting [기계·시각]

본문 16–21px, 레이아웃에 맞추려 줄이지 않는다(레이아웃을 고친다). 본문 행길이 45–75자:
라틴 max-width 60–68ch, 한글 칼럼 34–40em. 와이드/풀블리드 섹션 안에서도 문단은 제약을 유지한다.
**적용**: 본문 크기는 컨셉 시트의 밀도 방침에서 16–21px 사이로 선택(빽빽한 상세는 낮게, 성긴
랜딩은 높게) — **고정 디폴트 금지**(매번 17px이면 세대 간 지문). 모든 문단 보유 블록에
`.prose` 래퍼(max-width 제약)를 히어로 아래·푸터까지 적용. 법적 고지·각주 등 진짜 작은 글씨는
`<p>`가 아니라 `<small>`/`<figcaption>`으로 — 시각 검사는 `<main>` 안의 80자+ `<p>`에 크기
바닥(≥ 15.5px)을 요구한다.
(출처: spark-joy, GOV.UK, Primer, Refactoring UI, Butterick 45–90자, 제안서 리서치)

### TY3 leading-tracking-inverse-to-size [빌드 + LLM]

행간·자간은 크기에 반비례한다: 본문 1.4–1.6(라틴)/1.6–1.9(한글); 32px+ 디스플레이는
1.0–1.2 행간에 letter-spacing −0.01~−0.02em; 라틴 본문 자간 0(한글 고딕 본문은 TY5가 소유);
**대문자 텍스트는 크기 불문** +0.04~0.1em 자간(아이브로·디스플레이 캡 모두 — 무자간 금지 규칙에서
면제); text-align: justify 금지. 행간은 스케일 단계마다 명시적으로 페어링(48px/1.1, 30px/1.2,
17px/1.6) — 전역 한 값 금지.
(출처: spark-joy, GOV.UK, Polaris, Primer, Refactoring UI, Butterick)

### TY4 two-families-explicit-roles [기계·정적]

타입 패밀리 최대 2개(디스플레이+본문 역할 분담) 또는 1패밀리 3웨이트; 모노스페이스는 선택이되
**단 하나의 역할만**(코드, 아이브로, 숫자 데이터 중 하나 — 둘 이상 금지). 모든 font-family
스택은 2개 이상 나열하고 CSS 제네릭 키워드로 끝난다. 페어링은 컨셉 시트 톤의 성격 분류에서
도출(올드스타일 세리프=우아, 중립 그로테스크=담백, 기하/사각=기술적, 라운드=경쾌) — 중립
그로테스크도 *근거 있는 톤 선택*이어야 하며, 무심한 디폴트는 금지.
**적용**: `:root`에 `--font-display`/`--font-body` 선언; h1–h3는 디스플레이, p/li는 본문;
페어링 시 x-height 근사 매칭; 선택한 분류의 풀 폴백 체인 사용.
— 단, 컨셉 시트가 의도를 명시하면 패밀리 수 초과 합법(advisory 경고만).
(출처: Anthropic frontend-design 플러그인, spark-joy, Butterick, modern-font-stacks)

### TY5 hangul-typesetting [arm별 분리 레인]

한글 카피가 실리는 페이지: 제목·짧은 카피에 `word-break: keep-all` + `overflow-wrap: break-word`
(단어 중간 줄바꿈 금지); 고딕 본문 자간 −0.01~−0.02em(실측: 네이버 −0.3px, 다음 −0.34px @17px);
본문 행간 1.6–1.8; 스택 `Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic',
sans-serif`; 한글에 `font-style: italic` 금지(브라우저 가짜 기울임) — 강조는 웨이트나 잉크 농도로.
(출처: lqez 한글 타이포 조사, W3C klreq)

**레인 (arm별 — 이중 채점 금지)**: A 어절 중간 줄바꿈 = **기계·시각 fail**(`src/geometry.js` TY5 finding — `Range.getClientRects()`로 공백·구두점 없이 인접한 한글 음절이 실제 다른 줄에 렌더되는지); B 폴백 스택에 한글 폰트·sans-serif 제네릭 부재 = **기계·정적 WARN**; C 한글 `font-style:italic` = **기계·정적 WARN**(둘 다 `src/audit.js` collectWarnings, broad selector/인라인 한정); D 고딕 본문 자간·E 본문 행간 = **LLM 잔류**(취향 판단). A/B/C는 기계가 보므로 LLM 체크리스트에서 제외.

## 여백·리듬

### SP1 spacing-token-scale [빌드]

선언된 **하나의** 스페이싱 스케일, 기본 4/8 기반 {4,8,12,16,24,32,48,64,96,128/160};
인접 단계는 25% 이상 차이. 모든 margin/padding/gap은 스케일 멤버(0/auto 허용, 1–2px 헤어라인
보정 면제). GOV.UK식 5px 체계도 *그 페이지의 유일 스케일로 선언하면* 합법 — 두 체계 혼용 금지.
**적용**: 빌드 전 `:root`에 `--space-*` 선언; 13px/18px/35px 일회성 금지; 갑갑하면 3px
미세조정이 아니라 스케일 한 단계 위로.
(출처: spark-joy, Carbon, Primer, GOV.UK, Polaris, Refactoring UI)

### SP2 proximity-encodes-grouping [LLM]

그룹 *간* 간격이 그룹 *내* 간격을 어디서나 가시적으로 초과한다. 제목은 아래로 묶인다:
h2/h3 margin-top ≥ 1.5–2× margin-bottom (예: 위 48–64px / 아래 16px). 컨테이너 외곽 패딩 ≥
자식 간 최대 간격(카드 자식이 16px 간격이면 카드 패딩 ≥ 16px). 아이콘/레이블은 제 내용에
밀착(안 ~8px, 밖 ≥ 24px). 섹션 간 ≥ 2× 섹션 내.
**적용**: 제목 마진을 비대칭으로 명시(`h2 { margin: 64px 0 16px }`), `margin: 32px 0` 금지;
핵심 클레임은 장식 대신 둘레 여백으로 강조.
(출처: spark-joy, Carbon, Refactoring UI, Butterick, Polaris)

### SP3 two-register-rhythm [빌드]

두 개의 스페이싱 레지스터, 미분화된 중간값 금지: 섹션 레지스터 데스크탑 세로 패딩 64–128px
(한 곳은 96–160px 휴지 밴드 가능) vs 콘텐츠 레지스터 8–24px — 외:내 ≥ 4:1. 섹션 간 간격은
변화를 준다: 최대/최소 ≥ 1.5. 의도적 고밀도 존은 **최대 1곳**, 큰 여백으로 감싸며, 컨셉 시트의
밀도 방침이 요구할 때만(쿼터 아님 — 매 페이지 같은 무브는 그 자체로 지문). Phase 4 데스크탑
스크린샷에서 검증; L3(균일 리듬)은 LLM 레인의 음성 검사로 남는다 (단일 계기 원칙).
— 단, 컨셉 시트 밀도 방침이 의도를 명시하면 고밀도 존 수 초과 합법(advisory 경고만).
(출처: spark-joy, Polaris, Refactoring UI, 시니어 랜딩 테어다운)

## 색

### CO1 role-token-palette-accent-budget [기계·정적 (리터럴 예산), 잔여는 LLM]

팔레트 = `:root`의 역할 명명 토큰(--bg --surface --fg --muted --border --accent + 시맨틱 선택),
페이지 전체 해석 색 ≤ 12, **:root 밖 색 리터럴 ~0**. 픽셀 예산: 중립색이 렌더 면적의 70–90%;
채도 있는 강조는 **한 가족**만 5–10%, 1차 CTA·링크·포커스·셀렉션·하이라이트 1–2곳 전용;
뷰포트당 가시 강조 사용 ≤ 2; 제2 강조색 금지; 시맨틱 색(success/danger)은 시맨틱 의미로만,
프로모션 금지. C3(아이콘 단일 강조)을 페이지 전체 정량 예산으로 확장한 것.
**적용**: 팔레트를 커스텀 프로퍼티로 먼저 구축; hover/active는 동일 색상(hue) 명도 시프트로 파생;
CTA와 링크가 한 화면에 있으면 링크를 fg+밑줄로 강등해 강조 카운트를 지킨다.
— 단, 컨셉 시트가 역할을 명시한 다색 강조(예: CTA·경고·선택의 역할 분리)는 합법(advisory 경고만).
(출처: Anthropic 플러그인, spark-joy, GOV.UK, Primer, Carbon, Polaris)

### CO2 tinted-ink-discipline [LLM]

기본 잉크는 브랜드 색상으로 5–15% 채도 틴트된 near-black(L* ~10–25%); 순수 #000-on-#fff은
컨셉 시트가 명시한 톤 선택(스타크/브루탈리스트)일 때만 합법, 무심한 디폴트 금지. 중립색은
웜/쿨 한쪽으로 통일. 중립 텍스트 2–3티어, 대비 단조 감소, 본문 티어 ≥ 4.5:1. **채도 있는
배경 위 보조 텍스트는 같은 hue의 탈채도/명도 시프트** — 회색이나 rgba 흰색 금지. 위계는
그레이스케일로 바꿔도 살아남아야 한다.
(출처: Refactoring UI, spark-joy, 시니어 랜딩 테어다운)

### CO3 separation-ladder [LLM]

분리 수단은 사다리 순서대로: ①여백 → ②배경 명도차 2–6%(표면 톤 총 3–4개 이하, 중첩 표면은
부모에서 단조 방향 한 단계) → ③1px 헤어라인(배경 대비 ~8–12% 휘도) → ④그림자(최후).
1px 행 보더는 데이터 행(테이블, dl 키/값) 전용 합법. 컨테이너 너비 80% 이상을 가로지르는
보더급 분리선 2개 인접 금지. 반투명 블러 분리는 C2의 텔 — 교차 참조하되 재채점 금지.
(출처: Refactoring UI, Polaris, 시니어 랜딩 테어다운)

## 레이아웃

### LA1 container-and-content-width [LLM]

중앙 래퍼 max-width 960–1280px, padding-inline 모바일 16px/데스크탑 24px+
(한 줄: `clamp(1rem, 6vw, 3rem)`). 각 요소는 *제 콘텐츠*에 최적인 너비를 갖는다: 산문 ≤ 68ch,
폼 480–600px, 사이드바 px 고정 — 공간을 채우려는 width:100% 금지. 풀블리드 배경 밴드는 허용하되
그 콘텐츠는 래퍼로 재진입. 텍스트는 절대 풀블리드로 흐르지 않는다.
(출처: GOV.UK 1020px, Primer 1280px, Carbon, spark-joy, Refactoring UI)

### LA2 asymmetry-with-intent [LLM]

2칼럼은 불균등 비율(1.5–2.2:1) 선호 — 50/50은 양쪽이 진짜 동격일 때만 합법(교차 피처 행 등).
피어 그룹에서는 **최대 1개**만 승격(면적 ≥ 1.8–2×, 반전 배경, 또는 강조 엣지 하나).
그리드 브레이킹 무브는 페이지당 **최대 2개**, 컨셉 시트의 시그니처에서 도출 — 섹션 이음새
걸침·6° 이하 미세 회전·브레이크아웃 너비는 *예시*지 메뉴가 아니다. 브레이크는 컨테이너 *사이*에서:
컨테이너 안에서는 자식들이 공유 키라인 ≤ 3, 페이지 전체 텍스트 좌측 정렬선 ≤ 4–5.
**같은 정형 브레이크를 두 세대 연속 쓰지 않는다** (히어로 이음새 −48px 스탯 카드 같은 통조림 무브 금지).
— 단, 컨셉 시트가 의도를 명시하면 그리드 브레이크 수 초과 합법(advisory 경고만).
(출처: 시니어 랜딩 테어다운, spark-joy, Refactoring UI)

### LA3 disproportionate-responsive-scaling [LLM]

~640px 브레이크포인트에서 요소는 **불비례**로 스케일된다: 디스플레이 타입 0.6–0.85×(48→32,
36→27), 본문은 동일 유지 + ≥ 16px; 섹션 패딩은 같은 스케일에서 1–2토큰 강하(96→64, 48→32);
≤ 16px 마이크로 스페이싱 불변. 단일 배율 비례 스케일(순수 em/vw) 금지; clamp() 유동
디스플레이는 줌 보존용 rem 항 필수.
**적용**: ~640px 미디어쿼리 하나로 h1–h3 크기와 큰 섹션 패딩만 조정, 결과값도 스케일 멤버;
shot 양쪽 너비에서 확인: 모바일 헤드라인은 눈에 띄게 작고 본문은 동일.
(출처: GOV.UK, Carbon, Refactoring UI, spark-joy)

## 위계

### HI1 weight-and-ink-before-size [LLM]

콘텐츠 블록 안의 위계는 크기 인플레가 아니라 웨이트와 잉크 티어로: 웨이트 ≤ 3개
({400,500,600,700}에서); 400 미만은 28px+ 디스플레이에 컨셉 시트 선택일 때만. 서브헤드는
본문 크기 + 1–2웨이트로 가능; 같은 레벨 제목은 한 웨이트 공유; 제목 레벨 ≤ 3, 건너뛰기 금지.
**본문/인라인 강조**에서 굵게+진하게+크게 동시 적층 금지(제목은 면제) — 이웃을 *덜* 강조하는
방식으로 강조한다. 600+ 웨이트 런은 짧은 구 이내; 볼드는 본문의 5% 미만.
(출처: Refactoring UI, Carbon, Polaris)

### HI2 one-winner-per-level [LLM]

모든 레벨에서 승자는 하나: 첫 화면에 지배 요소 정확히 1개(위계 벡터 ≥ 2개로 표시), 가시 타입
레벨 ≤ 3. 뷰당 솔리드 강조 채움 버튼 **정확히 1개**; 보조 액션은 아웃라인/고스트/텍스트;
파괴적 액션은 절대 1차 아님; 1차 버튼은 페이지 끝에 1회 재등장 가능. 1차 레이블은 실제 행동을
명명하는 동사+목적어; 랜딩/상세 1차로 금지: OK, Submit, Get started, Learn more, Click here
('Continue/계속'은 멀티스텝 플로우 안에서는 합법 — GOV.UK 정본). 시그니처 무브는 **최대 1개**,
컨셉 시트의 최강 차별점에서 선택; 나머지 섹션은 조용한 베이스라인을 지킨다. 히트 영역 ≥ 44px.
— 단, 컨셉 시트가 의도를 명시하면 시그니처 무브 수 초과 합법(advisory 경고만).
(출처: GOV.UK, Polaris, 시니어 랜딩 테어다운, 제안서 리서치)

## 콘텐츠·카피

### CN1 descriptive-headings-fact-per-section [LLM]

제목은 포부가 아니라 내용을 명명한다('Pricing', '당신의 스택과 호환') — 리트머스: h2/h3 체인만
읽어도 페이지가 무엇을 제공하는지 전달돼야 한다. h1은 편익 주도 ≤ 10단어, 최강 동결 클레임을
사용자 결과로 표현. **모든 섹션은 동결 클레임에서 그대로 가져온 반증 가능한 구체 1개 이상**
(숫자, 명명된 플랫폼/연동, 명시된 한계) — 구체가 0개인 섹션은 패딩하지 말고 삭제. T2 어휘 너머
금지 패턴: 'Unlock/Supercharge/Elevate your X', 'next level', 'Say goodbye to',
'Introducing the future of'. 진짜 제약 1개의 명시는 신뢰를 더한다.
**적용**: 빌드 후 제목 텍스트만 추출해 오퍼 요약이 되는지 확인. 동결 클레임은 어떤 화면에서도
숨김 상태(display:none, 접힌 details)로 두지 않는다.
(출처: refero, spark-joy, GOV.UK)

### CN2 opening-discipline [LLM, 장르 게이트]

**제안서/문서 장르**: 캡션 → h1 → 단일 리드 문단으로 연다(캡션 < 0.55× h1·레귤러·그레이 시프트;
리드 ~1.25× 본문, 동결 클레임으로 오퍼 요약). **랜딩/상세 장르**: 이 형태는 요구사항이 아니다 —
오프닝은 인터뷰 structure 답변에서 도출(L4)하고 상한만 적용: 페이지 전체에서 본문 최빈 크기의
1.15–1.4× 문단 최대 1개(있다면 첫 h2 앞), h1 위 캡션은 < 0.55× h1 + 그레이.
(출처: refero, Minto, 제안서 리서치)

## 이미지

### IM1 imagery-discipline [LLM]

①사진 위 텍스트는 명명된 대비 수단 필수(다크 오버레이 30–60%, 솔리드 박스, 블러 영역, 하단 스크림)
— 헤드라인은 최암부 대비 4.5:1. ②제품 스크린샷은 패널 크롬 안에: 1px 헤어라인, radius는 페이지의
radius 위계에서 가져옴(**radius는 S5 소유 — 고정 12–16px 금지**), 미묘한 그림자 레시피 ≤ 1,
원본 너비 75% 이상으로 표시. ③아이콘은 원본 16–24px 근방, 고유 크기의 1.5× 초과 확대 금지;
동일 hue 틴트 컨테이너(40–56px)는 무게를 주는 *합법 수단 중 하나*지 필수 처리가 아니다(필수화하면
SaaS 템플릿 룩 재생산).
(출처: Refactoring UI, Polaris, 시니어 랜딩 테어다운)

## 디테일·크래프트

### DE1 shadow-physics-budget [기계·정적]

box-shadow 시그니처는 페이지 전체 3개 이하, 고도 사다리에 매핑(놓인 카드 < 떠 있는 단 하나의
요소). 소프트 섀도는 물리를 따른다: y ≥ 0, x ≈ 0, blur ≈ 오프셋의 1.5–3×, 중립/잉크 틴트 색
(r≈g≈b), alpha ≤ 0.25–0.3, 이상적으로 2부 구성(타이트 콘택트 + 소프트 앰비언트); inset은
웰/인풋 전용. 단 하나의 공인 예외: 블러 0 하드 오프셋 시그니처 1개(예: `6px 6px 0 var(--ink)`,
브루탈리스트/경쾌 톤). C4(균일 살포 금지)를 보완 — 이 원칙은 *합법 그림자의 정의*다.
**적용**: `--shadow-1/--shadow-2` 토큰 정의; 카드는 shadow-1 또는 헤어라인; 진짜 떠 있는
요소만 shadow-2; 그 외 그림자 없음.
(출처: spark-joy, Refactoring UI, Polaris, Material 고도 사다리)

### DE2 tabular-figures-for-claims [LLM]

숫자를 싣는 테이블 칼럼, 스펙/가격 행 세트, 3개 이상의 형제 스탯 요소는
`font-variant-numeric: tabular-nums` + 숫자 셀 우측 정렬. **동결 클레임(가격·백분율·수량)이
정확히 이 자리에 떨어지고, 그대로의 숫자가 tabular figure로 렌더된다** — 클레임 대조 레인이
이 숫자를 읽는다. 모노스페이스로 정렬을 흉내 내지 않는다(모노는 TY4의 단일 선언 역할만).
(출처: Polaris, Stripe tnum 시그니처, GOV.UK, ant-design #11567)

### DE3 quality-floor-and-real-characters [기계·정적 (4개 fail 암 + warn 채널) + 기계·시각 (대비)]

배송 바닥선: 가시적 :focus-visible(≥ 2px 아웃라인+오프셋 또는 GOV.UK급 bg+보더) — 대체 없는
outline:none 금지; 애니메이션/트랜지션은 `@media (prefers-reduced-motion: no-preference)` 래핑;
`transition: all` 금지; img는 width+height 보유(CLS 방지); user-scalable=no 금지; 대비 본문
4.5:1 / 큰 텍스트·UI 3:1; 본문 내 링크는 밑줄(색만으로 구분 금지; nav/header 면제); 강조색을
::selection / accent-color / ::marker까지 연장. **진짜 활자 문자**: 굽은 따옴표 " " ' ',
어포스트로피 ', em 대시 —(-- 아님), 말줄임 …(... 아님) — code/pre 밖에서 (warn 레벨).
**적용**: 마감 패스 1회 — 포커스 블록, reduced-motion 래퍼, img 치수, 강조 디테일 5줄
(::selection, accent-color, :focus-visible, ::marker, scrollbar-color), 직선 따옴표 청소. `audit --visual`은 단색 배경 위 텍스트 대비를 렌더 시점에 계산하고, 이미지·그라데이션·반투명/미지원 색은 실패가 아니라 skip 카운트로 보고한다.
(출처: refero, GOV.UK, spark-joy, Butterick, open-design)

## 모션·인터랙션 (MO)

정적 완벽함도 AI 티다 — 사람이 만든 페이지는 누르면 반응하고 스크롤하면 살아 움직인다. 모션은 *장식*이 아니라 상태·연속성·방향을 전달하는 수단이다. 이 군의 전제: **CSS-first**(무JS) — 그래야 산출물이 단일 HTML 불변, 신규 의존성 0, inert preview 호환을 동시에 지킨다. cap-not-quota: 모션도 상한이지 처방이 아니다(모션 quota·고정 transition 디폴트·매 페이지 동일 시그니처 모션은 새 텔).

### MO1 purposeful-motion-only [LLM + 빌드, 부분 기계·정적 후보]

모션은 **방향·피드백·진행·상태변화**를 전달할 때만 존재한다. 합법: hover/focus 어포던스, 섹션당 ≤1회 절제된 scroll-reveal, disclosure(`<details>`)·accordion, 스티키 nav 축소, image-comparison, 읽기 진행 바. 장식 모션은 텔(`design-tells.md` M1~M4): 배경 aurora/sparkle/shader/그라데이션 애니메이션, 무의미 패럴랙스, 타자기 루프, 자동재생 캐러셀/마퀴. cap: **시그니처 모션 최대 1개**(반드시 N개 quota 금지 — 매 페이지 동일 모션은 그 자체로 지문).
**적용**: 모션 하나를 넣기 전 "이게 어떤 상태 변화를 알리는가"에 답한다. 답이 "예뻐서"면 빼라. 컨셉 시트의 `motion-role`이 잠근 역할 밖 모션 금지.
(출처: 60fps.design 모션 분류, 21st.dev 상호작용 패턴(장식 배경류는 기각), Anthropic frontend-design 플러그인, Polaris motion, exp-skillshop-mo 실증)

### MO2 motion-physics [부분 기계 + LLM]

transform·opacity 위주(width/height/top/left 등 **layout 트리거 애니메이션 금지** — 리플로우·저프레임), duration 120–400ms, ease-out 계열(linear는 연속 회전 등 등속에만), 60fps 목표. **reduced-motion 가드와 `transition: all` 금지는 DE3가 소유 → 재기술 금지, 교차참조만.** MO2의 LLM 암 = duration·easing 취향 판단.
**적용**: 모든 `@keyframes`/`transition`/`animation`을 `@media (prefers-reduced-motion: no-preference)` 안에 둔다(DE3). transition 속성은 명시 나열(`transition: color .18s, box-shadow .22s`), `all` 금지.
(출처: Material 모션 듀레이션, Polaris, WCAG 2.1 prefers-reduced-motion, RUI)

### MO3 affordance [부분 기계 + LLM]

인터랙티브 요소는 **hover + focus-visible + active** 상태를 동반한다(색만 바뀌지 말고 가시 변화 1개 이상), 포인터 커서, 히트영역 ≥44px(**HI2 소유 → 교차참조만**), **hover-only 노출 금지**(터치 기기엔 hover가 없다 — 정보·동작을 hover 뒤에 숨기지 않는다). focus-visible 가시성(대체 없는 `outline:none` 금지)은 **DE3 소유 → 교차참조만**. LLM 암 = active 피드백 적절성.
**적용**: 링크·버튼·요약(summary)·카드에 hover와 :focus-visible를 같은 규칙군에서 정의. 호버에만 나타나는 메뉴/버튼 금지(포커스·탭으로도 도달 가능해야).
(출처: GOV.UK 포커스·터치 타깃, Polaris interactive states, WCAG 2.5.5 타깃 크기)

### MO4 css-first-inert-safe [빌드 + LLM]

모든 인터랙션은 **무JS**로 구현한다: `transition`/`@keyframes`/`animation-timeline: scroll()·view()`/`:target`/`<details>`/`:focus-visible`/`position: sticky`/`scroll-behavior: smooth`. JS 0으로도 본문 가독·전환(CTA) 도달이 보장돼야 한다(프로그레시브 인핸스). scroll-driven은 `@supports (animation-timeline: scroll())`로 게이트하고 미지원 시 정적 가시로 무해 degrade. 산출물 단일 HTML·신규 런타임 의존성 0 불변. (메모: preview는 스크립트를 제거하므로 무JS 모션만 검수 화면에 살아남는다 — CSS-first가 곧 검수 가능성이다. 단 `audit --visual`은 inert preview가 아니라 원본 HTML을 렌더한다.)
**적용**: 스크립트 없이 빌드. JS가 필요하다고 느끼면 거의 항상 CSS 셀렉터(`:target`/`:has`/`<details>`)나 scroll-driven으로 대체 가능하다.
(출처: open web platform CSS scroll-driven animations, exp-skillshop-mo 실증, patina inert preview)

**MO 이중채점 매트릭스 (코드 대조):** reduced-motion·`transition:all`·focus-visible outline → **DE3 소유**(checkQualityFloor arm); 히트영역 44px → **HI2 소유**(LLM, 기계 arm 없음). 단 **reduced-motion 자체는 현행 기계 arm이 없다**(DE3 산문만) — 모션 미가드를 기계로 잡는다면 그것이 reduced-motion 최초의 기계 승격이다(M2 픽스처+baseline 게이트 필요). MO 신규 검사는 위와 단일 계기(교차참조)로만 묶고 combineAudits에 신규/중복 denominator를 추가하지 않는다.

## 시각 임팩트

가시성·임팩트 부족도 "AI 슬롭"의 한 얼굴이다 — 위계가 평평하면 첫 화면이 무엇을 주는지 0.05초 안에 전달되지 않는다. 단 이 절은 상한이 아니라 *권장 헤드룸*이며, 기존 TY1/HI2 캡을 깨면 안 된다.

- **첫 viewport 위계**: 첫 화면에 지배 요소 정확히 1개(**HI2 one-winner와 단일 계기 — 재채점 금지**). h1·1차 CTA·브랜드 신호가 스크롤 전에 분명해야 한다.
- **대비 헤드룸**: DE3 4.5:1은 *가독 바닥선*이다. 위계 표현에는 그 위의 헤드룸(더 진한 잉크 티어, 더 큰 명도 대비)을 의도적으로 쓴다 — 바닥선에 턱걸이하지 말 것.
- **타입스케일 드라마**: 디스플레이↔본문 비율을 극적으로(예: 본문 17px에 디스플레이 48–56px). 단 **TY1(가시 크기 ≤6, 하드캡 7) 위반 금지** — 드라마는 *새 크기 추가*가 아니라 스케일 양 끝 + 웨이트·잉크 농도(HI1 weight-before-size)로 낸다. 고정 비율 메뉴 금지(cap-not-quota).
- **자가호스팅 폰트**: 성격 있는 `@font-face`(woff2)로 시스템 산스에서 탈출한다 — 폴백 체인은 TY4를 따르고, 파일은 `assets/fonts/`에 자가호스팅(`core/asset-library.md` 참조). 원격 CDN 폰트 의존은 webfont ① WARN.
- **실제 이미지·텍스처**: 실사 사진·종이·노이즈·재질 텍스처를 배경 밴드나 인셋으로 쓴다. S4 stock 일러스트·무의미 3D 블롭은 여전히 금지. 이미지는 `assets/` 자가호스팅, 외부 CDN 비권장.
- **인라인 SVG 다이어그램**: 의미 있는 흐름도·관계도·수치 도식은 인라인 SVG로 삽입한다. 장식용 SVG 낙서·undraw 아이콘 월은 S4에 해당 — 금지. 단 노드+연결선만으로 '시스템/플로우/네트워크'를 그린 범용 다이어그램(칸반·박스 위 선 덧그림, 지하철 노선도식 박스-선 포함)은 **S6 AI 다이어그램 클리셰** — 실제 위계·손맛·수치가 없으면 표·타이포로 대체한다.
- **리치 모션**: scroll-driven reveal·SVG path animation(stroke-dashoffset)·sticky 섹션 등 목적 있는 CSS-first 모션을 적극 활용한다. MO1 목적성 필수·`@media (prefers-reduced-motion: no-preference)` 래핑 필수(DE3/MO2 교차참조). 신규 JS 의존 0(MO4).
- **2색+ 역할 분리 강조**: CO1의 "단일 강조 기본값"은 기본값이다 — 컨셉 시트가 역할을 명시(예: 1차 CTA는 brand-blue, 경고 콜아웃은 amber)하면 다색 강조 합법(advisory 경고만). 역할 없이 추가되는 색은 여전히 금지.
- **count-up 애니메이션**: 동결 클레임의 최종값만 렌더링하고 중간 프레임 숫자는 `aria-hidden="true"` 처리 — 접근성 트리에 틀린 숫자가 노출되면 Phase 5 클레임 대조 실패.
**적용**: Phase 4 shot 자기검수에서 첫 viewport만 따로 본다 — 지배 요소 1개·CTA 가시·대비 충분·타입 대비 극적인지.
(출처: Lindgaard 2006(50ms 첫인상), Kurosu&Kashimura 1995·Tractinsky 2000(미적-사용성), Lavie&Tractinsky 2004(classical/expressive 미학), Cyr 2010(컬러 어필 문화 의존) — 전부 방향 근거, 전환율 직접 주장 금지)

### 실측 근거: 사람 디자이너 before/after

같은 콘텐츠(스킬샵 크리에이터 제안서)의 "AI 티 나는 원본" vs "디자이너 리디자인"을 대조한 실측(`examples/제안서.pdf` 9p vs `examples/제안서_리디자인.pdf` 14p, 페이지 PNG: `examples/pdf-pages/`). 디자이너의 승리는 *텔을 뺀 것*이 아니라 **세 가지를 더한 것**에서 나왔다 — 빼기 철학으로는 못 만드는 차이다:

- **(a) 진짜 에셋을 구해 쓴다.** 원본: undraw류 플랫 벡터·아이콘 틴트박스·스톡 차트(= S4 텔). 리디자인: 실제 브랜드 로고(Claude/OpenAI/Gemini)·실제 스크린샷(X/레딧 스레드·repo)·크리에이터 실사진·실 매출표. → 만든 자산이 아니라 *구해온* 자산. `assets/`·`refs/`에서 조립(asset-library).
- **(b) 극성·대비·비대칭으로 작곡한다.** 원본: 전 슬라이드 같은 라이트 톤 + 같은 카드 그리드 템플릿(L1/L3/S3). 리디자인: 다크 캔버스 기본 + 슬라이드별 다크↔라이트 패널 교차, 좌사진/우데이터 분할, 극단 비대칭(거대 워드마크 좌 + 작은 CTA 우). 강조색은 *고대비 바탕 위에 점으로* 찍어 더 강하다(저대비 바탕 위 남발 < 고대비 위 절제).
- **(c) 매 화면에 초점 하나를 세운다.** 원본: 등가 카드 다수 → 눈이 어디 둘지 모름. 리디자인: 슬라이드당 지배 요소 1개(₩2,000만 / 거대 Join / "이거 어떻게").

레인: (a)는 asset-library + 빌드 조립, (b)·(c)는 빌드 규율 + Phase4 shot 자기검수(HI2 one-winner 교차참조). audit은 (a)의 S4·(c)의 약한 위계 일부만 잡고, *평평한 톤·소심한 타입스케일·맞춤구성 부재*는 음성 검사로 못 만든다 — 빼기 철학의 천장. (출처: 제안서 before/after 실측 2026-06-14)

## 제안서 장르 (PR) — `--page proposal`

제안서는 랜딩이 아니라 **문서**다. 장르 플래그가 규칙을 바꾼다: 인쇄물 질감(밝은 캔버스, 그라데이션
·일러스트·히어로 공식 0), 꾸준한 문서 리듬이 *합법*(L3 검사는 장르 게이트로 꺼짐), 밀도 변화는
패딩이 아니라 빽빽한 테이블 vs 산문에서 나온다.

### PR1 proposal-spine-single-approval [LLM (정적 승격 백로그: 장르 플래그 필요)]

6–8개 톱레벨 섹션, 정본 순서: 수신 표지 헤더 → 요약 → 문제 → 접근(단계 타임라인 + 리스크 블록)
→ 증거 → 가격 → 다음 단계. 표지 = 수신처 헤더: prepared-for(**클라이언트명이 벤더명 이상 크기**),
prepared-by, 날짜, 버전, 유효기한 — 배경 이미지 0, 타입 주도. 요약은 100–500단어(~분량의 10%),
결론 우선(Minto: 문제 → 권고 → 정량 결과 → 요청), 첫 화면에서 스크롤 없이 완독. **가격은 DOM
순서상 문제·접근 뒤에만 등장.** 전환은 정확히 하나: 마지막 다음-단계 섹션이 유일한 CTA(mailto/
캘린더/서명란 + 실명 담당자 + 날짜 박힌 누가-무엇을-언제); 버튼류 페이지 전체 ≤ 2. 내비게이션은
인페이지 앵커의 번호 목차(평가자는 루브릭 순서로 읽는다). h2는 6–16단어 단언문 — 체인만 읽어도
논증 전체가 나온다.
**적용**: `<section id="summary|problem|approach|evidence|pricing|next-steps">` 순서 방출;
CSS 카운터 h2 번호; `<nav><ol>` # 앵커; 유효기한을 가격 옆에 반복; 마지막 섹션 전 버튼 0.
(출처: Proposify 7섹션 분석, Formlio 가격-후-가치, Minto, GOV.UK)

### PR2 evidence-and-pricing-discipline [LLM]

접근+증거 ≥ 본문의 50%, 회사 소개 ≤ 15%. 문제·접근 섹션에서 클라이언트 호칭 수 ≥ 벤더 호칭 수;
문제는 클라이언트 자신의 표현으로 연다. 증거는 동일 필드 행(프로젝트, 기간, 규모, 정량 결과 1개)
≤ 3건; **모든 숫자는 동결 클레임으로 소급 가능** — 클레임이 공급하는 만큼만 노출(목표 5개+는
클레임이 공급할 때만; 패딩 금지, 모자라면 섹션이 줄거나 사라진다 — S1/S2 준수). 가격: 시맨틱
테이블, 옵션 ≤ 3 프리미엄 앵커 우선 + 권장 옵션은 정확히 한 수단으로 강조, 라인 아이템 ≤ 9,
라운드 숫자(9,900/.99 금지), 범위 외 목록 하단 명시. 통화/백분율 셀은 우측 정렬 tabular-nums
(DE2 — 클레임 대조 레인이 읽는다). 동결 클레임은 절대 숨김 상태로 두지 않는다.
(출처: 제안서 리서치(Proposify/Formlio/adall), Minto, GOV.UK summary-list)

### 제안서 인터뷰 보정

conversion이 사전 해결(승인 또는 다음 미팅)되므로 그 차원은 **평가자 타게팅**으로 전환된다:

- **audience** = 누가 어떤 루브릭으로 채점하는가 ("평가기준표/배점표가 있나요?") — RFP가 있으면
  루브릭 가중치는 소스 선반영 확인으로 처리, 섹션 분량 예산이 배점을 따른다(배점 10점당 ~1.5–2쪽)
- **structure** = 첫 화면 우선순위가 아니라 평가자가 가장 박하게 채점하는 섹션
- **reference** = 이 관계에서 과거에 이기고 진 제안서
- **mood** = 권위↔친근 트레이드오프를 문서 질감으로 매핑
- **brand** = 클라이언트의 존재감이 벤더보다 우선한다
- **인테이크 추가 동결**: 가격·수량과 함께 클라이언트명(호칭 우세·수신 헤더 검사의 기준),
  클라이언트 자신의 문제 표현, 유효기한/마감일

## 충돌 해소 기록

소스 간 충돌과 해소 — 원칙의 경계를 정한 결정들이라 기록한다:

1. **모션 문법**: Anthropic 플러그인(서프라이즈 호버·스태거 리빌) vs Polaris(호버 스케일 금지·
   press-darkens 물리). → **MO 군으로 승격**(MO1~MO4): 톤별 모션 처방은 여전히 기각하되, 모션을 *목적 단위*(MO1)·*물리*(MO2)·*어포던스*(MO3)·*CSS-first*(MO4)로 양성 규율화한다. prefers-reduced-motion 가드는 DE3 단독 소유 유지(MO2 교차참조). reference-gallery 플랜 5절(motion-role/motion-budget/reduced-motion-fallback)은 MO + 컨셉 시트 `motion-role`로 흡수됨 — M7.1에서 재추가 금지(병행 컨벤션 표류 차단).
2. **라이트/다크 디폴트**: 플러그인(세대마다 극성 변주) vs refero(다크 디폴트 = AI 지문).
   → 어느 쪽도 디폴트 아님 — 극성은 컨셉 시트에서 명시적으로 잠근다.
3. **그림자 철학**: 드라마틱(플러그인) vs 헤어라인 전용(Polaris) vs 2부 소프트(RUI). → 공유
   물리 불변식만 채택(DE1), 블러 0 하드 오프셋은 알파 캡 면제로 브루탈리스트 합법 유지.
4. **스페이싱 격자**: GOV.UK 5px vs 나머지 4/8px. → 하드코딩 제수가 아니라 *선언된 단일
   스케일 멤버십*으로 검사(SP1).
5. **본문 행간**: Butterick 1.2–1.45 vs RUI 계열 1.5–1.75 vs 한글 1.6–1.9. → 문자 체계
   의존 밴드로 해소: 라틴 [1.4,1.6] 빌드 타깃, 한글 [1.6,1.8].
6. **본문 크기**: Polaris 13–14px(밀집 제품 UI) vs 16px 바닥. → 이 제품의 장르(랜딩/상세/
   제안서 문서)에는 16px 바닥 유지.
7. **레이블**: RUI 레이블리스 데이터 vs GOV.UK summary-list. → 장르 분할: 서사 산문은 레이블을
   문장에 녹이고, 스펙/가격/증거 존은 3티어 잉크 레이블 행 사용. 레이블리스 기각.
8. **히어로 형태**: refero 4부 공식 vs L4 반공식. → L4 승리 — 공식 기각, 동결 클레임 증명선만
   CN1에 보존, 히어로 구조는 인터뷰 도출 유지.
9. **보더**: Linear/Stripe 헤어라인 크래프트 vs RUI 보더 최후. → 순서 사다리로 해소(CO3),
   데이터 행은 항상 보더 합법. 금지 대상은 "전부 윤곽선" 룩이지 헤어라인 자체가 아니다.
10. **폰트 거부 목록**: 플러그인(Inter/Roboto/system-ui 1차 금지) vs spark-joy·modern-font-stacks
    (시스템 스택 지지). → 하드 거부 목록 기각: 패밀리는 톤 근거 있는 *명명된 선택* + 풀 폴백
    체인이면 합법, 무심한 디폴트만 금지(TY4).
11. **텔 중복 단속**: 텔 처방의 단순 재진술(단일 강조=C3, 부유 그림자 1개=C4, 밀도 변주=L3,
    비대칭 1곳=S3, 중첩 radius=S5)은 기각하거나 정량·메커니즘을 *추가*하는 경우만 채택.
    SP3/L3, LA2/S3 쌍은 단일 레인 선언(양성 빌드 규칙 + 음성 기계/LLM 검사가 한 계기 공유).

## 알려진 공백 (백로그)

- **대비 기계 검사 범위 제한**: DE3 렌더 대비는 단색 배경 위 텍스트만 판정한다. 이미지·그라데이션·반투명 합성 배경은 skip 보고에 남기며, 실효 합성 대비 계산은 후속 후보.
- **img alt 정적 검사**: DE3는 width/height만 본다. alt 존재(장식은 alt="") 검사 추가 여지.
- **다크 극성 수치 부재**: CO2(near-black on near-white)·CO3(틴트 표면 사다리)·DE1(그림자
  가시성)은 라이트 우선으로 기술됨 — 다크 캔버스 컨셉에는 적용 가능한 잉크 램프/표면 수치가 없다.
- **승격 대기 기계 후보** (비평 통과, 구현 유예): HI2(뷰포트 윈도우 CTA 카운트), LA3(1440/375
  듀얼 렌더), PR1(장르 플래그 전제 정적 DOM 검사), CO1 arm b(원형 hue 클러스터링). TY5는
  A(어절 중간 줄바꿈 기계·시각 fail)·B/C(폴백 스택·가짜 이탤릭 기계·정적 WARN) 승격 완료,
  D/E(자간·행간)만 LLM 잔류. 기각: L3(우회 취약), TY3(line-height:normal 함정), DE2(상속
  속성 — 정적 레인 부적합, 시각 레인 재설계 필요).
- **반응형 테이블**: PR1/PR2가 테이블 중심 제안서를 요구하나 모바일 테이블 변환 규칙 미정 —
  GOV.UK 반응형 테이블 패턴 참조.
- **MO 기계 승격 후보** (M8.2 게이트, 파서 전제): reduced-motion 미가드 모션 정적검사(b1, WARN
  레인 — reduced-motion 최초 기계 승격이라 M2 픽스처+baseline 게이트 필요)와 MO1 장식 애니메이션
  검사(@keyframes가 background/filter/gradient 무한반복)는 **둘 다 at-rule/@keyframes 중첩
  보존 파서 신설이 선결**이다(현 extractCssRules는 단일레벨이라 @media 가드 안/밖 구분 불가). 파서가
  적대 심사를 통과한 뒤에만 b1을 WARN 승격하고 그 전까지 MO는 빌드+LLM 레인 잔류. hover-only
  어포던스(b3)는 decoy :focus-visible 우회를 닫기 전까지 LLM 잔류.
