# 에셋 라이브러리 (asset library)

빌드 전 수집한 자산(폰트·이미지·텍스처·아이콘·팔레트·레퍼런스)을 관리한다.
에셋은 산출물이 **단일 HTML·신규 런타임 의존 0** 불변을 지키는 범위에서만 유효하다.

---

## 디렉터리 구조

```
assets/
  fonts/          ← 자가호스팅 woff2 (@font-face 상대경로)
  textures/       ← 배경 이미지·노이즈·종이 재질 (jpg/png/webp)
  icons/          ← 인라인 SVG 소스 (최적화 후 HTML에 인라인 삽입)
  images/         ← 실재 이미지·스크린샷·소셜카드·제품 아티팩트 (embeddable, `<img src>` 상대경로). 게으른·범용·안 어울리는 이미지(슬롭 룩) 금지(S4); sidecar source 명시 + 아트디렉션·통합이면 AI생성·스톡 합법
  palettes/       ← 팔레트 JSON/CSS 스니펫 (--accent, --bg 등)
  samples/        ← 스킬 번들 스타터 에셋 (CC0·자작). 보유 0개일 때 sourcing plan '(3) samples' 경로로 사용
refs/
  screenshots/    ← Phase 1 레퍼런스 URL 스크린샷 (node src/cli.js shot)
  brief/          ← 클라이언트 브리프·무드보드 파일
```

기존 예시: `assets/fonts/hahmlet-*.woff2` — Hahmlet 자가호스팅 폰트 (Phase 0 인테이크 시 동반 파일로 제공됨).

---

## 수집 시점

| 시점 | 내용 |
|---|---|
| **Phase 0** (Intake) | 소스와 함께 제공된 폰트·이미지·SVG·팔레트 파일을 `assets/` 하위에 저장. 라이선스 sidecar 즉시 작성. |
| **Phase 1** (Interview) | 레퍼런스 URL을 `node src/cli.js intake <url>` SSRF 게이트 통과 후 `shot`으로 스크린샷 캡처 → `refs/screenshots/` 저장. 파일명을 컨셉 시트 reference 행에 기록. |
| **Phase 2** (Concept Lock) | 컨셉 시트 에셋 계획(Sourcing Plan) 행에 실제 사용할 파일 + 소싱 경로(path/generate/samples/crawl)를 확정 기록. `node src/cli.js assets assets --concept-sheet <concept-sheet>` 리포트가 `prebuild readiness: READY`여야 승인 요청 가능. `assets/`·`refs/`에 없는 파일은 Phase 0/1로 되돌아가 수집한다. |
| **Phase 3** (Build) | `:root` 토큰 선언 시 `@font-face`(상대경로)·CSS 변수·인라인 SVG를 실제 파일에서 조립. 원격 URL 참조 금지(CDN 비권장). |

---

## 라이선스 sidecar 규칙

모든 에셋 파일 옆에 `<filename>.license.txt`를 둔다. 최소 기록(AI생성·크롤 에셋은 `source` 필드 필수):

```
파일: hahmlet-korean-700-normal.woff2
라이선스: SIL OFL 1.1
출처: https://fonts.google.com/specimen/Hahmlet
source: fonts.google.com
수집일: 2026-06-14
```

sidecar가 없는 파일은 빌드에 사용할 수 없다. AI생성·크롤 에셋은 `source: AI-generated:codex` / `source: crawled:https://…` 형식으로 `source` 필드를 반드시 명시한다.

---

## 복제 금지

- **픽셀 카피 금지**: 클라이언트 브리프나 레퍼런스의 디자인 요소를 픽셀 단위로 복제하지 않는다. 아이디어만 채택하고 산문·이미지·레이아웃은 재창작한다.
- **빌릴 것 / 버릴 것**: 컨셉 시트의 "하지 않을 것" 목록에서 레퍼런스의 버릴 요소를 명시한다. 가져오는 것은 역할(색, 텍스처 느낌, 타이포 성격)이지 형태가 아니다.
- **S4 재정의 — generic-image**: 소스 불문(AI생성·스톡·실사), 게으른·범용·디폴트·안 어울리는 이미지(슬롭 룩)만 금지. sidecar source 명시 + 아트디렉션·통합이면 합법. undraw/스톡/AI생성 자체 금지 아님 — **게으른 사용** 금지.

---

## 자가호스팅 원칙

- 원격 CDN 폰트(`fonts.googleapis.com` 등) 의존 → webfont ① WARN (audit 정적 레인).
- 모든 폰트는 `@font-face { src: url('./assets/fonts/…') }` 상대경로로 선언한다.
- **본문 폰트도 반드시 자가호스팅한다.** `--font-body`를 시스템 전용 스택(`Pretendard`·`Apple SD Gothic Neo`만)으로 두면 그 폰트가 미설치된 환경에서 본문이 못생긴 기본 폰트로 깨진다. 번들 `assets/fonts/pretendard-variable.woff2`(가변 — 전 굵기 1파일)를 기본 본문으로 `@font-face` 선언하고 `--font-body` 첫 자리에 둔다. 시스템 폰트는 *폴백*으로만.
- 이미지·텍스처는 HTML 파일 기준 상대경로 `src="assets/textures/…"`.
- 아이콘 SVG는 `<svg>` 인라인 삽입 — `<img src>` 또는 `<use xlink:href>` 원격 참조 금지.

---

## 빌드 조립 요약

Phase 3 토큰 먼저(`:root` 선언) 시:

```css
/* 자가호스팅 폰트 — 디스플레이 + 본문 둘 다 (본문을 시스템 폰트에 맡기지 않는다) */
@font-face {
  font-family: 'Hahmlet';
  src: url('./assets/fonts/hahmlet-korean-700-normal.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: 'Pretendard';
  src: url('./assets/fonts/pretendard-variable.woff2') format('woff2');
  font-weight: 45 920;  /* 가변: 본문~볼드 한 파일 */
  font-display: swap;
}

:root {
  /* 타입 토큰 */
  --font-display: 'Hahmlet', 'Pretendard', sans-serif;
  --font-body: 'Pretendard', system-ui, sans-serif;  /* 번들 자가호스팅 — 미설치 폴백 방지 */

  /* 팔레트 토큰 (assets/palettes/ 에서 확정) */
  --bg: #f9f7f4;
  --fg: #1a1714;
  --accent: #3b6ea5;

  /* 스페이싱 토큰 */
  --space-1: 4px;  --space-2: 8px;  --space-3: 16px;
  --space-4: 24px; --space-5: 32px; --space-6: 48px;
  --space-7: 64px; --space-8: 96px; --space-9: 128px;
}
```

인라인 SVG 다이어그램은 `assets/icons/<name>.svg` 내용을 그대로 HTML에 삽입한다(외부 참조 아님).

신규 런타임 의존 0 — 폰트와 최소 1개 이상의 시각 앵커(logo/image/texture)가 로컬에 없으면 빌드를 시작하지 않는다.

---

## 현재 라이브러리 인벤토리 (2026-06-14)

before/after 실측(`design-principles.md` 시각 임팩트 절)의 **(a) 진짜 에셋** 레버로 수집:

| 종류 | 파일 | 비고 |
|---|---|---|
| fonts (display) | `fonts/hahmlet-{korean-700,korean-800,latin-700}-normal.woff2` | OFL, 자가호스팅 디스플레이 세리프(굵은 제목용) |
| fonts (body) | `fonts/pretendard-variable.woff2` | OFL, 자가호스팅 본문 가변 폰트(한글+라틴, weight 45~920). **본문 기본** — 시스템 폰트 의존 금지 |
| icons | `icons/{anthropic,claude-ai,openai,gemini,perplexity,notion,figma,vercel}.svg` | 실제 브랜드 로고(svgl). **트레이드마크 — 명목적 참조 한정**, "고객/파트너" 클레임 근거 없으면 S2 위반 |
| icons | `icons/patina-{mark,badge,icon}.svg` | patina 자체 브랜드(devswha/patina, MIT). 제안서의 주체라 주체적 사용 |
| icons | `icons/design-interview-{mark,icon,logo}.svg` | design-interview 자체 브랜드(MIT, 자작 벡터). README 헤더·repo 식별 — 주체적 사용. Eye of Horus(wedjat) 컨셉 — copper 슬롭 브로우 + teal 식별의 눈 + preserved-claim 동공 |
| images | `images/patina-before-after.svg`, `images/patina-og.svg` | patina 실제 소셜/before-after 카드(MIT). **실제 산출물 증거** — 제안서 증거 섹션 임베드(`<img src>`) |
| textures | `textures/paper-noise.svg`, `textures/dot-grid.svg`, `textures/hatch-diagonal.svg` | feTurbulence·도트그리드·대각해치 직접 생성(CC0). background-image 타일 |

전부 `.license.txt` sidecar 동반. **(a) 원칙**: 만든(undraw·스톡) 자산이 아니라 *구해온/실재* 자산만 — 빌드는 이 인벤토리에서 인라인 조립한다.
**(b) 폴라리티 빌드 패턴**: 다크 캔버스 밴드를 1곳 이상 두고 라이트 섹션과 교차(`<section class="band-dark">` + 그 위 라이트 인셋 패널), 강조색은 다크 위에 점으로. 2칼럼은 불균등(좌사진/우데이터 등). **(c) 초점**: 섹션마다 지배 요소 1개(HI2 one-winner 교차참조) — shot 자기검수로 확인.

---

## 소싱 4경로

Phase 1 인터뷰 sourcing plan 응답 및 Phase 2 에셋 계획에서 per-asset으로 선택:

| 경로 | 설명 | sidecar `source` 예시 |
|---|---|---|
| **(1) path** | 사용자 보유 폴더 경로 직접 제공 | `source: user-provided` |
| **(2) generate** | codex CLI · ChatGPT image · 자작 SVG 제작 | `source: AI-generated:codex` / `source: self-authored` |
| **(3) samples** | 번들 샘플 `assets/samples/` 즉시 사용 | `source: bundle-sample` |
| **(4) crawl** | consent-gated 크롤 (실재-only) | `source: crawled:https://…` |

**직접 입력 / 없음** 폴백: 에셋을 생략하는 허가가 아니라 소싱 경로를 고르는 트리거다. 보유 에셋이 없으면 generate/samples/crawl 중 하나를 선택해 실제 파일과 sidecar를 먼저 만든다. font-only와 0-asset은 `prebuild readiness: NOT READY`.

---

## 크롤 절차 (consent + 가드)

크롤은 **사용자 허락(consent) 후에만** 실행한다. 두 경로:

1. **스크린샷 (레퍼런스·실재 화면)**: 기존 `node src/cli.js shot <url>` 재사용 → `refs/screenshots/` 저장. 신규 코드 없음.
2. **바이너리 에셋 (실 로고·이미지 파일)**: `node src/cli.js crawl <url> [--out <dir>] [--name <file>]` 실행 → SSRF 가드(`assertSafeUrl`·`guardedLookup`·5MB/30s 캡, `src/intake.js` `fetchBinary` 공유)를 통과한 뒤 카테고리 디렉터리에 저장하고 provenance sidecar를 **자동** 작성한다. 신규 런타임 의존 0.
   - 예: `node src/cli.js crawl https://brand.example/logo.svg --out assets/icons`
   - exit: 성공 0 / SSRF 차단·fetch 실패·캡 초과 1 / 비URL·파일명 추론 불가 2.

수집 결과 규칙:
- 카테고리 디렉터리(`assets/images/`, `assets/icons/` 등)에 저장(`--out`).
- provenance/license `.license.txt` sidecar **자동 작성** — `source: crawled:<원본URL>`, `license: REVIEW-REQUIRED`(사용 전 수동 확인).
- 수집물을 "고객/파트너" 등 실재로 거짓주장하면 S2 위반 — 명목적 근거 확인 후 사용.
- sidecar 없으면 빌드 사용 불가(크롤은 자동 작성하므로 충족).

---

## 에셋 검사 CLI

```
node src/cli.js assets <dir> [--concept-sheet <path>] [--json]
```

advisory 검사 + readiness 출력:

- **종류별 개수**: logo · image · texture · font · other (total N)
- **prebuild readiness**: sidecar 있는 logo/image/texture가 1개 이상이고 concept-sheet 에셋 계획이 비어있지 않은지 표시. NOT READY면 Phase 2 승인·Phase 3 빌드 금지.
- **sidecar 누락** 목록: `.license.txt` 없는 파일
- **가짜-실재 의심** 목록: sidecar 근거 기반 의심 표시만 (advisory; 최종 판정은 LLM 레인)

**exit 계약 (고정):**
- **always exit 0** — suspect/missing 개수와 완전 독립. 입력 오류(dir 미지정·없음·파일아님)만 exit 2.
- best-effort 검사 — 누락·의심은 권고일 뿐.
- exit 0이어도 `prebuild readiness: NOT READY`면 스킬 오케스트레이션상 빌드 금지다. exit 코드는 기계 차단 게이트가 아니라 리포트 생성 성공 여부만 뜻한다.
- **S2 가짜-실재 최종 판정 권위는 LLM 레인 단일**; 기계는 sidecar 근거 의심 표시만(이중채점 금지).
- **CI 차단 게이트로 쓰지 말 것** — blocking이 필요하면 `node src/cli.js audit` 레인 사용.

---

## 번들 샘플

`assets/samples/` — CC0·자작 스타터 파일. sourcing plan 경로 **(3) samples** 사용 시 참조.

```
assets/samples/
  textures/paper-noise.svg         ← feTurbulence 자작, CC0
  textures/dot-grid.svg            ← 도트그리드 자작, CC0
  icons/placeholder-mark.svg       ← 자작 플레이스홀더 마크, CC0
  icons/wordmark-placeholder.svg   ← 자작 워드마크 플레이스홀더, CC0
```

각 파일에 `.license.txt` sidecar 동반 (`source: self-authored`, `라이선스: CC0`).
