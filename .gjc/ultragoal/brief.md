design-interview(~/workspace/design-interview)를 테스트 가능한 완성 상태로 끌어올린다.

공통 제약:
- 현재 상태: M0~M2 완료 (스킬 + inert 프리뷰, 결정론적 감사 엔진 C1/T1/T2/T4/S5, 벤치마크 회귀 게이트 3/3 green, 테스트 15개).
- 새 기계 텔 추가 시 픽스처 + tests/quality/baseline.json 갱신을 같은 커밋으로 (ROADMAP 운영 원칙).
- 기계 레인이 커버하게 된 텔은 SKILL.md/core LLM 체크리스트에서 제거 (이중 채점 금지).
- puppeteer는 devDependency. 미설치 환경에서 M0~M2 기능과 단위 테스트는 계속 동작해야 한다 (puppeteer 필요 테스트는 skip 분기).
- 의미·숫자·극성·인과 보존(patina MPS 원칙)은 모든 단계에서 불변.
- 각 스토리 완료 시 npm test + npm run benchmark green 후 커밋.

@goal: M3 비주얼 레인 완성
puppeteer를 devDependency로 설치하고 shot CLI 실캡처를 검증한다(examples/slop-source.html → desktop/mobile PNG 생성 확인).
렌더된 박스 기하 기반 기계 판정을 추가한다: src/geometry.js — puppeteer로 렌더 후 요소 박스 좌표를 수집해
L1(균일 카드 그리드: 형제 3개+ 동일 크기·등간격)과 S3(완전 대칭: 주요 블록이 전부 수평 중앙정렬)를 판정한다.
audit CLI에 --visual 플래그를 추가해 기하 판정을 기계 감사에 합류시킨다 (puppeteer 미설치 시 명확한 안내 후 정적 검사만).
slop 픽스처 중 하나에서 L1 또는 S3가 실제로 잡혀야 한다 (필요 시 균일 그리드 slop 픽스처 추가 + baseline 갱신).
SKILL.md Phase 4에 스크린샷 자기검수 단계를 통합하고 Phase 5 기계 감사에 --visual 경로를 문서화한다.
core/design-tells.md의 감사 레인 표기를 갱신한다 (L1/S3 기계 레인 승격).

@goal: M4 소스 인테이크 파이프라인
src/intake.js — 클레임 추출기: HTML/마크다운/플레인텍스트 slop 소스에서 숫자·가격·기능 클레임을
구조화(JSON)로 추출하고 Phase 5 클레임 대조표(마크다운)를 생성한다.
intake CLI 레인 추가: `design-interview intake <file-or-url> [--json|--table]`.
URL 입력은 SSRF 가드 필수 — private/loopback/link-local IP 차단, 리다이렉트 재검증, 5MB/30s 캡 (patina security.js 원칙 축소판).
단위 테스트: 추출 정확성(국문 가격 "9,000원", 영문 "$8/user/month", 수량 "30개"), SSRF 차단 케이스.
SKILL.md Phase 0의 URL 경로를 intake CLI 사용으로 갱신한다.

@goal: E2E 파이프라인 검증 + 문서 마감
tests/e2e/pipeline.test.js — examples/slop-source.html을 입력으로 intake(클레임 추출) → audit(기계 감사 fail 검증)
→ preview(--against 토글 생성) → shot(PNG 생성, puppeteer 있을 때) 전체 파이프라인을 CLI 실호출(node src/cli.js)로 검증한다.
package.json에 test:e2e 스크립트 추가, npm test는 unit+e2e 모두 커버.
README(usage에 intake/--visual 추가, Layout 표 갱신)와 ROADMAP(M3/M4 상태 갱신, 남은 항목 정리)을 마감한다.
최종: npm test + npm run benchmark 전부 green, 커밋 완료.
