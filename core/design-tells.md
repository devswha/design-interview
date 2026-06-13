# AI 디자인 텔 (design tells)

patina의 패턴 팩에 해당하는 시각 도메인 금지 목록. 빌드(Phase 3) 중 생성 규율로,
감사(Phase 5)에서 체크리스트로 쓴다. 각 항목은 `id / 신호 / 대체` 구조.

## 레이아웃

- `L1 uniform-card-grid` — 3열 균일 카드 그리드 + 아이콘 + 제목 + 두 줄 설명 반복. → 항목 중요도에 따라 크기·배치를 차등하라. 하나는 크게, 나머지는 목록으로.
- `L2 center-everything` — 모든 섹션이 가운데 정렬 단일 컬럼. → 본문 섹션 최소 1곳은 좌정렬 또는 비대칭 2컬럼.
- `L3 section-rhythm` — 모든 섹션이 동일 패딩·동일 구조(제목/부제/본문)로 반복되는 균일 리듬. → 섹션마다 밀도를 다르게. 좁은 섹션 하나가 리듬을 살린다.
- `L4 hero-formula` — 거대 제목 + 부제 + CTA 버튼 2개 + 우측 일러스트 공식. → 첫 화면은 컨셉 시트의 structure 답변에서 도출하라. 공식 금지.

## 색·질감

- `C1 purple-gradient` — 보라→파랑 그라데이션 배경, 특히 히어로. 가장 악명 높은 텔. → 컨셉 팔레트의 단색 또는 절제된 동일 계열 톤.
- `C2 glassmorphism-default` — 이유 없는 반투명 블러 카드. → 표면 구분은 1px 보더나 배경 명도차로.
- `C3 rainbow-feature-icons` — 기능마다 다른 색 아이콘 배경. → 단일 강조색 원칙.
- `C4 soft-shadow-everywhere` — 모든 요소에 동일한 box-shadow. → 그림자는 떠 있어야 할 요소 한 종류에만.
- `C5 left-accent-card` — 라운드 사각 컨테이너 + 좌측 솔리드 강조색 스트라이프의 반복 (AI "accent card" 디폴트, slides-grab 디자인 레퍼런스에서 확인된 텔). → 강조는 CO3 분리 사다리로 — 한 곳의 의도된 콜아웃은 합법, 반복 패턴화가 텔이다.

## 타이포·카피

- `T1 emoji-bullets` — ✨🚀💡 불릿. 즉시 실격. → 불릿 자체를 줄이고 산문이나 번호로.
- `T2 hype-adjectives` — "혁신적인", "완벽한", "강력한", "seamless", "effortless". → 클레임의 구체 수치·동작으로 대체. patina lexicon과 동일 원칙.
- `T3 title-case-headings` — 영문 제목의 기계적 Title Case. → sentence case.
- `T4 symmetric-heading-pairs` — "Simple. Powerful. Fast." 류 3연속 단문 패턴. → 한 문장으로 풀어 쓰거나 하나만 남긴다.
- `T5 faq-padding` — 아무도 안 물어본 질문으로 채운 FAQ 섹션. → 실제 구매 저항 지점만. 없으면 섹션 삭제.

## 구조·디테일

- `S1 testimonial-fabrication` — 출처 없는 후기 카드. 신뢰 사기이자 강한 AI 텔. → 실제 후기가 없으면 섹션을 만들지 않는다.
- `S2 logo-wall-placeholder` — "trusted by" 가짜 로고 월. → 동일.
- `S3 perfect-symmetry` — 모든 여백·크기가 수학적으로 균일. → 의도적 비대칭 최소 1곳 (SKILL.md Phase 3 규칙).
- `S4 stock-illustration` — undraw류 일러스트, 의미 없는 3D 블롭. → 실제 제품 스크린샷, 없으면 타이포그래피로 해결.
- `S5 border-radius-uniform` — 전 요소 동일 radius (특히 12–16px). → 요소 위계별로 다르게, 또는 0.

## 감사 사용법

두 레인으로 나뉜다. 양성 원칙(`design-principles.md`)의 기계 검사도 같은 감사기에 합류한다:

- **기계 레인 (정적)** (`node src/cli.js audit <built.html>`): C1, T1, T2, T4, S5는 `src/audit.js`가 HTML/CSS 파싱으로 판정한다. 원칙 검사 TY4·CO1·DE1·DE3 정적 품질 바닥선도 이 레인.
- **기계 레인 (시각)** (`--visual` 플래그, requires puppeteer): L1, **L2**, S3는 `src/geometry.js`가 렌더된 박스 좌표·계산 스타일로 판정한다. 원칙 검사 TY1·TY2·DE3 렌더 대비도 이 레인. DE3는 정적 암과 시각 암을 같은 ID로 병합해 한 번만 채점한다.
  - L2는 섹션별 판정(단일 컬럼 기하 AND (기하 중앙 OR 텍스트 중앙 다수), 전 섹션이 100% 해당일 때만 fail), S3는 페이지 전체 text-align 비율 — 서로 다른 입력에서 발화한다 (양방향 분리 증명 픽스처: `tests/redteam/`).
- **LLM 레인**: 의미 판단이 필요한 나머지(L3, L4, C5, S1/S2/S4, T3, T5)는 Phase 5에서 체크리스트로 점검한다.
  - L3는 기계 승격이 적대 심사에서 기각됨(보수적 기준조차 패딩 6px 넛지 하나로 우회 가능). LLM 레인 잔류, SP3(design-principles)와 단일 계기.

기계 레인이 커버하는 텔은 LLM이 자기 채점하지 않는다 (이중 채점 금지).

fail 1개라도 있으면 납품 불가 — Phase 3 수정 후 재감사.
컨셉 시트의 "하지 않을 것" 목록에 오른 항목은 Phase 4 프리뷰마다 우선 점검한다.
