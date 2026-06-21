# Deep Interview Spec: 시각 인터뷰 (visual interview) 보드

## Metadata
- Interview ID: fb8771cb-65c4-4712-942b-77ea5ca9b06c
- Rounds: 6 (+ Round 0 토폴로지 게이트)
- Final Ambiguity Score: 23%
- Type: brownfield
- Generated: 2026-06-19
- Threshold: 0.05
- Threshold Source: default
- Initial Context Summarized: no
- Status: BELOW_THRESHOLD_EARLY_EXIT (핵심 의도 결정 완료; 잔여는 경험적·아키텍처 → ralplan)
- Auto-Researched Rounds: []
- Auto-Answered Rounds: []
- Architect Failures: 0
- Lateral Reviews: 2 (R3 initial→progress 4인, R5 progress→refined 3인)
- Lateral Panel Failures: 0
- Refined Rounds: [2, 3]
- Closure Overrides: none
- Restated Goal: 인터뷰가 객관식 질문을 던질 때, 브라우저가 열리는 호스트(1차 Codex)에서는 preview.js의 inert 보안 모델을 재사용한 새 결정론 board CLI 레인이 만든 단일 고정 대시보드로 각 선택지를 차원별 제한된 시각(색 스와치/구조 와이어/무드 칩/CTA 표본/실제 파일 썸네일)으로 보여주고 추천을 절제되게 강조하되, 답은 항상 채팅 질문으로 받고, 브라우저가 없으면 현행 텍스트 선택지로 폴백한다.

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.85 | 0.35 | 0.297 |
| Constraint Clarity | 0.78 | 0.25 | 0.195 |
| Success Criteria | 0.7 | 0.25 | 0.175 |
| Context Clarity | 0.7 | 0.15 | 0.105 |
| **Total Clarity** | | | **0.772** |
| **Ambiguity** | | | **0.228** |

> 전역 점수 = 활성 컴포넌트 3개의 차원별 최솟값(min-aggregation) — 강한 컴포넌트가 약한 형제를 가리지 못하게.

## Topology
| Component | Status | Description | Coverage / Deferral Note |
|-----------|--------|-------------|--------------------------|
| board-lane (보드 생성 레인) | active | node src/cli.js board <options.json> [--out] → inert option-board.html. 차원별 시각 카드 그리드 + 추천 | R1·R3·R4·R6. goal/constraints/criteria 모두 강함. |
| host-display (호스트 표시 추상화) | active | 브라우저/프리뷰 표면 감지 + Codex 브라우저·GJC browser 툴·Claude artifact 단일 인터페이스 보드 열기, 무표면이면 텍스트 폴백(열린질 | R2(Codex-first+seam). goal 강함; criteria/context는 Codex 실동작 의존(ralplan 드라이런). |
| skill-integration (SKILL Phase 1 통합) | active | 보드 생성·열기 시점, AskUserQuestion과 나란히 던지기, 점수 갱신 시 라이브 갱신 여부·빈도, 한번에 질문하나 리듬 보존(열린질문 4·6) | R3(대시보드 생애주기)·R5(open 정책). goal/constraints 강함; context는 Codex 의존. |

## Established Facts
- (R1, confirmed) board 시각 콘텐츠 = 하이브리드 소스: palette/structure/mood는 인라인 생성, reference 스크린샷·사용자 asset은 실제 파일을 data: URI로 임베드. 생성 목업 S6/S4 가드, 실재 생성 금지(S2). — _근거: R1_
- (R2, confirmed) host-display: 1차 구현은 현재 Codex app만. host-agnostic 원칙·어댑터 seam은 유지(하드코딩 금지), GJC browser·Claude artifact는 deferral(점진 확장). 보드는 Codex에 best-effort open + 글자 질문은 항상 던짐 + 실패/비-Codex면 글자 폴백. inert라 입력 불가. — _근거: R2_
- (R3, confirmed) 단일 고정 대시보드: 같은 파일 경로를 매 라운드 덮어쓰고 best-effort 재열기/리로드, 단일 창. 라운드당 1회 생성(리듬 보존). 질문마다 선택지 샘플만 표시; 점수·진행도는 글자 리포트. — _근거: R3_
- (R3, confirmed) '최종 결과 미리보기'(누적 디자인 프리뷰)는 deferred — 이번 board-lane은 선택지 시각만. — _근거: R3_
- (R3, confirmed) board CLI는 판단 없는 HTML serializer: options.json 검증 → inert HTML 생성 → 고정 경로 atomic overwrite(temp+rename)+stale 마커(boardId/roundId/generatedAt). 점수·추천 산출·호스트 감지·입력은 스킬/호스트 레이어. preview.js는 sanitize/CSP(INERT_CSP)만 공유, board 빌더는 별도 모듈. (패널 권고, ralplan 확정) — _근거: R3 lateral panel_
- (R3, confirmed) board는 인터뷰 보조 artifact(제품 HTML 아님) — 컴셉트 락 전 제품 HTML 생성 금지 약속과 무관. 추천 강조는 작은 배지+근거 한 줄, recommendation nullable, 사용자 선택이 항상 이김(interview.md 수렴금지). — _근거: R3 lateral panel_
- (R4, confirmed) visual.type 판별 유니온 잠김: palette=swatches, structure=추상 우선순위 wire-blocks, mood=color/type/texture chips(2~3), conversion=cta-sample/text(퍼널·화살표 S6 금지), reference=real screenshot file thumbnail, asset=real asset file thumbnail, plain=text(audience·폴백·파일없음). reference/asset은 실제 파일+sidecar data:URI만, 없으면 텍스트 카드로 강등(생성 금지). — _근거: R4_
- (R5, confirmed) 보드 열기 정책: 첫 라운드에 한 번 best-effort open, 이후엔 같은 경로를 조용히 덮어쓰기만(재열기 안 함). HTML에 stale 마커(boardId/roundId/generatedAt) 표시로 최신 여부 가시화. 포커스 탈취·깜박임 회피, 한번에 질문 하나 리듬 보존. — _근거: R5_
- (R5, confirmed) 보드 UX 계약: 보드는 참고용 시각 포스터, 답은 항상 채팅 질문(AskUserQuestion)으로 선택. 카드 번호=질문 번호 동기화, "직접 입력/없음" 카드도 동등 가시성. — _근거: R5 패널_
- (R5, confirmed) 샘플 사실성: 실제 파일+source 있는 reference/asset만 "실물" 썸네일. 생성 chip/wire/cta-sample은 추상+placeholder 라벨로 "영감/추정"임을 표시(약속으로 오해 금지). — _근거: R5 패널_
- (R5, confirmed) 잔여 모호도(~23%)는 순수 경험적(Codex open/reload 드라이런, data-image MIME·크기 실측)+아키텍처 디테일(options.json 스키마, exit 코드 매트릭스, INERT_CSP export, atomic write/stale)이며 ralplan/구현 차원 — 인터뷰로 임계값까지 못 내린다. — _근거: R5 패널_
- (R6, confirmed) 추천 강조 정책: 절제된 강조 — 작은 동급 배지(예 '추천 ❯')+근거 한 줄만. 카드 크기·색·위치 우위 금지, preselect 금지, '직접입력/없음' 카드 동등 가시, 추천 채택률은 성공지표 아님. interview.md 수렴금지 준수 + recommend는 '의견'으로만 강화. — _근거: R6_

## Trigger Metadata
- R1 [없음] status=none | board-lane/goal 0→0.65 | amb 1→0.715. 
- R2 [없음] status=none(host-agnostic 원칙 보존, 출시 순서 결정) | host-display/goal 0.4→0.8 | amb 0.715→0.628. 
- R3 [D] status=contained_by_deferral | board-lane/goal 0.65→0.68 | amb 0.628→0.429. D(범위확장)가 발생했으나 사용자가 즉시 deferral로 가둢 — 활성 범위가 넘치지 않아 순 명료도 상승. 그래서 amb 하락 정당.
- R4 [없음] status=none | board-lane/criteria 0.45→0.8 | amb 0.429→0.302. 
- R5 [없음] status=none | skill-integration/context 0.62→0.75 | amb 0.302→0.228. 
- R6 [없음] status=none(패널 제기 긴장 당라운드 해소) | board-lane/constraints 0.82→0.88 | amb 0.228→0.228. 

## Lateral Review Panel
- R3 (initial->progress) — researcher, contrarian, simplifier, architect: 병목=options.json typed schema(visual.type 판별 유니온); 시각 매핑은 design-tells(S6/S4/C1/L1) 생산 위험 → 차원별 허용 프리미티브 제한; reference/asset=실제 파일+sidecar data:URI만(생성 금지 S2); 단일 경로 atomic write(temp+rename)+stale 마커; preview.js는 sanitize/CSP만 공유, board 빌더 별도; host seam=CLI 밖 best-effort renderBoard/openBoard(Codex 1차); 추천 강조는 작은 배지+근거 nullable; board=인터뷰 보조 artifact; 리듬 리스크는 Codex 드라이런 검증 항목.
- R5 (progress->refined) — researcher, contrarian, simplifier: contrarian: 추천 시각강조 vs interview.md 수렴금지 긴장 → R6 질문. UX 계약(보드=참고/답은 채팅)·샘플 placeholder 라벨·차원 폭(R4 균형)은 제약으로 fold. researcher/simplifier: 잔여는 경험적(Codex 드라이런)+아키텍처(ralplan).

## Goal
인터뷰가 객관식 질문을 던질 때, 브라우저가 열리는 호스트(1차 Codex)에서는 preview.js의 inert 보안 모델을 재사용한 새 결정론 board CLI 레인이 만든 단일 고정 대시보드로 각 선택지를 차원별 제한된 시각(색 스와치/구조 와이어/무드 칩/CTA 표본/실제 파일 썸네일)으로 보여주고 추천을 절제되게 강조하되, 답은 항상 채팅 질문으로 받고, 브라우저가 없으면 현행 텍스트 선택지로 폴백한다.

## Constraints
- 단일 HTML·신규 런타임 의존 0; 보드는 inert(무스크립트)·자가호스팅/인라인·원격 리소스 차단(CSP script-src none, img-src data:).
- 두 레이어: board CLI는 판단 없는 HTML serializer만; 점수·추천 산출·호스트 감지/열기·입력은 스킬/호스트 레이어.
- preview.js의 sanitize/CSP만 공유(INERT_CSP export 또는 inert-html 모듈 분리), board 빌더는 별도 모듈.
- exit 규율(입력오류 2 / fail 1) + Pure ESM + node:test 준수; 고정 경로 atomic write(temp+rename)+stale 마커.
- 쉬운 말 규율·recommend 수렴 금지·design-tells(S2/S4/S6/C1/L1) 회피 유지.
- 한국어 문서·영어 식별자.

## Non-Goals
- 보드를 입력/선택 UI로 만들기 (inert, 답은 항상 채팅 질문).
- 없는 reference 스크린샷·로고·에셋 생성 (S2 가짜-실재 금지).
- 노드-선/박스-선 다이어그램 등 design-tells 시각 생성.
- 최종 결과(누적 디자인) 미리보기 (deferred).
- GJC browser·Claude artifact 어댑터 실제 구현 (deferred, seam만).
- 매 라운드 보드 재열기 (포커스 탈취 회피 — open-once).
- Codex 전용 하드코딩 (host-agnostic seam 유지).

## Acceptance Criteria
- [ ] node src/cli.js board <options.json> [--out <file>] 레인 추가: options.json 검증 → inert HTML 생성 → 고정 경로 atomic write. exit: 입력/스키마/없는 asset/쓰기불가=2, 렌더러 invariant 실패=1. node:test 픽스처.
- [ ] 생성 HTML inert 단언: script·이벤트핸들러·javascript:·base·iframe srcdoc·meta refresh·원격 link/img 차단, CSP script-src none / img-src data:. preview.js sanitize/CSP 공유.
- [ ] visual.type 판별 유니온별 렌더 픽스처: palette=swatches, structure=추상 wire, mood=color/type/texture chips, conversion=cta-sample/text, reference·asset=실제 파일 data:URI 썸네일, plain=text.
- [ ] anti-tell 리뷰 케이스: 생성 시각이 S6(노드-선)·C1(그라데이션)·L1(균일 3열)·S2/S4(가짜·범용)를 만들지 않음을 픽스처로 단언.
- [ ] reference·asset은 실제 파일+sidecar 있을 때만 썸네일, 없으면 텍스트 카드 강등(가짜 생성 0). data-image 예산(MIME 화이트리스트·최대 바이트·썸네일 파생).
- [ ] 추천 카드는 작은 동급 배지+근거 한 줄만; 크기·색·위치 우위·preselect 없음; 직접입력/없음 카드 동등 가시성; 채택률 비-지표.
- [ ] 단일 고정 대시보드: 같은 경로 라운드당 1회 재생성, 첫 라운드 1회 best-effort open, 이후 overwrite-only + stale 마커(boardId/roundId/generatedAt).
- [ ] host-display seam: renderBoard(optionsPath,outPath) + openBoard(path)->{opened,reason}. Codex 1차 어댑터; openBoard 실패는 예외 아님; 텍스트 질문은 항상 같은 턴 제출; GJC/Claude는 같은 인터페이스 뒤 deferred.
- [ ] 무브라우저/실패 호스트는 현행 텍스트 선택지 폴백(보드 없이 정상 동작).

## Deferrals
- (host-display) GJC browser·Claude artifact 어댑터는 점진 확장으로 이번 범위 밖. 이번은 Codex 어댑터 + host-agnostic seam + 텍스트 폴백만 구현.
- (board-lane) '최종 결과 미리보기'(누적 디자인 프리뷰)는 이번 범위 밖, 나중으로. 이번은 선택지 샘플만 표시.
- Convergence Pacing: min-round floor·score-drop cap·confidence dampening 등 명시적 페이싱 브레이크 추가하지 않음 — 양방향 점수화가 페이싱 메커니즘.
- 잔여 모호도(~23%)는 경험적(Codex open/reload 드라이런, data-image 실측) + 아키텍처(options.json 스키마, exit 매트릭스, INERT_CSP export, atomic write/stale) → ralplan/구현 차원.

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| host-agnostic 전면 동시 지원 | 지금 돌아가는 건 Codex뿐 | Codex 1차 + seam 유지, GJC/Claude deferred |
| 보드가 모든 선택지 시각을 즉석 생성 | reference·로고 생성은 S2 위반 | 하이브리드: 그릴 수 있는 건 생성, 실재는 실제 파일만 |
| 라운드마다 새 보드 파일 | 고정 대시보드가 더 일관적 | 단일 고정 경로, 라운드당 1회 재생성 |
| 보드 안에 최종 결과 미리보기 포함 | 인터뷰는 빌드 전이라 최종물 없음 | deferred — 이번엔 선택지 샘플만 |
| 매 라운드 재열기로 최신 유지 | Codex 포커스 탈취·깜박임 리듬 저해 | open-once + overwrite + stale 마커 |
| 추천을 강하게 시각 강조 | interview.md 수렴 금지 위반 | 절제된 강조 — 작은 배지+근거, 우위·preselect 금지 |

## Technical Context (brownfield)
- src/preview.js: PREVIEW_CSP(default-src none/img-src data/style unsafe-inline/font data/script none), stripActiveContent, dsiv- chrome(#dsiv-root), radio-hack 무스크립트 토글, buildPreviewHtml. → 보드는 sanitize/CSP만 공유, 빌더 별도.
- src/cli.js: 레인 디스패치 if(cmd===...)(intake|preview|audit|shot|assets|crawl), exit 2/1, ERR_PUPPETEER_MISSING만 폴백, MAX_INPUT_CHARS 5MB. → board는 preview 블록 앞 if(cmd===board).
- src/screenshot.js: captureFile(htmlPath)→file:/data: only, desktop/mobile fullPage PNG. reference URL 직접 캡처 미구현 → URL→sanitized 로컬 HTML→shot 또는 전용 lane(ralplan).
- assets/samples/: icons(wordmark-placeholder, placeholder-mark)·textures(dot-grid, paper-noise) + .license.txt sidecar.
- core/interview.md(6차원+recommend), core/design-tells.md(S6/S4/C1/L1), templates/concept-sheet.md(추천→선택 칸).

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| dashboard | core domain | html, inert, single-persistent, stable-path, atomic-write, stale-marker, cards | has many option-card, rebuilt per round |
| option-card | core domain | number, label, rationale, visual | belongs to dimension |
| visual-renderer | supporting | visual.type union: swatches|wire|moodChips|ctaSample|imageFile|plain | renders option-card |
| dimension | supporting | palette/mood/reference/structure/conversion/asset/audience | has options |
| host-surface | external system | Codex(1차)|GJC|Claude(deferred) | displays dashboard |
| host-adapter | supporting | seam, renderBoard(path), openBoard(path)->{opened,reason} | opens dashboard on host-surface |
| recommendation | supporting | number|null, rationale, badge | highlights option-card |

## Ontology Convergence
| Round | Entity Count | Stability Ratio | Note |
|-------|-------------|-----------------|------|
| 1 | 6 | N/A | R1 전부 신규 |
| 2 | 7 | 86% | R1 6개 전원 안정, host-adapter(seam) 1개 신규 → (6+0)/7=0.857 |
| 3 | 7 | 100% | option-board->dashboard 명칭 변경(changed, 개념 동일), 나머지 6개 안정, 신규 없음 → (6+1)/7=1.0 |
| 4 | 7 | 100% | 7개 전원 안정(visual.type는 visual-renderer 필드 세분화), 신규 없음 → 7/7=1.0 |
| 5 | 7 | 100% | 7개 전원 안정, 신규 없음 → 7/7=1.0 (3라운드 연속 수렴) |
| 6 | 7 | 100% | 7개 전원 안정, 신규 없음 → 7/7=1.0 (4라운드 연속 수렴) |

## Interview Transcript
<details>
<summary>Full Q&A (9 질문 라운드 + Round 0)</summary>

### Round 0 — topology
**Q:** Round 0 | 토폴로지 확정 | 모호도: 아직 점수화 안 함
**A:** (토폴로지 확정)

### Round 1 — render-source
**Q:** Round 1 | Component: board-lane | Targeting: Goal Clarity(이 기능의 핵심 목표) | Ambiguity: 100%
**A:** 1. 하이브리드
**Ambiguity:** 72%

### Round 2 — host-open-strategy
**Q:** Round 2 | Component: host-display | Targeting: Context Clarity(호스트와 어떻게 맞물리나) | Ambiguity: 72%
**A:** Codex app 1차 구현, host-agnostic seam 유지, GJC·Claude deferral; best-effort open + 항상 텍스트
**Ambiguity:** 63%

### Round 2 — refine-host
**Q:** Round 2 (답변 정리·확인) | Component: host-display
**A:** Codex app 1차 구현, host-agnostic seam 유지, GJC·Claude deferral; best-effort open + 항상 텍스트
**Ambiguity:** 63%

### Round 3 — board-lifecycle
**Q:** Round 3 | Component: skill-integration | Targeting: Success Criteria(어떻게 동작·검증하나) | Ambiguity: 63%
**A:** 단일 고정 대시보드(같은 경로 덮어쓰기+재열기), 질문마다 선택지 샘플만; 최종 결과 미리보기 deferred
**Ambiguity:** 43%

### Round 3 — refine-dashboard
**Q:** Round 3 (답변 정리·확인) | Component: skill-integration + board-lane
**A:** 단일 고정 대시보드(같은 경로 덮어쓰기+재열기), 질문마다 선택지 샘플만; 최종 결과 미리보기 deferred
**Ambiguity:** 43%

### Round 4 — visual-scope
**Q:** Round 4 | Component: board-lane | Targeting: Success Criteria(렌더 픽스처를 잡는 기준) | Ambiguity: 43%
**A:** 1. 균형 — palette/structure/mood/conversion 제한 프리미티브, reference/asset 실제 파일만
**Ambiguity:** 30%

### Round 5 — reopen-policy
**Q:** Round 5 | Component: skill-integration | Targeting: Context Clarity(리듬·호스트 동작) | Ambiguity: 30%
**A:** 1. 한 번 열고 이후 파일만 갱신(stale 마커)
**Ambiguity:** 23%

### Round 6 — recommend-emphasis
**Q:** Round 6 | Component: board-lane | Targeting: Constraint Clarity(추천 강조 경계) | Ambiguity: 23%
**A:** 1. 절제된 강조(작은 동급 배지+근거, 우위·preselect 금지, 채택률 비지표)
**Ambiguity:** 23%

### Round 7 — restate-gate
**Q:** 이 그림이 맞다면, 지금까지 고른 걸로 스펙 문서(설계서)를 만들고, 남은 세부는 다음 단계(ralplan)에서 다듬습니다.
**A:** 

</details>
