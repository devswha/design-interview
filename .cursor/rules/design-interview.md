---
description: design-interview — interview-driven page tailoring that strips AI design tells before building landing/detail/proposal pages
globs:
alwaysApply: false
---

# design-interview (Cursor rule)

전체 오케스트레이션 본문은 이 스킬 클론의 `SKILL.md`에 있다. Cursor에서 페이지 재단 작업을
할 때 그 흐름을 따른다. 핵심 불변식만 여기 요약한다 — 자세한 단계·게이트·체크리스트는 `SKILL.md`,
`core/interview.md`, `core/design-tells.md`, `core/design-principles.md`를 읽는다.

## 하드 게이트 (어기면 실패)

1. **인터뷰 없이는 디자인 없다.** 컨셉 시트(`templates/concept-sheet.md`)가 사용자 승인으로 잠기기 전에는 한 줄의 HTML/CSS도 생성하지 않는다.
2. **에셋 없이는 컨셉 잠금 없다.** `prebuild readiness: READY`가 나오기 전엔 컨셉 승인 금지 — 최소 1개 이상의 sidecar 있는 logo/image/texture 필요.
3. **감사 통과 없이는 납품 없다.** `audit`가 blocking으로 fail(exit 1)이면 납품 금지.

## 결정론 검수 엔진 (`src/cli.js`)

이 클론 디렉터리에서 실행한다. 입력·출력 경로는 사용자 프로젝트 기준:

```bash
node <this-rule-dir>/../../src/cli.js intake <file-or-url> --json   # 클레임(가격·수량·기간·기능) 동결
node <this-rule-dir>/../../src/cli.js audit <built.html> --visual   # design-tell 감사; exit 1 = 납품 불가
node <this-rule-dir>/../../src/cli.js preview <built.html> --against <slop.html>
node <this-rule-dir>/../../src/cli.js assets <dir> --concept-sheet <sheet>
```

시각 레인(`shot`, `audit --visual`)은 puppeteer가 필요하다(클론에서 `npm install`). 없으면 정적 레인으로 폴백.

## 양면 규율

- **금지(design-tells)**: `core/design-tells.md`의 AI 텔 패턴은 생성 시점부터 회피한다.
- **양성(design-principles)**: `core/design-principles.md`의 시니어 원칙(토큰 규율·시각 임팩트·모션 예산)을 더한다.
- **클레임 보존**: 디자인이 바뀌어도 소스의 숫자·기능·가격·인과는 불변(patina MPS 원칙).
