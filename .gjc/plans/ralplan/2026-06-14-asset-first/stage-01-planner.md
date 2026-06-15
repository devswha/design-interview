# design-interview 에셋 우선(asset-first) 개편 — 구현 계획 (planner)

정본 스펙: .gjc/specs/deep-interview-asset-first-pipeline.md (8R 합의, ambiguity 38%).

## 1. RALPLAN-DR 요약

### Principles
1. Advisory-first, never block — 에셋은 빌드를 절대 차단하지 않는다(exit 0). 인터뷰가 강제하는 것은 파일이 아니라 sourcing plan 선택.
2. Source-agnostic quality — '슬롭 룩'은 소스(AI/스톡/실사)가 아니라 품질·의도. S4는 소스 불문 재정의, S2(실재 날조)만 하드라인.
3. Provenance is mandatory — 모든 에셋은 sidecar에 진짜 source(AI생성 포함)+license 기록. sidecar 없으면 빌드 사용 금지.
4. Reuse, don't reinvent — 크롤은 기존 src/intake.js SSRF 가드 재사용, advisory 채널은 기존 audit 2채널 패턴 답습. 신규 런타임 의존 0.
5. No double scoring — assets CLI는 audit가 이미 보는 항목을 재채점하지 않는다. 별도 advisory 도구.

### Decision Drivers (top 3)
1. 빌드 비차단(advisory exit 0) 보장 — 양성 철학(M9) 정합성.
2. 인터뷰 단계에서 'first' 강제 지점 확보(새 Phase 금지) — brand 차원 격상 + concept-sheet 에셋 계획.
3. 보안 불변(SSRF/inert/단일HTML/런타임0) + 회귀 0.

### Viable Options
Opt A (채택) — 인터뷰 brand 차원 통합 + 독립 advisory assets CLI.
- pros: 새 Phase 0, 기존 흐름 보존; CLI가 audit와 분리돼 exit 0 보장 단순; 이중 채점 위험 없음; 스펙 토폴로지(asset-cli active)와 1:1.
- cons: 강제가 '계획'에 의존 → 인터뷰 규율 준수에 의존(사문화 리스크 → premortem #1로 완화).

Opt B (기각) — assets 검사를 기존 audit advisory 채널에 흡수.
- pros: 명령 1개로 통합.
- cons: audit는 built.html 단일 파일 입력인데 에셋 검사는 디렉터리 입력 → 입력 모델 충돌; audit advisory와 에셋 advisory 혼선; exit 계약(audit는 blocking 존재) 오염. → 입력 모델 불일치로 무효화.

Opt C (기각) — 새 Phase 2.5 'Asset Lock' 신설.
- cons: 스펙 Non-Goal('새 Phase 신설 안 함') 정면 위반. → 무효.

단일 옵션(A)로 수렴; B/C는 위처럼 명시 기각.

## 2. 파일별 구현 계획

### core/interview.md — brand 차원 격상
- brand 가중치 0.10 유지(가중치 변경은 명료도 임계 회귀 유발하므로 불변). 명료 기준(1.0)을 '자산 유무 확정 + 색/서체 확보'에서 → '에셋 sourcing plan 확정(보유경로/생성/번들샘플/크롤 중 택1, per asset-type)'으로 격상.
- '차원별 선택지 예시 > brand' 확장: 현행 색/서체/로고있음→첨부 / 로고만 / 전혀없음 → 4경로 라우팅: (1)폴더 경로 (2)생성(codex CLI ChatGPT image·자작 SVG) (3)번들 샘플(assets/samples/) (4)consent 크롤(실재-only). '직접입력/없음' 폴백 유지.
- '소스 선반영 규칙' 다음에 에셋 게이트 규칙 단락 추가: concept lock(Phase 2) 전 에셋 질문 필수, 0개여도 sourcing plan 택1이 통과조건(파일 아님), 빌드 비차단 명문화.
- 이유: AC 1·2 강제 지점. 인터페이스: 점수 산식·임계값 불변, 텍스트 규칙만 추가.

### templates/concept-sheet.md — 에셋 계획 섹션
- 토큰 커밋 표의 '에셋 선택' 행을 에셋 계획(Sourcing Plan)으로 확장: asset-type(logo/image/texture/font) x 경로(path|generate|samples|crawl) x source/license 메모.
- 이유: AC 2 — 빈 섹션이면 advisory 경고(=sourcing plan 미선택 신호).

### core/asset-library.md — 4경로·source·번들샘플·CLI 반영
- '수집 시점' 표 Phase 1 행에 sourcing plan 4경로 명시.
- 신규 절 '소싱 4경로': (1)사용자 폴더 경로 (2)생성(codex CLI ChatGPT image / 자작 SVG, sidecar source=AI생성:codex 등) (3)번들 샘플(assets/samples/) (4)consent-gated 크롤(intake.js assertSafeUrl 재사용, provenance sidecar 필수).
- sidecar 규칙에 source 필드 명문화(AI생성 포함 진짜 출처) + S2(실재 날조 금지) 하드라인.
- 'S4 stock-illustration 금지' 절을 S4 재정의(소스 불문, 게으른/범용/안 어울리는 이미지만 금지; AI생성도 sidecar source 명시 시 합법)로 갱신, images/ 카테고리 'undraw/스톡/생성 금지' 문구 정정.
- 신규 절 '에셋 검사 CLI': node src/cli.js assets [dir] 사용법·출력·exit 0 advisory.
- 신규 절 '번들 샘플': assets/samples/ 구성·각 파일 CC0/자작 sidecar.

### core/design-tells.md — S4 재정의
- S4 stock-illustration → S4 generic-image: '소스 불문 — 게으른/범용/디폴트/안 어울리는 이미지(슬롭 룩) 금지. AI생성·스톡·실사 무관, sidecar source 명시 + 아트디렉션·통합이면 합법.'
- 감사 분류표 LLM 레인의 S4 의미 갱신(여전히 LLM 레인, 기계 비승격). S1/S2 하드라인 유지.
- 이유: AC 4.

### src/cli.js — assets 서브커맨드 배선
- usage()에 'assets [dir] [--json]  # 에셋 advisory 검사 (exit 0)' 추가.
- 허용 커맨드 배열에 'assets' 추가: ['intake','preview','audit','shot','assets'].
- 분기(audit 패턴 참고): assets 분기에서 auditAssets(resolve(dir)) 호출, ENOENT/ENOTDIR은 fail(...,2)로 사용자 입력 오류, 결과는 json이면 JSON.stringify 아니면 formatAssetReport, 분기 끝 process.exit(0) 고정.
- 이유: AC 3. exit 0은 검사 결과와 무관하게 분기 끝 고정.

### src/assets.js (신규) — 검사 3종 (Pure ESM)
- auditAssets(dir) async — 디렉터리 재귀 스캔(node:fs/promises readdir withFileTypes). 반환 객체: dir, counts{logo,image,texture,font,other}, files[{path,kind,hasSidecar,source}], missingSidecar[path], suspectFabrication[{path,reason}], summary{total,missingSidecar,suspect}.
- classifyKind(relpath) — assets/ 카테고리+확장자로 logo|image|texture|font|other(icons/+로고형 파일명→logo, woff2/woff/ttf→font, textures/→texture, images/+래스터→image).
- parseSidecar(text) — *.license.txt에서 파일/라이선스/출처/source/수집일 키 파싱 → {license,source,...}, 누락 허용.
- detectFabrication(file,sidecar) — 3 신호: (1)알려진 브랜드 로고형 파일명 + sidecar에 명목적/trademark/주체 근거 없음 → logo-as-customer 의심(S2); (2)screenshot/dashboard 파일 + source=AI생성 → 가짜 스크린샷 의심; (3)chart/graph/data 파일 + source=AI생성 → 가짜 데이터 의심. 휴리스틱은 표시일 뿐 차단 아님.
- formatAssetReport(report,opts) — text: 종류별 개수 / sidecar 누락 목록 / 가짜-실재 의심 목록 / 'advisory only — exit 0' 푸터.
- 이유: AC 3·5.

### src/intake.js — 크롤 consent 재사용
- 코드 변경 없음(재사용): assertSafeUrl/fetchSource 그대로. 변경은 문서(asset-library.md)에서 'consent 프롬프트 후에만 호출, 결과 provenance sidecar' 절차 명문화. 스킬이 AskUserQuestion으로 consent 받고 fetchSource 호출.
- 주의: fetchSource는 utf8 텍스트 전제이므로 이미지 바이트 수집이 필요하면 바이너리 fetch 확장은 후속 슬라이스로 분리(이 계획 범위는 가드 재사용·consent 절차·sidecar까지) — risk로 표기.

### assets/samples/ (신규 번들)
- starter 세트: samples/textures/{paper-noise,dot-grid}.svg(CC0 자작), samples/icons/placeholder-mark.svg(자작), 최소 1 자작 SVG 로고. 각 *.license.txt 동반(CC0/자작, source 명시).
- 이유: AC 7 (0개 경로 충족).

### tests/unit/assets.test.js + tests/fixtures/assets/ (신규)
- node:test. assets.js 단위 + cli.js assets end-to-end. 픽스처 디렉터리(정상/누락/의심) 구성.

## 3. 에셋 게이트 통합 방식
- 새 Phase 없음. 'first' 강제는 두 지점:
  1. 인터뷰 brand 차원(Phase 1): concept lock 전 에셋 질문 필수 제시(4경로). sourcing plan 택1해야 brand 차원 명료 기준 도달 → 미선택 시 점수 미달로 Phase 2 진입 불가(=계획 강제). '0개' 자체는 허용(번들샘플/생성 경로 택1로 통과).
  2. concept-sheet 에셋 계획 섹션(Phase 2): sourcing plan을 문서로 잠금. 비면 advisory 경고.
- 빌드 비차단: 어느 게이트도 exit/빌드를 막지 않음. assets CLI는 build 후/Phase 5 근처에서 디렉터리 advisory 점검(exit 0).
- audit 2채널과의 관계: assets 검사는 별도 명령(디렉터리 입력)이라 audit(파일 입력)의 blocking/advisory 어디에도 흡수 안 함(Opt B 기각 사유). 성격상 audit advisory와 동급 'advisory only'이며, 이중 채점 금지를 위해 audit가 보는 텔(S1/S2 LLM 레인 등)을 재판정하지 않고 에셋 파일 메타(개수/sidecar/날조 의심)만 본다.

## 4. assets [dir] CLI 명세
- 사용법: node src/cli.js assets [dir] [--json]
- 입력 오류: dir 없음/파일아님 → 메시지 + exit 2(기존 readInput 규율). 그 외 모든 검사 결과는 exit 0.
- text 출력 형태:
    assets: [dir]
    종류별 개수: logo N · image N · texture N · font N · other N (total N)
    sidecar 누락 (M):
      - assets/images/foo.png
    가짜-실재 의심 (K, advisory):
      - assets/icons/openai.svg — logo-as-customer 의심: 트레이드마크 마크, sidecar 명목적 참조 근거 없음
    advisory only — 항상 exit 0
- JSON 출력: auditAssets 반환 객체 그대로(JSON.stringify 2-space).
- exit 0 보장: cli.js assets 분기 끝에서 무조건 process.exit(0); 검사 결과(누락/의심 개수)와 독립 → 테스트로 계약 고정.

## 5. Pre-mortem 시나리오
1. advisory 무시 → 에셋-우선 사문화. 0개여도 진행되니 sourcing plan을 형식적으로 samples 찍고 패스. 완화: brand 명료 기준을 '택1 + 근거 1줄'로 두고, concept-sheet 빈 섹션 advisory 경고를 Phase 5 납품 요약에 포함(가시화), 인터뷰 디폴트 수렴 금지 규율 유지.
2. S4 재정의가 슬롭 범람. '소스 불문 합법'을 'AI생성 아무거나 OK'로 오독. 완화: S4 문구에 게으른/범용/안 어울리는 판정 기준 명시 + 아트디렉션·통합·sidecar source 요건; S2 하드라인 불변; LLM 레인 S4 잔류(기계 비승격)로 의미 판단 유지.
3. 크롤 consent 우회 / SSRF. consent 없이 fetchSource 호출 또는 가드 우회. 완화: intake.js 가드 무변경 재사용(assertSafeUrl 2단 + 리다이렉트 재검증 + 5MB/30s), 문서에 consent 프롬프트 필수 → 결과 sidecar provenance 절차 명문, 크롤 결과도 assets CLI sidecar 누락 검사 대상.
4. (보너스) 가짜-실재 휴리스틱 오탐. 정당한 명목적 로고 참조를 의심 표시. 완화: 휴리스틱은 advisory 표시일 뿐 차단 아님; sidecar에 명목적/trademark/주체 근거 있으면 제외; reason 문자열로 근거 노출.

## 6. 확장 테스트 계획
- unit (tests/unit/assets.test.js): classifyKind(카테고리x확장자), parseSidecar(정상/누락/공백), detectFabrication(3 신호 양성 + 명목적 근거 시 음성), auditAssets(개수 집계·missingSidecar·suspect).
- integration: cli assets end-to-end(픽스처 dir → text/JSON, exit 0 고정; 누락·의심 있어도 0), 없는 dir/파일 dir → exit 2. 기존 intake/audit/shot 회귀(허용커맨드 배열 변경 영향 없음 확인).
- e2e: pipeline.test.js 확장/신규 — 인터뷰(brand sourcing plan 택1) → concept-sheet 에셋 계획 → build → assets advisory(exit 0) 스모크. 문서 단계는 파일 존재/형식 검증으로 대체.
- observability: advisory 리포트 형식 스냅샷(섹션 헤더·advisory only 푸터), exit 코드 계약(검사 결과 무관 0; 입력오류 2).

## 7. 테스트 가능한 합격 기준
- AC1: interview.md brand 차원에 4경로 sourcing plan 텍스트 존재, 명료 기준에 'sourcing plan' 포함.
- AC2: cli assets가 0-에셋 디렉터리에서 exit 0; concept-sheet 템플릿에 에셋 계획 섹션 존재.
- AC3: node src/cli.js assets [fixture]가 counts·missingSidecar·suspect 3종 출력 + exit 0; assets.test.js green.
- AC4: design-tells.md S4가 '소스 불문 게으른/범용 금지'로 갱신, 'AI생성 sidecar source 합법' 문구 존재.
- AC5: detectFabrication이 가짜 로고/스크린샷/데이터 픽스처에서 suspect 반환; 문서 S2 하드라인 명문.
- AC6: 크롤 절차 문서에 consent + SSRF 가드 재사용 + provenance sidecar 명문; intake.js 가드 테스트 회귀 green.
- AC7: assets/samples/ 존재 + 각 파일 .license.txt 동반(sidecar 존재 검증).
- AC8: asset-library.md 4경로·source·번들·CLI 반영; npm test green(회귀 0).

## 8. 검증 단계
- npm test (unit + e2e) green — 신규 assets.test.js 포함.
- npm run test:unit / npm run test:e2e 분리 확인.
- node src/cli.js assets tests/fixtures/assets/mixed → text 출력·exit 0 확인.
- node src/cli.js assets tests/fixtures/assets/mixed --json → JSON 파싱 가능.
- node src/cli.js assets does-not-exist → exit 2 클린 에러.
- npm run benchmark → 탐지기 정확도 회귀 없음(S4 재정의가 audit 기계 레인 미변경, baseline 불변 확인).
- 기존 회귀: intake/preview/audit/shot 정상(cli.test.js).

## Handoff
- 구현은 executor에 슬라이스 위임 권장: (1) src/assets.js + cli 배선 + tests, (2) 문서 4종(interview/asset-library/design-tells/concept-sheet) 갱신, (3) assets/samples/ 번들 + sidecar.
- 아키텍처 확인은 architect(advisory 채널 분리·exit 계약), 계획 비판은 critic.
- 승인 전 제품 코드/문서 수정 금지(이 단계는 계획만).
