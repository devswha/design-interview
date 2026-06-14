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
  palettes/       ← 팔레트 JSON/CSS 스니펫 (--accent, --bg 등)
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
| **Phase 2** (Concept Lock) | 컨셉 시트 에셋 선택 행에 실제 사용할 파일을 확정 기록. `assets/`·`refs/`에 없는 파일은 Phase 0/1로 되돌아가 수집한다. |
| **Phase 3** (Build) | `:root` 토큰 선언 시 `@font-face`(상대경로)·CSS 변수·인라인 SVG를 실제 파일에서 조립. 원격 URL 참조 금지(CDN 비권장). |

---

## 라이선스 sidecar 규칙

모든 에셋 파일 옆에 `<filename>.license.txt`를 둔다. 최소 기록:

```
파일: hahmlet-korean-700-normal.woff2
라이선스: SIL OFL 1.1
출처: https://fonts.google.com/specimen/Hahmlet
수집일: 2026-06-14
```

sidecar가 없는 파일은 빌드에 사용할 수 없다.

---

## 복제 금지

- **픽셀 카피 금지**: 클라이언트 브리프나 레퍼런스의 디자인 요소를 픽셀 단위로 복제하지 않는다. 아이디어만 채택하고 산문·이미지·레이아웃은 재창작한다.
- **빌릴 것 / 버릴 것**: 컨셉 시트의 "하지 않을 것" 목록에서 레퍼런스의 버릴 요소를 명시한다. 가져오는 것은 역할(색, 텍스처 느낌, 타이포 성격)이지 형태가 아니다.
- **S4 stock-illustration 금지**: undraw류 SVG 일러스트, 의미 없는 3D 블롭은 `assets/icons/`에 저장해도 빌드 사용 금지. 실사 사진·직접 제작 SVG 다이어그램만 합법.

---

## 자가호스팅 원칙

- 원격 CDN 폰트(`fonts.googleapis.com` 등) 의존 → webfont ① WARN (audit 정적 레인).
- 모든 폰트는 `@font-face { src: url('./assets/fonts/…') }` 상대경로로 선언한다.
- 이미지·텍스처는 HTML 파일 기준 상대경로 `src="assets/textures/…"`.
- 아이콘 SVG는 `<svg>` 인라인 삽입 — `<img src>` 또는 `<use xlink:href>` 원격 참조 금지.

---

## 빌드 조립 요약

Phase 3 토큰 먼저(`:root` 선언) 시:

```css
/* 자가호스팅 폰트 */
@font-face {
  font-family: 'Hahmlet';
  src: url('./assets/fonts/hahmlet-korean-700-normal.woff2') format('woff2');
  font-weight: 700;
  font-display: swap;
}

:root {
  /* 타입 토큰 */
  --font-display: 'Hahmlet', 'Apple SD Gothic Neo', sans-serif;
  --font-body: Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;

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

신규 런타임 의존 0 — 폰트·이미지·SVG가 로컬에 없으면 빌드를 시작하지 않는다.
