# RALPLAN Consensus Plan: design-interview 에셋 우선(asset-first) 개편

## Status
- **pending approval** — 실행은 별도 명시 승인 필요. 본 단계는 계획 확정까지.
- run-id: `2026-06-14-asset-first` · mode: deliberate
- 정본 스펙: `.gjc/specs/deep-interview-asset-first-pipeline.md`
- 상세 구현 디테일(정본): `.gjc/plans/ralplan/2026-06-14-asset-first/stage-02-revision.md`

## 합의 트레일 (consensus)
- stage-01: planner → architect **WATCH/REQUEST CHANGES**(F1 강제 메커니즘 수학적 거짓, F2 크롤 바이너리 미구현) → critic **ITERATE**(required_fixes 5: P0/F1, P0/F2, P1 exit0, P1/F3, P2/F5)
- stage-02: revision(5건 전부 코드근거 반영) → architect **CLEAR/APPROVE** → critic **APPROVE**
- 합의 도달(iteration 2). 잔여 NF1/NF2는 비차단(실행시 해소).

## ADR
### Decision
에셋 우선을 두 축으로 구현한다: **(1) 인터뷰 must-answer 규율 + concept-sheet 에셋 계획 섹션 non-empty 머신 신호**(강제 지점), **(2) 독립 advisory `assets [dir]` CLI(always exit 0)**. S4는 소스 불문 재정의, S2(실재 날조) 하드라인 유지. **새 Phase 없음, 점수 모델 불변.**

### Decision Drivers
1. 빌드 비차단(advisory exit 0) — M9 양성 철학 정합.
2. 'first' 강제는 점수로 불가(F1, 코드검증: interview.md brand 가중 0.10·임계 0.80(총점)이라 audience+mood+structure+conversion=0.20×4=0.80으로 brand=0이어도 Phase 2 통과, `--quick`은 brand 제외) → 인터뷰 규율 + 머신 신호로 확보.
3. 보안 불변(SSRF/inert/단일HTML/런타임0) + 회귀 0.

### Alternatives Considered
- **Opt B**(assets 검사를 audit advisory 채널 흡수) — 기각: 파일(audit) vs 디렉터리(assets) 입력 모델 충돌 + audit는 fail시 exit 1이라 advisory-only exit 0 계약 오염.
- **Opt C**(brand 가중치 격상으로 sourcing plan 강제) — 기각(F1 치명, 코드검증): 점수 산식상 brand 격상으로 '건너뛸 수 없게'를 보장 불가.
- **Opt D**(새 Phase 2.5 Asset Lock 신설) — 기각: 스펙 Non-Goal('새 Phase 신설 안 함') 위반.

### Why Chosen (Opt A)
새 Phase 0·기존 흐름 보존; assets CLI가 audit와 분리돼 exit 0 단순; 이중채점 없음; 점수 모델 미변경으로 명료도 임계 회귀 0; 스펙 토폴로지(asset-cli active)와 1:1.

### Consequences
- 강제가 인터뷰 규율 + 문서 머신 신호에 의존(사문화 리스크) → premortem #1 완화: must-answer 미응답 시 Phase 2 진입 보류 + concept-sheet 빈 에셋 섹션 advisory를 Phase 5 납품 요약에 가시화.
- 신규 `fetchBinary`(바이너리 크롤) = intake.js SSRF/캡 가드 공유.
- `assets`는 always exit 0 → CI 차단 게이트로 사용 금지(blocking 필요 시 audit 레인).

### Follow-ups (비차단 — 실행 시 해소)
- **NF1**: `assets` CLI의 concept-sheet 탐색 경로/플래그 또는 관례 위치 정의 + AC1(c) 픽스처를 '시트-밖-경로'로 보강(프로덕션 머신신호 no-op 방지).
- **NF2**: `fetchBinary` 저장 규약(카테고리 dir + `.license.txt`) 1줄 명시.
- 실행 순서: 가드 공유 단위테스트·exit0 잠금테스트 우선 작성.

## 구현 범위 (파일별 요약 — 상세는 stage-02-revision.md §2)
- `core/interview.md` — brand 차원에 '에셋 must-answer 규율' 단락(concept lock 전 에셋 질문 1회 필수·sourcing plan 응답 기록). **가중 0.10·임계 0.80·--quick 차원 집합 불변.**
- `templates/concept-sheet.md` — '에셋 계획(Sourcing Plan)' 섹션(asset-type×경로×source/license). 빈 섹션 = advisory 머신 신호.
- `core/asset-library.md` — 소싱 4경로 / 크롤 절차(consent+가드) / sidecar source 필드 / S4 재정의 / 에셋 검사 CLI / 번들 샘플.
- `core/design-tells.md` — S4 재정의(소스 불문, 게으른/범용 금지; AI생성 sidecar source 명시 시 합법) + S2 가짜-실재 최종 판정 = LLM 레인 단일 권위.
- `src/cli.js` — `assets [dir] [--json]` 서브커맨드 배선, **무조건 exit 0**(입력오류만 exit 2).
- `src/assets.js` (신규, Pure ESM, best-effort) — auditAssets/classifyKind/parseSidecar/detectFabrication/formatAssetReport. 검사 3종: 종류별 개수·sidecar 누락·가짜-실재 의심(advisory 표시만).
- `src/intake.js` — `fetchBinary`(assertSafeUrl·guardedLookup·5MB/30s 캡 공유, 본문만 Buffer 분기). 스크린샷은 기존 `shot` 재사용.
- `assets/samples/` (신규) — CC0/자작 스타터 + 각 `.license.txt`.
- `tests/unit/assets.test.js` + `tests/fixtures/assets/` (신규) — node:test.

## Acceptance Criteria
- **AC1** (F1): 점수 강제 주장 삭제. (a) interview.md에 에셋 must-answer 규율 문구 존재 (b) concept-sheet에 에셋 계획 섹션 존재 (c) assets CLI가 에셋 섹션 빈/없음 입력에서 advisory 경고. brand 가중 0.10·임계 0.80·--quick 차원 집합 불변(회귀 테스트).
- **AC2**: cli assets가 0-에셋 디렉터리에서 exit 0; concept-sheet에 에셋 계획 섹션 존재.
- **AC3**: `node src/cli.js assets [fixture]`가 counts·missingSidecar·suspect 3종 출력 + exit 0; assets.test.js green.
- **AC4**: design-tells.md S4가 '소스 불문 게으른/범용 금지' + 'AI생성 sidecar source 합법'으로 갱신.
- **AC5**: detectFabrication이 가짜 로고/스크린샷/데이터 픽스처에서 suspect 반환; 명목적 근거 시 음성; 문서에 S2 하드라인 + 'LLM 레인 단일 판정 권위' 명문.
- **AC6** (F2): 크롤 절차 문서에 (a)스크린샷=기존 shot 재사용 (b)바이너리=동일 SSRF/캡 가드 공유 fetchBinary로 정의 + consent 프롬프트 + provenance sidecar. fetchBinary 가드 공유 단위 테스트 green, intake 기존 가드 회귀 green.
- **AC7**: assets/samples/ 존재 + 각 파일 .license.txt 동반.
- **AC8**: asset-library.md 4경로·source·번들·CLI·크롤절차 반영; npm test green(회귀 0).
- **AC9** (F-P1/F5): assets CLI exit 계약 잠금 — suspect>0·missing>0에서도 exit 0; 입력오류만 exit 2(테스트 고정). 문서에 'CI 차단 게이트 금지' 명시.

## Pre-mortem (5) — 상세 stage-02-revision.md §5
1. advisory 무시 → 에셋-우선 사문화 / 완화: must-answer 보류 + 빈 섹션 advisory 납품요약 가시화.
2. S4 재정의 오독 → 슬롭 범람 / 완화: 게으른·범용 판정 기준 + S2 하드라인 + S4 LLM 레인 잔류.
3. 크롤 consent 우회/SSRF / 완화: 가드 공유 + consent 필수 + 결과 sidecar.
4. 가짜-실재 휴리스틱 오탐 / 완화: advisory 표시만·근거 시 제외·최종 LLM 판정.
5. assets exit 0의 CI 게이트 오용 / 완화: 문서·푸터에 차단 게이트 금지 명시.

## 확장 테스트 (5레인) — 상세 §6
unit(classifyKind/parseSidecar/detectFabrication/auditAssets) · integration(cli assets text·JSON + **exit0 계약 + 기존 회귀**) · e2e(인터뷰 must-answer→concept-sheet→build→assets advisory 스모크) · observability(리포트 스냅샷·exit 계약) · 크롤(fetchBinary 가드 공유 단위).

## Handoff (실행은 별도 승인 후)
- 기본 실행: `/skill:ultragoal`. executor 3슬라이스: (1) src/assets.js + cli 배선 + exit 계약 tests, (2) 문서 4종 + concept-sheet, (3) assets/samples/ + intake.js fetchBinary + 가드 테스트.
- **승인 전 제품 코드/문서 수정·커밋·delegation 금지.**
