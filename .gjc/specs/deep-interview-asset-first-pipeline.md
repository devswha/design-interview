# Deep Interview Spec: design-interview 에셋 우선(asset-first) 파이프라인 개편

## Metadata
- Interview ID: 3b47a1a3-1bb7-4342-91e5-a604a0cc150f
- Rounds: 8
- Final Ambiguity Score: 38%
- Type: brownfield
- Generated: 2026-06-14
- Threshold: 0.05
- Threshold Source: default
- Initial Context Summarized: no
- Status: BELOW_THRESHOLD_EARLY_EXIT (핵심 결정 완료, 세부 합격기준은 ralplan으로 위임)
- Auto-Researched Rounds: []
- Auto-Answered Rounds: []
- Architect Failures: 0

## Clarity Breakdown
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|----------|
| Goal Clarity | 0.70 | 0.35 | 0.245 |
| Constraint Clarity | 0.65 | 0.25 | 0.163 |
| Success Criteria | 0.45 | 0.25 | 0.113 |
| Context Clarity | 0.65 | 0.15 | 0.098 |
| **Total Clarity** | | | **0.618** |
| **Ambiguity** | | | **0.382** |

## Topology
| Component | Status | Description | Coverage / Deferral Note |
|-----------|--------|-------------|--------------------------|
| asset-gate | active | 디자인(빌드) 전, **기존 인터뷰 단계 안에서** 에셋을 해결. 새 Phase 신설 없음. | R1·R4·R5·R6 — 흐름·차단력·0개 처리 합의 |
| sourcing-policy | active | 에셋 구하는 4경로 + 가드(S4 재정의·S2 하드라인·sidecar source). | R2·R3 — 라우팅·S4/S2 합의 |
| crawl-collect | active | consent-gated 웹 수집(허락 시만), 기존 SSRF 가드 재사용. | R7 — consent 합의 |
| asset-cli | active | 결정론 검사기(advisory): 개수·sidecar 누락·가짜-실재 의심. | R6·R8 — 검사 3종 확정 |

## Goal
design-interview를 **에셋 우선** 파이프라인으로 개편한다. 디자인(Phase 3 build)을 시작하기 전에, **기존 인터뷰 단계 안에서** 에셋을 반드시 해결한다 — ① "에셋 있어요?"를 먼저 묻고 ② 있으면 폴더 경로를 받고 ③ 없으면 생성·번들 샘플을 쓰고 ④ 실제 로고·스크린샷처럼 만들 수 없는 건 사용자 허락을 받아 웹에서 가져온다. 강제는 **파일이 아니라 "어떻게 구할지 계획(sourcing plan)"**의 선택이며, 0개여도 빌드를 막지 않는다. 결정론 도구는 에셋을 **advisory로만** 검사한다(절대 차단하지 않음, exit 0). 이미지의 "AI 티"는 소스(AI생성/스톡/실사)가 아니라 **품질·의도**이므로 S4를 소스 불문 "게으른/범용/안 어울리는 이미지 금지"로 재정의하고, **실재를 거짓 주장하는 에셋 날조(가짜 로고/스크린샷/데이터) 금지(S2)**는 하드라인으로 유지한다.

## Constraints
- 단일 HTML·신규 런타임 의존 0 불변(에셋은 자가호스팅/인라인, CDN 런타임 의존 금지).
- 에셋 사유로 **빌드를 하드 블록하지 않는다** — 도구·게이트는 advisory(exit 0)만.
- "에셋 first"의 강제 지점은 **인터뷰** — sourcing plan 선택을 건너뛸 수 없게 한다(필수). 단 "계획"이 통과 조건이지 "파일 존재"가 아니다.
- **S4 재정의(소스 불문)**: AI생성(codex CLI/ChatGPT image)·스톡·실사 무관. 금지는 게으른/범용/디폴트/안 어울리는 이미지(슬롭 룩). 의도적·아트디렉션·통합이면 합법.
- **S2 하드라인(불변)**: 실재를 거짓 주장하는 에셋 날조 금지 — 가짜 브랜드 로고를 고객/파트너인 양, 가짜 스크린샷, 가짜 데이터/차트.
- **sidecar 필수**: 모든 에셋은 `*.license.txt`에 진짜 source(AI생성 포함)·license 기록. sidecar 없는 에셋은 빌드 사용 금지.
- **크롤은 consent-gated**: 사용자 명시 허락 후에만, 기존 `src/intake.js`의 SSRF 가드(assertSafeUrl, 리다이렉트 재검증, 5MB/30s 캡) 통과.
- claim 보존, inert preview, Pure ESM, node:test, 한국어 문서·영어 식별자 유지.

## Non-Goals
- 에셋 사유의 빌드 하드 블록(차단) — 하지 않음.
- 무허락 자동 웹 크롤/스크래핑 — 하지 않음(consent 필수).
- AI 생성 이미지 전면 금지 — 하지 않음(S4 재정의로 합법화).
- 새 파이프라인 Phase 신설 — 하지 않음(기존 인터뷰에 통합).
- 이중 채점(machine/LLM 같은 항목 중복) — 하지 않음.

## Acceptance Criteria
- [ ] 인터뷰가 concept lock(Phase 2) 전에 에셋 질문을 반드시 제시한다(보유? → 경로 / 생성 / 샘플 / 크롤). `core/interview.md`의 brand 차원이 이 해결을 포함하도록 갱신된다.
- [ ] 에셋 0개 입력에서도 빌드가 진행된다(하드 블록 없음). 단 sourcing plan(4경로 중 하나)이 concept sheet의 에셋 계획 섹션에 기록된다 — 이 섹션이 비면 advisory 경고.
- [ ] 새 CLI 명령(예: `node src/cli.js assets <dir>`)이 ① 종류별 개수(logo/image/texture/font) ② sidecar 누락 목록 ③ 가짜-실재 의심 목록을 출력하고 **exit 0**(advisory). node:test로 픽스처 검증.
- [ ] `core/design-tells.md`의 S4가 "소스 불문, 게으른/범용 이미지 금지"로 갱신된다. AI생성 이미지는 sidecar에 `source` 명시 시 합법.
- [ ] S2: 가짜 로고/스크린샷/데이터를 실재처럼 쓰는 경우 CLI가 휴리스틱으로 의심 표시 + 문서 하드라인 명문화.
- [ ] 크롤은 사용자 허락 프롬프트 후에만 실행되고, 기존 SSRF 가드를 통과하며, 결과 에셋에 provenance/license sidecar를 남긴다.
- [ ] 번들 샘플 에셋 세트가 스킬에 포함되고(예: `assets/samples/`) 각 파일에 sidecar(CC0/자작) 동반.
- [ ] `core/asset-library.md`가 4경로·sidecar source 필드·S4 재정의·번들 샘플·CLI 검사를 반영하도록 갱신된다.
- [ ] 단일 HTML·런타임 0 불변 유지, 기존 intake/preview/audit/shot 회귀 없음(npm test green).

## Assumptions Exposed & Resolved
| Assumption | Challenge | Resolution |
|------------|-----------|------------|
| 에셋 게이트는 빌드를 막는 하드 블록일 것 | advisory가 양성 철학(M9)에 맞지 않나? | advisory only — 절대 차단 안 함(R1) |
| advisory면 무엇이 "first"를 강제하나 | 0개면 그냥 진행? | 인터뷰가 sourcing plan 선택을 강제(파일 아닌 계획), 0개여도 진행(R4·R5) |
| AI 생성 이미지는 S4 위반(AI 티) | 디자이너도 AI/사진을 적절히 쓴다 | 티는 소스가 아니라 품질·의도 → S4 소스 불문 재정의, S2 날조만 하드라인(R3) |
| 에셋 first면 새 Phase가 필요 | 새 단계 없이 기존 인터뷰로 충분? | 새 Phase 없음 — 기존 인터뷰에 통합(R4) |
| 크롤(웹 수집)이 핵심 경로 | 없으면 생성+샘플이면 충분한데 | 크롤은 consent-gated 보조 경로(허락 시만), 실재-only 에셋용(R7) |
| 번들 샘플은 nice-to-have | 0개 처리에 필요 | 번들 샘플 IN 확정(R6) |
| 도구가 광범위 검사 | 단순함 우선 | 3종(개수/sidecar 누락/가짜-실재 의심) advisory(R8) |

## Technical Context
- 기존 파이프라인: Phase 0 intake → 1 interview → 2 concept lock → 3 build → 4 shot 자기검수 → 5 audit/deliver (`SKILL.md`).
- `src/cli.js` 서브커맨드: `intake | preview | audit | shot` — 에셋 전용 명령 부재. 신규 `assets` 서브커맨드(advisory) 추가 대상.
- `src/intake.js`: SSRF 가드(assertSafeUrl, 스킴/호스트/DNS, 리다이렉트 hop 재검증, 5MB/30s) — consent-gated 크롤이 재사용.
- `core/asset-library.md`: sidecar 규칙·자가호스팅·S4 금지·images/ 카테고리(2026-06-14 확장). 4경로·source 필드·번들 샘플 반영 대상.
- `core/design-tells.md` S4: 현 "stock/undraw/생성 금지" → "소스 불문 게으른/범용 이미지 금지"로 재정의 대상.
- `core/interview.md` brand 차원(가중치 0.10): 에셋 보유/경로/소싱 plan 해결을 포함하도록 격상 대상.
- audit 2채널(blocking/advisory) 구조 — 에셋 검사는 advisory 채널.

## Ontology (Key Entities)
| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| AssetGate | core domain | advisory only | = 인터뷰 단계(새 Phase 아님) |
| InterviewAssetQuestion | core domain | have? → path / generate / samples / crawl | 디자인 전 필수 |
| SourcingPlan | core domain | path \| generate \| samples \| crawl (per asset) | 게이트 통과 조건(파일 아님) |
| SourcingPath | core domain | create \| crawl \| generate \| samples | source-agnostic |
| AIGeneration | external system | codex CLI / ChatGPT image | art-directed면 합법 SourcingPath |
| ConsentGatedCrawl | core domain | ask first, SSRF guard, provenance | 실재-only 에셋용 |
| BundledSampleAsset | core domain | starter set shipped | no-asset 경로 |
| GenericnessTell | core domain | lazy / default / ill-fit | 재정의된 S4(소스 불문) |
| S2Fabrication | core domain | fake logo / screenshot / data | 하드라인(사기) |
| Asset | core domain | source, license, sidecar | — |
| Sidecar | supporting | license, source(AI 포함), date | annotates Asset |

## Ontology Convergence
| Round | Entity Count | Stability Ratio |
|-------|-------------|----------------|
| 1 | 5 | N/A |
| 2 | 7 | 0.57 |
| 3 | 9 | 0.78 |
| 4 | 9 | 0.82 |
| 5 | 9 | 0.85 |
| 6 | 8 | 0.88 |
| 7 | 8 | 0.92 |
| 8 | 8 | 0.95 |

## Interview Transcript
<details>
<summary>Full Q&A (8 rounds)</summary>

### Round 0 — Topology
**Q:** 최상위 컴포넌트 3개로 읽음(게이트/정책/CLI), 맞나? 크롤을 분리할까?
**A:** 크롤/수집을 별도 4번째 컴포넌트로 분리.

### Round 1 — asset-gate / goal
**Q:** 에셋 부족 시 게이트의 차단 강도는?
**A:** 경고만 — 항상 진행 가능, advisory로만 기록(하드블록 아님).
**Ambiguity:** 77%

### Round 2 — sourcing-policy / goal
**Q:** create-vs-crawl 주 결정 기준은?
**A:** 기본=에셋 실재성으로 라우팅(실재→크롤/수집, 추상→자작). 추가① codex CLI ChatGPT 이미지 생성도 경로. 추가② 번들 샘플 에셋.
**Ambiguity:** 73%

### Round 3 — sourcing-policy / constraints (contrarian)
**Q:** AI 생성 이미지의 허용 경계는?(S4 충돌)
**A:** 전제 반박 — AI 생성=AI 티 아님. 티는 품질·의도. S4를 소스 불문 재정의, S2(날조)만 하드라인. sidecar에 source 기록.
**Ambiguity:** 73%

### Round 4 — asset-gate / placement (contrarian)
**Q:** 에셋을 '디자인 전에 챙기는' 자리는?
**A:** 새 Phase 없음 — 기존 인터뷰 단계에서 디자인 전 에셋 질문 필수.
**Ambiguity:** 72%

### Round 5 — asset-gate / constraints
**Q:** 에셋이 0개일 때는?
**A:** 안 막음. 인터뷰가 sourcing plan(만들기/AI생성/수집) 선택을 강제 → 정하면 진행. '파일'이 아니라 '계획'이 통과조건.
**Ambiguity:** 72%

### Round 6 — flow
**Q:** 도구가 뭘 검사? (→ 흐름으로 답)
**A:** ①에셋 있는지 먼저 물음 ②있으면 폴더 경로 ③없으면 생성+샘플(번들). 번들 샘플 IN.
**Ambiguity:** 71%

### Round 7 — crawl-collect / goal
**Q:** 웹 자동 수집(크롤)은?
**A:** 사용자에게 물어보고 허락하면 긁어옴(consent-gated). intake+shot SSRF 가드 재사용.
**Ambiguity:** 62%

### Round 8 — asset-cli / constraints
**Q:** 도구 검사 범위 확정?
**A:** 3종이면 충분 — ①개수(종류별) ②sidecar 누락 ③가짜-실재 의심. advisory only.
**Ambiguity:** 38%

</details>
