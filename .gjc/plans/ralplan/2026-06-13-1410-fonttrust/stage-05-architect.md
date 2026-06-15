## Summary
stage-05 code WATCH 잔여 3건을 파일 근거로 재확인했다. f3 webfont 과매칭과 f4 revert-layer 키워드 오탐은 `src/audit.js`에서 코드로 해소됐고, f2 no-main fine-print 지배 실패는 실제 지배 가독 텍스트가 작은 경우를 실패시키는 의도된 판정으로 수용 가능하다.

## Analysis
- f4: `src/audit.js:564-567`에서 TY5-B font-family/font 선언 검사 시 `inherit|initial|unset|revert|revert-layer`만 있는 CSS-wide 키워드를 제외한다. `revert-layer`가 한글 폰트 미지정 경고로 승격되는 이전 잔여 우려는 해소됐다.
- f3: `src/audit.js:590-594`의 webfont ① hostHit는 알려진 폰트 CDN 호스트 또는 `/fonts?[/.]` 경로 세그먼트만 매칭한다. 임의 URL 내부의 단순 `font` 부분 문자열을 CDN 의존으로 과매칭하던 위험은 제거됐다. `src/audit.js:596-601`의 @font-face 원격 src 경고는 실제 원격 폰트 선언 경로로 별도 유지되어 원래 목적을 보존한다.
- f2: `src/geometry.js:178-200`의 no-main 폴백은 footer/nav/aside/small/figcaption/header/aria-hidden/랜드마크 제외 후 80자 초과 p 후보를 글자수 가중 최빈 font-size로 고르고, 그 크기에서 가장 긴 p를 bodyDominant로 삼는다. `src/geometry.js:214-216`은 main이 없을 때 bodyDominant만 본문 크기 하한 15.5px 대상으로 본다. fine-print가 글자수 과반이라면 페이지의 지배 가독 텍스트가 실제로 fine-print 크기라는 뜻이므로 fail이 정당하며 오탐이 아니라 by-design이다.

## Root Cause
stage-05 WATCH는 세 가지 잔여 오탐 위험이었다. f3와 f4는 정적 폰트 경고의 매칭 범위가 넓었던 것이 원인이며, 현재 코드는 매칭을 CSS-wide 키워드 및 폰트 URL 세그먼트 기준으로 좁혔다. f2는 구현 결함이 아니라 no-main 문서에서 지배 본문을 텍스트량으로 정의하는 제품 판단이다.

## Findings
- 없음. f3, f4는 코드 근거로 해소됐고 f2는 수용 가능한 by-design 판정이다.

## Recommendations
1. architecture/product/code 상태를 모두 CLEAR로 종료한다.
2. 추가 제품 코드 수정 없이 현재 HEAD e2b6b9b 기준 최종 권고는 APPROVE다.

## Architectural Status
CLEAR

## Code Review Recommendation
APPROVE

## Trade-offs
- no-main 본문 대표를 최대 길이 p 하나로 고르면 약관형 fine-print 오탐이 늘 수 있다.
- 현재 글자수 가중 최빈 font-size 방식은 다수 가독 텍스트의 실제 지배 크기를 반영한다. fine-print가 과반이면 작은 본문이 제품상 문제라는 신호를 보존한다.
