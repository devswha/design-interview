# 레퍼런스 갤러리 기반 기능 고도화 조사 및 플랜

작성일: 2026-06-14  
대상 레포: `design-interview`  
모드: `$ultraresearch-v2`  
학술 MCP: no configured academic MCP available

## 결론

현재 레포는 이미 "AI 디자인 텔을 피하고, 시니어 디자인 원칙을 적용하며, 결정론적 감사로 납품을 막는" 축이 강하다. 다음 고도화는 새 디자인 원칙을 더 늘리는 것보다, 사용자가 제공한 실제 운영 사이트 갤러리를 `--deep` 인터뷰, 컨셉 시트, 스크린샷 자기검수, 감사 코퍼스에 구조적으로 연결하는 `M7 reference intelligence`가 가장 적합하다.

핵심 산출물은 네 가지다.

1. `reference` 차원을 단순 URL 수집에서 "레퍼런스 브리프"로 승격한다.
2. URL/갤러리 입력을 안전하게 가져와 페이지 유형, 섹션, CTA, 내비게이션, 팔레트, 타입, 모션 단서를 추출하는 `reference-intake` 레인을 추가한다.
3. 컨셉 시트에 "빌릴 것 / 빌리지 않을 것 / 복제 방지"를 잠근다.
4. 레퍼런스에서 배운 패턴은 감사 픽스처와 벤치마크로 환원하고, 외부 사이트의 자산/문구/레이아웃을 복사하지 않는 라이선스 가드를 둔다.

## 현재 레포 진단

근거 파일:

- `README.md`: Phase 0 인테이크, Phase 1 디자인 인터뷰, Phase 2 컨셉 잠금, Phase 3 빌드, Phase 4 프리뷰, Phase 5 감사 흐름을 정의한다.
- `SKILL.md`: `--deep` 옵션에 "레퍼런스 수집 + 무드보드 라운드"가 있지만, 실제 레퍼런스 분석 산출물의 구조는 아직 얕다.
- `core/interview.md`: 6차원 중 `reference`는 "실제 URL/제품 1개 이상 + 좋았던 이유"로만 점수화된다.
- `templates/concept-sheet.md`: 레퍼런스는 인터뷰 요약 한 칸에만 들어가며, 토큰 커밋과 직접 연결되지 않는다.
- `core/design-tells.md`: AI 텔 금지 목록과 기계/LLM 레인 분리가 있다.
- `core/design-principles.md`: 2026-06-13 기준 10개 소스 리서치를 24개 원칙으로 통합했다.
- `ROADMAP.md`: M6 "시니어 디자이너 고도화"가 대부분 완료되어 있고, 남은 항목은 기계 검사 승격 후보와 코퍼스 확장이다.
- `src/intake.js`: 클레임 추출과 SSRF 가드가 있다. URL fetch 보안 모델은 레퍼런스 인테이크에도 재사용할 수 있다.
- `src/screenshot.js`, `src/geometry.js`: desktop/mobile 캡처와 시각 기하 검사 기반이 이미 있다.

현재 공백:

- 레퍼런스 URL을 안전하게 수집하고 요약하는 별도 CLI가 없다.
- 사이트별 "어떤 레퍼런스는 전체 사이트, 어떤 레퍼런스는 CTA, 어떤 레퍼런스는 모션"이라는 용도 구분이 없다.
- 사용자가 좋아한 레퍼런스가 타입/색/CTA/섹션 구조/모션 중 어떤 토큰 결정으로 이어졌는지 추적되지 않는다.
- 외부 레퍼런스의 문구, 이미지, 브랜드 자산을 복제하지 않도록 막는 절차가 아직 명문화되어 있지 않다.
- `--deep`이 레퍼런스가 없을 때 어떤 갤러리에서 무엇을 보라고 안내해야 하는지에 대한 큐레이션 맵이 없다.

## 사용자 제공 링크 원문

아래 링크 텍스트는 사용자가 준 형태를 그대로 보존한다.

| 분류 | 링크 |
|---|---|
| 전체 웹사이트 갤러리 | curated.design |
| 전체 웹사이트 갤러리 | godly.website |
| 전체 웹사이트 갤러리 | awwwards.com |
| 랜딩 & SaaS | landing.love |
| 랜딩 & SaaS | saaspo.com |
| 랜딩 & SaaS | onepagelove.com |
| UI 파츠 | navbar.gallery |
| UI 파츠 | cta.gallery |
| UI 파츠 | collectui.com |
| 모바일 & 모션 | mobbin.com |
| 모바일 & 모션 | 60fps.design |
| 컴포넌트 & 코드 | 21st.dev |
| 컴포넌트 & 코드 | component.gallery |
| 브랜딩 & 로고 | rebrand.gallery |
| 브랜딩 & 로고 | logofolio.com |
| 브랜딩 & 로고 | svgl.app |
| 컬러 & 폰트 | coolors.co |
| 컬러 & 폰트 | fontpair.co |
| 아이콘 & 리소스 | hugeicons.com |
| 아이콘 & 리소스 | dezignheroes.framer.website |

## 레퍼런스 사이트 조사 맵

숫자는 사이트가 공개 페이지에서 표기한 값이다. 2026-06-14 접근 기준이며, 독립 감사한 수치는 아니다.

| 링크 | 공개 근거 | 이 레포에서의 사용처 |
|---|---|---|
| curated.design | 현재 `craftwork.design/curated/websites/`로 리다이렉트된다. Websites, Sections, AI, Portfolio, Web3, Tech, Marketing, E-commerce, Finance, Web Apps 등 카테고리를 제공한다. | 전체 사이트와 섹션 단위 레퍼런스를 나눠 수집하는 모델에 맞다. `--deep`의 reference 질문에서 "전체 톤"과 "섹션 패턴"을 분리할 때 사용. |
| godly.website | "Astronomically good web design inspiration"을 내걸고 실제 웹사이트 목록을 제공한다. | 포트폴리오, AI, Web3, 에이전시 계열의 고감도 톤 샘플을 찾는 용도. 단, 평가 기준이 명시적이지 않아 원칙 근거가 아니라 무드보드 후보로만 사용. |
| awwwards.com | Site of the Day, Nominees, Winners, Collections, Directory, category/technology filters를 제공한다. 2026-06-14 Site of the Day와 점수도 노출된다. | 레퍼런스 품질 신호로 쓸 수 있다. "수상/후보/컬렉션/기술" 메타데이터를 reference brief에 넣어 신뢰 레벨을 분리. |
| landing.love | 검색 결과 기준 2,049개 animation website, full-page video recording, SaaS/AI/Portfolio/Dark Mode/Minimal 등 필터를 제공한다. | 정적 스크린샷만으로 놓치는 스크롤/히어로 모션 레퍼런스를 캡처. `motion-intent` 필드 후보. |
| saaspo.com | 3,037 pages, 716 sections, 378 OG images, 28 templates를 표기하고 Landing, Pricing, Product, About, Customers, Integrations, Book a demo 등 페이지/섹션 필터를 제공한다. | 랜딩/가격/제품 페이지의 구조 레퍼런스. `--page landing|detail` 추론과 섹션 스파인 추천에 적합. |
| onepagelove.com | Browse All 9,017, Landing Page 1,939, Digital Product 1,495, App 866, 스타일 필터 Illustrative, Scroll Effects, Minimal, Typographic 등을 표기한다. | 원페이지 캠페인/런칭 페이지의 정보 밀도와 스크롤 순서를 비교하는 레퍼런스. |
| navbar.gallery | Static/Sticky, Dropdown/Flyout, Mega Menu, Sidebar, Search Bar, Announcement Bar, Full Screen Menu, Breadcrumbs 유형을 설명한다. | `structure`와 `conversion` 차원에서 내비게이션 복잡도 선택지를 만들 수 있다. 단일 HTML 산출물의 nav 패턴 가드로 적합. |
| cta.gallery | Button, Call-to-Buy, Download, Form, Modal/Pop-up, Navigation, Newsletter, Pricing/Subscription 유형과 CTA 큐레이션을 제공한다. | `conversion` 차원을 "단 하나의 행동"으로 잠글 때 CTA 유형 후보를 제공. `HI2 one-winner-per-level` 검사의 보완 자료. |
| collectui.com | Daily UI inspiration, category/trending/designers 메뉴, weekly hand-picked interfaces를 표기한다. | 컴포넌트 단위의 빠른 무드보드. 원칙 근거보다 탐색 피드로 사용. |
| mobbin.com | 1,428 apps, 621,500+ screens, 323,900 flows, Screens/UI Elements/Flows/Text in Screenshots 탐색을 표기한다. | 모바일 및 웹 앱 플로우 레퍼런스. 현재 산출물은 단일 HTML 페이지지만, onboarding, settings, checkout, subscription 같은 흐름 어휘를 인터뷰 질문에 반영 가능. |
| 60fps.design | 1,970 shots, 464 apps, 75 app sites, Motion 25, Storyboards 50을 표기하고 3D, AI, Button, Card, Loading, Onboarding, Scroll, Swipe 등 필터를 제공한다. | 모션을 "많이 넣기"가 아니라 상태 변화의 목적 단위로 분류하는 데 유용. `prefers-reduced-motion` 가드와 함께 `motion-role` 필드로 제한. |
| 21st.dev | community components 페이지에서 Marketing Blocks와 UI Components를 나누고 Heroes, Features, Calls to Action, Buttons, Inputs, Tabs 등 카테고리별 개수를 표기한다. | 현재 레포는 단일 HTML 산출물이므로 코드를 직접 가져오기보다는 섹션/컴포넌트 분류 사전으로 사용. shadcn 기반 코드는 라이선스와 의존성 정책 확인 전 자동 도입 금지. |
| component.gallery | 60 components, 95 design systems, 2,671 examples를 표기하고 컴포넌트 정의, design systems, accessibility/code examples/tone of voice 같은 기능 메타를 제공한다. | 컴포넌트 의미와 접근성/사용 가이드를 대조하는 정본 레퍼런스. 새 audit 후보를 만들 때 "실제 디자인 시스템들이 같은 컴포넌트를 어떻게 다루는가"를 확인. |
| rebrand.gallery | 검색 결과 기준 rebrands, visual identities, design systems, identity launches, rebrand reveal videos를 큐레이션한다. | brand 차원의 레퍼런스. 색/로고만이 아니라 identity reveal 구조와 브랜드 벤토를 reference brief로 분리. |
| logofolio.com | "standout identities", "strong ideas and great execution"을 기준으로 로고 디자인을 큐레이션하고 Minimalist, Wordmark, Tech, Mascot, Lettermark 등 컬렉션을 제공한다. | 신규 로고 생성 도구가 아니라 브랜드 성격 분류 참고. 실제 로고 복제 금지. |
| svgl.app | 663 logos, API, shadcn/ui, Extensions, GitHub repository, AI/Design/Framework/Library/Software 등 카테고리를 표기한다. | tech logo reference와 라이트/다크 로고 처리 참고. 브랜드 로고 사용은 각 브랜드 권리와 SVGL 라이선스/출처 확인 후 수동 승인. |
| coolors.co | Palette Generator, Explore Palettes, Image Picker, Contrast Checker, Palette Visualizer, Tailwind Colors 등을 제공하고 10M+ palettes, 8M+ creative minds를 표기한다. | CO1/CO2 토큰 커밋을 보조. 특히 contrast checker 성격의 작업은 DE3 대비 검사의 UX 표면과 연결 가능. |
| fontpair.co | 검색 결과 기준 Google Fonts 기반 1,000+ curated combinations, content preview, favorites를 제공한다. | TY4 폰트 역할/성격 분류를 도와주는 후보. 단, 현재 `core/design-principles.md`는 무분별한 웹폰트 의존을 경고하므로 자동 로드보다 "분류 추천"으로 제한. |
| hugeicons.com | 54,000+ icons, React/React Native/Vue/Angular/Svelte/Flutter/WordPress/VS Code, SVG/npm/CDN/font 사용 경로, Stroke/Solid/Rounded/Sharp 등 스타일을 표기한다. | 아이콘 스타일 일관성 참고. 단일 HTML 산출물에서는 라이선스 확인 없이 외부 아이콘 import 금지. |
| dezignheroes.framer.website | 1,500+ design resources, AI tools, Motion & Animation, Fonts, UX tools, Inspirations, Backgrounds, Mockups, Color, Icons 등 카테고리를 표기한다. | 레퍼런스 탐색 허브. 품질 근거라기보다 후보 발굴 채널로 취급. |

## UX/학술 근거

이 레포의 고도화는 "예쁘게 만들자"가 아니라 "첫 화면과 시각 완성도가 사용성 판단과 신뢰 판단에 영향을 주므로, 인터뷰와 감사 레인을 더 정밀하게 만들자"는 방향이어야 한다.

| 논문/자료 | 등급 | 검증 상태 | 적용 의미 |
|---|---|---|---|
| Kurosu, M. and Kashimura, K. 1995. "Apparent usability vs. inherent usability: experimental analysis on the determinants of the apparent usability". CHI 1995 companion. DOI: `10.1145/223355.223680`. https://dl.acm.org/doi/10.1145/223355.223680 | Tier A, peer-reviewed conference companion | 메타데이터와 후속 인용 확인. 전문 재현은 하지 않음. | 시각 매력은 사용성 지각에 영향을 준다. Phase 4 첫 화면 자기검수가 장식이 아니라 제품 품질 게이트라는 근거. |
| Tractinsky, N., Katz, A. S. and Ikar, D. 2000. "What is beautiful is usable". Interacting with Computers 13(2), 127-145. DOI: `10.1016/S0953-5438(00)00031-X`. https://academic.oup.com/iwc/article-abstract/13/2/127/898608 | Tier A, journal article | 초록/메타데이터 확인. 전문 실험 재현 없음. | 사용 전후 모두 미적 지각과 지각된 사용성의 강한 상관이 보고됐다. 단, ATM 실험이므로 웹 랜딩에 직접 일반화하지 않는다. |
| Lavie, T. and Tractinsky, N. 2004. "Assessing dimensions of perceived visual aesthetics of web sites". International Journal of Human-Computer Studies 60(3), 269-298. DOI: `10.1016/j.ijhcs.2003.09.002`. https://www.ise.bgu.ac.il/faculty/noam/papers/04_tl_nt_ijhcs.pdf | Tier A, journal article with accessible PDF | PDF 접근 확인. 본문 일부 확인. | 웹사이트 미학을 classical aesthetics와 expressive aesthetics로 나누는 틀은 `mood` 질문을 "정돈/질서"와 "표현/새로움" 축으로 나누는 근거가 된다. |
| Lindgaard, G., Fernandes, G., Dudek, C. and Brown, J. 2006. "Attention web designers: You have 50 milliseconds to make a good first impression!" Behaviour & Information Technology 25(2), 115-126. DOI: `10.1080/01449290500330448`. https://www.tandfonline.com/doi/abs/10.1080/01449290500330448 | Tier A, journal article | DOI/초록 확인. 전문 재현 없음. | 첫 인상은 매우 빠르게 형성될 수 있다. 첫 viewport의 위계, CTA, 브랜드 신호를 별도 QA 대상으로 분리해야 한다. |
| Cyr, D., Head, M. and Larios, H. 2010. "Colour appeal in website design within and across cultures: A multi-method evaluation". International Journal of Human-Computer Studies 68(1), 1-21. DOI: `10.1016/j.ijhcs.2009.08.005`. https://dl.acm.org/doi/10.1016/j.ijhcs.2009.08.005 | Tier A, journal article | DOI/초록 확인. 전문 재현 없음. | 컬러 어필은 신뢰/만족에 영향을 주고 문화권 차이가 보고됐다. 팔레트 추천은 범용 정답이 아니라 audience/brand 맥락에 묶어야 한다. |

검증 메모:

- 위 논문들은 기능 구현의 직접 스펙이 아니라 방향 근거다.
- 실험 도메인, 표본, 시대가 다르므로 "이 색/이 레이아웃이 전환율을 올린다"는 식의 직접 주장은 하지 않는다.
- 본 레포에서는 논문 근거를 `reference` 질문, 첫 화면 QA, 팔레트/무드 토큰 커밋의 중요도 근거로만 사용한다.

## 제안 기능: M7 reference intelligence

### 1. 레퍼런스 소스 맵

새 문서 후보:

- `core/reference-sources.md`

내용:

- 사용자가 제공한 사이트 링크 원문
- source type: `whole-site`, `landing-saas`, `section`, `mobile-flow`, `motion`, `component`, `brand`, `color-font`, `asset`
- trust level: `award`, `curated`, `system-doc`, `marketplace`, `resource-hub`, `paper`
- use policy: `moodboard-only`, `pattern-extraction`, `component-definition`, `token-assist`, `asset-candidate-manual-license-check`
- 금지: 레퍼런스 문구/이미지/로고/CSS 복사, 유료/로그인/차단 콘텐츠 우회, 라이선스 미확인 자산 자동 import

수용 기준:

- 모든 사용자 제공 링크가 그대로 들어간다.
- 각 링크가 어떤 Phase에 쓰이는지 명시된다.
- `SKILL.md --deep`에서 이 문서를 참조한다.

### 2. `reference-intake` CLI

새 명령 후보:

```bash
node src/cli.js reference <url-or-file> --json
```

초기 범위:

- 기존 `fetchSource()` SSRF 가드를 재사용한다.
- HTML 텍스트에서 title, meta description, h1-h3, nav labels, CTA-like links/buttons, section ids/classes를 추출한다.
- puppeteer가 있으면 screenshot + computed style 기반으로 dominant colors, font families, font sizes, visible CTA count, motion CSS hints를 추출한다.
- 결과는 외부 자산을 저장하지 않고, 구조화 JSON과 선택적 스크린샷 경로만 남긴다.

결과 스키마 후보:

```json
{
  "source": "https://example.com",
  "kind": "whole-site",
  "title": "...",
  "headings": ["..."],
  "nav": ["Pricing", "Docs"],
  "ctas": [{"text": "Book a demo", "href": "/demo", "kind": "primary-candidate"}],
  "sections": [{"label": "hero", "signals": ["h1", "cta", "screenshot"]}],
  "visual": {
    "palette": ["#..."],
    "fontFamilies": ["..."],
    "fontSizes": [16, 20, 32],
    "motionHints": ["transition", "animation"]
  },
  "risks": ["login-required", "external-assets-not-copied"]
}
```

수용 기준:

- URL 입력은 private/loopback/link-local/metadata 대역 차단을 유지한다.
- puppeteer 미설치 시 정적 결과만 출력하고, 기존 visual lane과 같은 typed error 규율을 따른다.
- 결과에는 원문 문구를 과도하게 복사하지 않고 짧은 라벨/토큰만 담는다.

### 3. 인터뷰 `reference` 차원 승격

현재:

- `reference`: 실제 URL/제품 1개 이상 + 좋았던 이유

변경:

- `reference`: URL/제품 + 좋아한 계층 + 싫은 계층 + 복제 금지 항목

질문 예시:

- "이 레퍼런스에서 빌리고 싶은 것은 전체 무드인가요, 첫 화면 구조인가요, CTA 처리인가요, 모션인가요?"
- "같은 사이트에서 피하고 싶은 것은 무엇인가요? 색, 밀도, 말투, 애니메이션 중 하나만 골라주세요."
- "이 레퍼런스와 비슷해 보이면 안 되는 지점은 무엇인가요?"

점수화:

- 0.3: URL만 있음
- 0.5: 좋은 이유가 형용사 수준
- 0.75: 빌릴 계층이 명시됨
- 1.0: 빌릴 계층, 버릴 계층, 복제 방지 조건이 모두 명시됨

수용 기준:

- `core/interview.md`에 점수 기준이 반영된다.
- 한 번에 하나의 질문 원칙을 유지한다.
- 사용자가 레퍼런스를 주지 않았을 때 `core/reference-sources.md`에서 페이지 유형별 후보를 안내한다.

### 4. 컨셉 시트 레퍼런스 브리프

`templates/concept-sheet.md`에 추가할 섹션:

```markdown
## 레퍼런스 브리프

| 링크 | 빌릴 것 | 빌리지 않을 것 | 토큰/구조 반영 |
|---|---|---|---|
| {url} | {예: CTA 위치, 밀도, 모션 역할} | {예: 색, 로고, 문구} | {예: HI2, SP3, CO1} |

## 복제 방지

- 외부 사이트의 문구, 이미지, 로고, CSS, 레이아웃을 그대로 복사하지 않는다.
- 레퍼런스는 "결정 근거"이며 산출물은 소스 클레임과 인터뷰 답변에서 다시 설계한다.
```

수용 기준:

- 컨셉 승인 전에 레퍼런스 브리프가 비어 있거나 `없음`으로 명시된다.
- 빌드 단계에서 레퍼런스 브리프의 "빌리지 않을 것"을 위반하면 Phase 2로 되돌린다.

### 5. 모션 역할 모델

`60fps.design`, `landing.love`, `mobbin.com`에서 얻는 교훈은 모션 양이 아니라 "상태 변화 목적"이다.

새 필드 후보:

- `motion-role`: `none`, `orientation`, `feedback`, `progress`, `reveal`, `delight`
- `motion-budget`: `0`, `micro-only`, `one-signature`
- `reduced-motion-fallback`: 필수

수용 기준:

- `core/design-principles.md`의 DE3 reduced-motion 가드를 유지한다.
- `SKILL.md` Phase 2 토큰 커밋에 motion-role이 추가된다.
- Phase 5 LLM 체크리스트에서 "모션이 전환/상태 이해를 돕는가, 아니면 장식인가"를 판정한다.

### 6. 레퍼런스 기반 감사 코퍼스

외부 사이트를 그대로 fixture로 저장하지 않는다. 대신 조사에서 반복 관찰된 패턴을 합성 fixture로 만든다.

후보:

- SaaS pricing CTA 과밀 fixture
- 모든 섹션 동일 hero/card 리듬 fixture
- nav mega menu가 단일 랜딩에서 과한 fixture
- 모션이 reduced-motion 없이 전역 적용된 fixture
- brand/logo wall이 권리/출처 없이 들어간 fixture

수용 기준:

- 새 machine lane 승격은 fixture + baseline을 같은 변경에 포함한다.
- 외부 사이트 스크린샷/자산은 테스트 저장소에 커밋하지 않는다.

### 7. 자산/로고/아이콘 정책

적용 대상:

- `svgl.app`
- `hugeicons.com`
- `logofolio.com`
- `rebrand.gallery`
- `dezignheroes.framer.website`

정책:

- 로고/아이콘은 레퍼런스 또는 수동 승인된 라이선스 자산으로만 사용한다.
- 브랜드 로고는 "실제 고객/파트너" 클레임이 소스에 동결되어 있을 때만 등장할 수 있다.
- 출처 없는 logo wall은 기존 `S2 logo-wall-placeholder` 위반이다.
- 아이콘 스타일은 한 페이지에서 stroke/solid/rounded/sharp를 섞지 않는다.

수용 기준:

- `core/design-tells.md` S2/S4와 연결된다.
- `SKILL.md` Phase 5 카피/클레임 감사에 "로고/파트너 클레임 출처"가 추가된다.

## 구현 순서

### M7.1 문서와 프롬프트 통합

작업:

- `core/reference-sources.md` 추가
- `core/interview.md` reference 점수화 수정
- `templates/concept-sheet.md` 레퍼런스 브리프 추가
- `SKILL.md` `--deep` 설명과 Phase 2/3/5 절차 수정
- `ROADMAP.md` M7 추가

검증:

- 문서 링크 원문 보존 확인
- `npm test` 영향 없음 확인
- `npm run benchmark` 영향 없음 확인

### M7.2 정적 `reference-intake`

작업:

- `src/reference.js` 추가
- `src/cli.js`에 `reference` 명령 추가
- 기존 `fetchSource`, `stripTags` 재사용
- title/meta/headings/nav/CTA/section 추출
- unit test 추가

검증:

- file input, URL input, bad URL, SSRF blocked URL 테스트
- 사용자 입력 오류 exit 2, fetch 실패 exit 1 규율 유지

### M7.3 시각 `reference-intake --visual`

작업:

- puppeteer 선택 의존 유지
- desktop/mobile screenshot
- computed font families, font sizes, palette 후보, CTA geometry 추출
- `document.fonts.ready` 대기

검증:

- puppeteer 미설치 시 정적 결과 유지
- puppeteer 설치 시 JSON에 visual 객체 포함
- root-level screenshot artifacts는 `.gitignore` 또는 명시된 artifact 디렉터리로 격리

### M7.4 레퍼런스 브리프 생성 도우미

작업:

- `reference-intake` 결과를 컨셉 시트 표 조각으로 변환하는 `--brief` 옵션
- `reference` 차원 질문 생성에 필요한 요약 필드만 노출

검증:

- 원문 문구를 긴 문단으로 복사하지 않는다.
- "빌릴 것 / 빌리지 않을 것 / 토큰 반영"이 비어 있으면 승인 전 경고.

### M7.5 감사 후보 승격

작업:

- 모션 reduced-motion 정적 검사 강화 후보 검토
- CTA 과밀도 시각 검사 후보 검토
- 브랜드/로고 출처 LLM 체크리스트 강화

검증:

- 모든 machine lane 승격은 redteam fixture와 baseline 동반
- LLM 체크리스트와 machine lane 이중 채점 금지 유지

## 리스크와 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| 레퍼런스 복제가 디자인 품질 개선으로 오해됨 | 저작권/브랜드/차별성 문제 | 컨셉 시트에 "빌릴 것/빌리지 않을 것/복제 방지"를 잠근다. |
| 갤러리 사이트의 공개 수치가 변동됨 | 문서가 금방 낡음 | 수치는 "site-reported, accessed 2026-06-14"로 표시하고 기능 스펙은 수치에 의존하지 않는다. |
| URL fetch가 보안 표면을 넓힘 | SSRF/다운로드/리다이렉트 위험 | 기존 `src/intake.js` SSRF 가드를 재사용하고, 외부 자산 다운로드를 기본 금지한다. |
| puppeteer가 필수 의존으로 굳어짐 | 설치/CI 부담 | 기존 원칙대로 visual 기능만 선택 의존으로 유지한다. |
| 컴포넌트 마켓플레이스 코드를 그대로 가져옴 | 런타임 의존성/라이선스/스타일 불일치 | `21st.dev`는 분류 사전과 패턴 참고로만 사용하고, 자동 코드 import는 별도 승인 전 금지한다. |
| 학술 근거를 과장함 | 잘못된 제품 의사결정 | 논문은 방향 근거로만 사용하고 전환율/성과 주장은 실제 QA나 실험 없이는 하지 않는다. |

## Open Leads

- `curated.design`은 `craftwork.design/curated/websites/`로 리다이렉트된다. 문서에는 사용자 제공 원문을 보존하되, 구현 시 canonical URL도 저장해야 한다.
- 일부 사이트는 로그인/유료 플랜에서만 상세 화면, 영상, 필터 결과를 제공할 수 있다. 우회하지 않는다.
- `Fontpair` 직접 페이지 fetch는 빈 본문으로 수집됐다. 검색 결과 메타데이터는 확인했지만, 구현 전 공식 페이지나 API 접근성을 재확인해야 한다.
- `rebrand.gallery`는 `www.rebrand.gallery` 검색 결과로 확인됐다. 구현 전 도메인 canonical 처리를 확인한다.
- 논문 전문 재현과 실험 재현은 하지 않았다. 계획 근거는 paper-reported 수준이다.

## 바로 다음 변경 제안

가장 낮은 리스크의 첫 변경은 M7.1이다. 코드 경로를 건드리지 않고 `core/reference-sources.md`, `core/interview.md`, `templates/concept-sheet.md`, `SKILL.md`, `ROADMAP.md`만 업데이트하면 `--deep`의 레퍼런스 수집이 지금보다 즉시 선명해진다. 이후 M7.2에서 `reference-intake`를 추가하면 현재의 결정론적 CLI 철학과 자연스럽게 맞물린다.
