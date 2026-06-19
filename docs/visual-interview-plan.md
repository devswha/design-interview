# 시각 인터뷰 (visual interview) — 핸드오프 브리프

> 상태: **계획 (미승인)**. 새 세션에서 deep-interview → ralplan으로 다듬은 뒤 구현한다.
> 이 문서는 다른 세션에서 맨바닥 시작을 막기 위한 컨텍스트 시드다.

## 목표

인터뷰(Phase 1)의 객관식 질문을, 호스트에 브라우저/프리뷰 표면이 있으면 **시각 보드**로 띄운다.
번호별 선택지를 실제 팔레트 스와치·무드 미니목업·에셋 썸네일·예시 렌더로 보여주고, **추천(❯) 옵션을 시각적으로 강조**한다.
mood/reference/palette/asset 같은 본질적으로 시각적인 차원에서 텍스트 선택지의 한계를 없애고, recommend 기능을 강화한다.

## 핵심 설계 방향 (먼저 잠근 것)

1. **Host-agnostic — Codex 전용 금지.** "호스트에 브라우저/프리뷰 표면이 있으면(Codex 브라우저 · GJC `browser` 툴 · Claude artifact 등) 시각 보드를 띄우고, 없으면 현행 텍스트 선택지로 폴백." 이 스킬의 portable 가치를 유지한다.
2. **두 레이어 규율 준수.** 판단은 LLM(스킬), 결정론 산출물만 CLI. 시각 보드 HTML 생성은 새 **결정론 CLI 레인**으로, `src/preview.js`의 inert 보안 모델(스크립트 제거·CSP `script-src 'none'`·`dsiv-` 프리픽스 chrome)을 그대로 재사용한다. 보드는 inert여야 한다(무스크립트).

## 제안 구현 형태 (deep-interview/ralplan에서 확정 대상)

- **새 CLI 레인**: `node src/cli.js board <options.json> [--out <file>]` → `option-board.html`
  - 입력: 라운드의 차원·질문·선택지 배열(번호·라벨·근거·시각 힌트)·추천 인덱스.
  - 출력: 번호 카드 그리드(차원별 시각: 팔레트=스와치 / mood=미니 아키타입 목업 / reference=스크린샷 / structure=와이어 블록 / asset=썸네일), 추천 카드 강조, "직접 입력/없음" 폴백 카드.
- **SKILL Phase 1 통합**: 호스트에 브라우저가 있으면 보드를 생성·열고 AskUserQuestion(텍스트)을 나란히 던진다. 점수 갱신 시 보드도 재생성(옵션).
- **폴백**: 무브라우저 호스트는 현행 텍스트 선택지 그대로(`core/interview.md` "차원별 선택지 예시").

## 열린 질문 (deep-interview로 잠글 것)

1. 차원별 시각 매핑의 정확한 형태(위 매핑이 충분한가? structure/conversion은 어떻게 시각화?).
2. "번호별 예시"를 뭘로 렌더 — 인라인 미니목업 생성 vs 실제 에셋 파일 vs 번들 샘플(`assets/samples/`).
3. 호스트 브라우저 감지·열기 추상화 — Codex 브라우저 API / GJC `browser` 툴 / Claude artifact를 어떻게 단일 인터페이스로?
4. 점수 갱신 때 보드 라이브 갱신 여부·빈도.
5. 보안 — 보드 inert 보장(preview.js 모델), 외부 리소스 차단, 사용자 에셋 썸네일의 안전 임베드.
6. 보드 생성 비용/지연이 "한 번에 질문 하나" 리듬을 해치지 않는지.

## 관련 파일 / 아키텍처 컨텍스트

- `src/preview.js` — inert 프리뷰 빌더(재사용할 보안 모델: CSP·무스크립트 radio-hack·`dsiv-` chrome).
- `src/cli.js` — 레인 디스패치 진입점(`intake|preview|audit|shot|assets|crawl`). 새 `board` 레인 추가 지점. exit-code 규율(입력오류 2 / fail 1) 준수.
- `core/interview.md` — 6차원 프레임워크, 라운드 운영, **디자이너 추천(recommend)** 절, 쉬운 말 규율, 차원별 선택지 예시.
- `core/design-tells.md` — 텔 목록(특히 **S6 ai-diagram-cliche**: 시각 예시 생성 시 노드-선 클리셰 금지).
- `templates/concept-sheet.md` — 인터뷰 요약의 `추천→선택` 칸(보드 선택 결과 기록처).
- `SKILL.md` — Phase 1 인터뷰 규칙 + 실행 계약(인터뷰-우선, host-agnostic 질문 도구, gjc deep-interview 가드 자가해소).

## 현재 스킬 상태 (이미 반영된 것)

- recommend: 매 라운드 1개 추천 + 근거 + 수렴 금지 가드 + S6 등 텔 회피(노드-선 도식은 '유지' 추천 안 함).
- 쉬운 말 규율: 질문·선택지·추천을 비전문가 일상어로.
- 인터뷰-우선 실행 계약: 호스트의 "묻지 말고 실행" 기본값을 덮어씀.
- S6: 노드-선/박스-선 다이어그램 클리셰를 텔로 등록(LLM 레인).
- gjc 주의: 'interview' 키워드로 시드되는 번들 deep-interview 가드는 `gjc state clear --mode deep-interview`로 해제.

## 권장 워크플로

1. **deep-interview** — 위 "열린 질문" 잠그고 `.gjc/specs/`에 스펙.
2. **ralplan** — CLI `board` 레인 계약 / SKILL Phase 1 통합 / 호스트 추상화 / 폴백 / 보안 설계, pending approval까지.
3. 승인 후 구현 + 테스트(보드 HTML inert 단언 + 폴백 경로 + 차원별 렌더 픽스처).
