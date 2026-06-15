
## Summary
WARN과 fail을 분리한 데이터 모델, `combineAudits()` 병합, CLI exit 경로는 계획과 대체로 일치한다. 다만 fail 게이트인 TY5-A와 TY2 no-main 폴백에 보수 조건이 빠져 clean 오탐0 규율을 흔들 수 있어 구현 완료 게이트는 REQUEST CHANGES가 맞다.

## Analysis
- 스펙 매핑: deep-interview는 TY5-A만 fail, TY5-B/C와 webfont ①/②는 WARN, TY2 `<main>` 부재 폴백은 fail 보강으로 요구한다. 계획 stage-03도 visual warnings 채널, 정적/시각 warnings concat, findings만 채점, puppeteer 선택 의존을 수용 기준으로 둔다.
- WARN/fail 분리: `auditHtml()`는 findings로 `failed/slopScore/pass`를 계산한 뒤 `warnings: collectWarnings(...)`를 별도 필드에 싣는다(`src/audit.js:620-634`). `combineAudits()`는 visual 배열 또는 `{ findings, warnings }`를 normalize하고, failed/slopScore/pass는 병합 findings만으로 재계산하며 warnings는 concat만 한다(`src/audit.js:646-673`). CLI도 `process.exit(result.pass ? 0 : 1)`만 사용한다(`src/cli.js:60-77`). 이중채점 방지는 같은 ID 병합 로직으로 유지된다.
- TY5-A: 실제 구현은 visible 텍스트 블록의 텍스트 노드에서 인접 한글 완성형 음절 pair를 Range로 잡고 rect top 차이가 font-size 절반을 넘으면 TY5 fail을 낸다(`src/geometry.js:216-234`). 공백과 구두점은 syllable pair 조건으로 제외되고 vertical writing은 skip된다. 그러나 계획이 명시한 transform 제외가 없다.
- TY2 no-main: `<main>`이 없으면 visible하고 일부 landmark 밖의 80자 초과 `<p>` 중 가장 긴 단락을 `bodyDominant`로 잡고 15.5px 미만이면 fail한다(`src/geometry.js:181-204`). footer/small clean fixture는 보호하지만, 계획의 visible text share 충분 조건은 구현되지 않았다.
- webfont ②: `document.fonts`의 선언 family만 Set으로 모으고, computed 첫 family가 그 선언 family이면서 `document.fonts.check()`가 false일 때만 visual WARN을 낸다(`src/geometry.js:351-362`). 시스템 폰트와 미선언 family는 제외되어 헤드리스 잡음 위험은 낮다.
- puppeteer 선택 의존: 정적 감사는 `audit.js`만 사용하고, geometry는 `loadPuppeteer()` 동적 import를 통해 시각 레인에서만 요구한다(`src/screenshot.js:18-31`, `src/geometry.js:375-397`). 테스트도 puppeteer 미설치 시 visual 케이스를 skip한다(`tests/unit/geometry.test.js:7-10`).
- 문서 레인: SKILL/core 문서에는 TY5-A/B/C와 webfont WARN이 기계 레인으로 이동했고 D/E는 LLM 잔류로 표기되어 단일레인 원칙은 대체로 유지된다(`SKILL.md:110-111`, `core/design-principles.md:66-74`, `core/design-tells.md:41-44`).

## Root Cause
채널 아키텍처는 올바르게 확장됐지만, fail 게이트의 보수 조건을 수용 기준보다 좁게 구현하고 최소 양면 픽스처에 맞춰 검증했다. 그래서 정상 페이지를 막을 수 있는 기하 예외와 범용 외부 폰트 URL 누락이 남았다.

## Findings
1. MAJOR — `src/geometry.js:219-234`: TY5-A가 transformed text를 제외하지 않는다. Range rect top은 transform 뒤 좌표라 같은 줄 한글도 rotation/skew에서 font-size 절반 이상 차이 날 수 있고, 이는 납품 차단 fail 오탐이다. 조상 chain의 `transform !== none`을 skip하고 clean transform fixture를 추가해야 한다.
2. MAJOR — `src/geometry.js:181-204`: TY2 no-main fallback이 visible text share 또는 dominant content container 기준 없이 가장 긴 `<p>` 하나를 고른다. `footer/nav/aside/small/figcaption` 밖의 긴 legal/sidebar/header copy가 generic div에 있으면 본문으로 오판해 fail할 수 있다. 더 넓은 landmark/role/class 제외와 share threshold를 적용하고, non-body fine print가 real body보다 긴 clean fixture를 추가해야 한다.
3. MINOR — `src/audit.js:591-598`: webfont ① link/import 탐지는 known font host regex에 묶여 있다. 계획의 external `@import`/`<link href>` 수용 기준과 달리 임의 CDN의 font stylesheet는 miss된다. stylesheet link/import의 http(s) 외부 URL을 일반적으로 파싱해야 한다.
4. MINOR — `src/audit.js:563-568`: TY5-B 조건이 폴백 스택 계약과 어긋난다. 현재는 generic이 있어야 warn하고 Korean font가 없으면 `Inter, sans-serif`도 warn하므로, `Inter` 같은 no-generic stack은 놓치고 sans-only 허용 여부도 불명확하다. 제품 문구를 확정한 뒤 no-generic, sans-only, Korean-font 테스트로 고정해야 한다.

## Recommendations
1. TY5-A transform skip과 TY2 dominance/share guard를 먼저 수정하라. 둘 다 fail 채널이라 오탐0 게이트의 직접 리스크다.
2. webfont ① 외부 stylesheet URL 파서를 known-host 목록에서 구조 파싱으로 바꾸고, arbitrary CDN link/import 테스트를 추가하라.
3. TY5-B 제품 규칙을 스펙 문장 그대로 재확정하고 조건과 테스트 이름을 맞춰라.
4. 수정 후에는 사용자가 금지한 현재 리뷰에서는 실행하지 않았지만, 구현 레인에서 `npm test`와 `npm run benchmark`를 재검증해야 한다.

## Architectural Status
BLOCK

## Code Review Recommendation
REQUEST CHANGES

## Trade-offs
| Option | 장점 | 단점 | 판정 |
|---|---|---|---|
| 현재 구현 유지 | 채널 분리와 대부분 수용 기준은 동작 | fail 오탐 가능성이 남아 완료 게이트 신뢰 훼손 | 기각 |
| transform skip + TY2 share guard만 수정 | 오탐0 핵심 리스크를 빠르게 닫음 | WARN miss 일부는 남음 | 최소 필수 |
| URL 파서와 TY5-B 문구까지 정리 | 스펙 정합성과 장기 유지보수성 확보 | 소폭 추가 테스트 필요 | 권장 |

## Surface Status
- Architecture: WATCH — findings/warnings 구조와 단일레인 병합은 건전하지만 fail 게이트 예외 처리가 부족하다.
- Product: BLOCK — clean 오탐0 규율을 위협하는 fail-channel 리스크가 남았다.
- Code: BLOCK — 수용 기준의 transform, dominance/share, generic external URL 조건이 코드와 테스트에 빠졌다.
