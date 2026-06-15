# design-interview 에셋 우선(asset-first) 개편 — 구현 계획 개정 (revision, iter 2)

정본 스펙: .gjc/specs/deep-interview-asset-first-pipeline.md. 본 개정은 stage-01-planner의 consensus 피드백(Architect WATCH, Critic ITERATE) 반영본. 변경 요약은 맨 끝 'Revision Changelog' 참조.

## 1. RALPLAN-DR 요약

### Principles
1. Advisory-first, never block — 에셋은 빌드를 절대 차단하지 않는다(exit 0). 강제 대상은 파일이 아니라 sourcing plan의 '응답/기록'.
2. Source-agnostic quality — '슬롭 룩'은 소스(AI/스톡/실사)가 아니라 품질·의도. S4는 소스 불문 재정의, S2(실재 날조)만 하드라인.
3. Provenance is mandatory — 모든 에셋은 sidecar에 진짜 source(AI생성 포함)+license. sidecar 없으면 빌드 사용 금지.
4. Reuse, don't reinvent — SSRF 가드(intake.js)·shot(puppeteer)·audit advisory 패턴 재사용. 신규 런타임 의존 0.
5. No double scoring, single authority — assets CLI는 audit/LLM 레인이 보는 항목을 재판정하지 않는다. S2 가짜-실재 '판정' 권위는 LLM 레인 단일; 기계는 sidecar 근거 기반 '의심 표시'만.

### Decision Drivers (top 3)
1. 빌드 비차단(advisory exit 0) 보장 — 양성 철학(M9) 정합성.
2. 'first' 강제 지점을 점수가 아니라 인터뷰 must-answer 규율 + concept-sheet 머신 신호로 확보(새 Phase 금지).
3. 보안 불변(SSRF/inert/단일HTML/런타임0) + 회귀 0.

### Viable Options
Opt A (채택) — 인터뷰 must-answer 에셋 규율 + concept-sheet 에셋 섹션 non-empty 머신 신호 + 독립 advisory assets CLI(디렉터리 입력).
- pros: 새 Phase 0, 기존 흐름 보존; CLI가 audit와 분리돼 exit 0 단순; 이중 채점 없음; 스펙 토폴로지(asset-cli active)와 1:1. 점수 모델 미변경으로 명료도 임계 회귀 0.
- cons: 강제가 인터뷰 규율 + 문서 신호에 의존(사문화 리스크 → premortem #1 완화).

Opt B (기각) — assets 검사를 기존 audit advisory 채널에 흡수.
- cons: audit는 built.html 단일 파일 입력, 에셋 검사는 디렉터리 입력 → 입력 모델 충돌; audit는 fail시 exit 1이라 advisory-only exit 0 계약 오염. → 무효화.

Opt C (기각) — brand 가중치 격상으로 sourcing plan 강제.
- cons (코드 검증됨, F1 치명): interview.md는 brand 가중 0.10·임계 0.80(총점). audience+mood+structure+conversion = 0.20x4 = 0.80이므로 brand=0이어도 Phase 2 통과. --quick은 audience/mood/conversion 3차원만 검사(brand 제외). 따라서 brand 가중/임계 조정으로는 'sourcing plan을 건너뛸 수 없게' 보장 불가. → 무효화. brand 가중·임계는 불변 유지.

Opt D (기각) — 새 Phase 2.5 Asset Lock 신설.
- cons: 스펙 Non-Goal('새 Phase 신설 안 함') 위반. → 무효.

채택: A. B/C/D 명시 기각.

## 2. 파일별 구현 계획

### core/interview.md — brand 차원 텍스트 보강 (가중/임계 불변)
- brand 가중 0.10·임계 0.80은 **변경하지 않는다**(F1: 점수 강제 불가능 확인). 점수 산식·--quick 차원 집합 모두 불변.
- brand 명료 기준(1.0) 텍스트를 '에셋 sourcing plan 응답 완료(보유경로/생성/번들샘플/크롤 중 택1, per asset-type)'로 보강 — 단 이는 **점수 게이트가 아니라 인터뷰 규율 문구**다.
- 신규 '에셋 must-answer 규율' 단락(강제의 진짜 지점): concept lock(Phase 2) 진입 전, 차원 점수와 무관하게 에셋 질문을 반드시 1회 제시하고 sourcing plan 응답을 받는다(미응답이면 Phase 2 진입 보류). 0개여도 진행하되 '어떻게 구할지(택1)'는 반드시 기록. '그냥 만들어줘' 시 디자이너 디폴트(번들 샘플 또는 생성)를 명시 선언 후 진행.
- '차원별 선택지 예시 > brand' 확장: 4경로 라우팅((1)폴더 경로 (2)생성: codex CLI ChatGPT image·자작 SVG (3)번들 샘플 assets/samples/ (4)consent 크롤: 실재-only) + '직접입력/없음' 폴백.
- 이유: AC1(재작성, 아래) 근거. 인터페이스: 텍스트 규율만 추가, 측정 로직 불변.

### templates/concept-sheet.md — 에셋 계획 섹션(머신 신호)
- 토큰 커밋 표 '에셋 선택' 행을 '에셋 계획(Sourcing Plan)'으로 확장: asset-type(logo/image/texture/font) x 경로(path|generate|samples|crawl) x source/license 메모.
- 이 섹션이 비어 있으면(플레이스홀더만이면) assets CLI/감사가 advisory 경고를 낸다 — '강제'의 머신 검증 지점.
- 이유: AC1·AC2.

### core/asset-library.md — 4경로·source·번들샘플·CLI·크롤절차 반영
- '수집 시점' Phase 1 행에 sourcing plan 4경로 명시.
- 신규 절 '소싱 4경로': (1)사용자 폴더 경로 (2)생성(codex CLI ChatGPT image / 자작 SVG; sidecar source=AI생성:codex 등) (3)번들 샘플(assets/samples/) (4)consent-gated 크롤.
- 신규 절 '크롤 절차(consent + 가드)': AC6 결정(아래) 반영 — 스크린샷=기존 shot 재사용, 바이너리 로고/이미지=동일 SSRF/캡 가드의 바이너리 fetch 추가, consent 프롬프트 후에만, 결과 provenance sidecar 필수.
- sidecar 규칙에 source 필드 명문화(AI생성 포함) + S2(실재 날조 금지) 하드라인.
- 'S4 stock-illustration 금지' → S4 재정의(소스 불문, 게으른/범용/안 어울리는 이미지만 금지; AI생성도 sidecar source 명시 시 합법), images/ 카테고리 'undraw/스톡/생성 금지' 문구 정정.
- 신규 절 '에셋 검사 CLI': node src/cli.js assets [dir] 사용법·출력·exit 0 advisory + best-effort 면책 + 'S2 판정 권위는 LLM 레인 단일, 기계는 sidecar 근거 의심표시만'(F3) + 'always exit 0이므로 CI 차단 게이트로 쓰지 말 것'(F5).
- 신규 절 '번들 샘플': assets/samples/ 구성·각 파일 CC0/자작 sidecar.

### core/design-tells.md — S4 재정의
- S4 stock-illustration → S4 generic-image: '소스 불문 — 게으른/범용/디폴트/안 어울리는 이미지(슬롭 룩) 금지. AI생성·스톡·실사 무관, sidecar source 명시 + 아트디렉션·통합이면 합법.'
- 감사 분류표: S4는 LLM 레인 잔류(기계 비승격). S1/S2 하드라인 유지. **S2 가짜-실재 최종 판정은 LLM 레인 단일 권위**임을 명문화(assets 기계 검사는 의심 표시만, 이중채점 금지).
- 이유: AC4.

### src/cli.js — assets 서브커맨드 배선
- usage()에 'assets [dir] [--json]  # 에셋 advisory 검사 (always exit 0; 입력오류만 exit 2)' 추가.
- 허용 커맨드 배열에 'assets' 추가: ['intake','preview','audit','shot','assets'].
- 분기: dir 미지정/없음/디렉터리 아님 → fail(메시지, 2)(readInput 규율과 동일 exit 2). auditAssets(resolve(dir)) 호출 결과는 json이면 JSON.stringify(2-space) 아니면 formatAssetReport.
- **exit 계약(F-P1)**: 분기 끝에서 무조건 process.exit(0). suspect/missing 개수와 완전 독립. (audit 분기처럼 result.pass로 exit 분기하지 않는다 — audit는 fail시 exit 1이라 advisory-only와 자기모순이므로 'audit 패턴 참고' 문구는 폐기.)
- 이유: AC3·AC9(신규 exit 계약 AC).

### src/assets.js (신규) — 검사 3종 (Pure ESM, best-effort)
- auditAssets(dir) async — node:fs/promises readdir withFileTypes 재귀 스캔. 반환: dir, counts{logo,image,texture,font,other}, files[{path,kind,hasSidecar,source}], missingSidecar[path], suspectFabrication[{path,reason}], conceptSheetAssetSection?{present,empty}(있으면), summary{total,missingSidecar,suspect}. 파싱 실패 파일은 throw 대신 skipped로 집계(best-effort, F3).
- classifyKind(relpath) — assets/ 카테고리+확장자(icons/+로고형 파일명→logo, woff2/woff/ttf→font, textures/→texture, images/+래스터→image, else other).
- parseSidecar(text) — *.license.txt에서 파일/라이선스/출처/source/수집일 키 파싱 → {license,source,...}, 누락 허용.
- detectFabrication(file,sidecar) — sidecar 근거 기반 3 의심 신호(판정 아님): (1)알려진 브랜드 로고형 파일명 + sidecar에 명목적/trademark/주체 근거 없음 → logo-as-customer 의심(S2); (2)screenshot/dashboard 파일 + source=AI생성 → 가짜 스크린샷 의심; (3)chart/graph/data 파일 + source=AI생성 → 가짜 데이터 의심. 모두 advisory 표시일 뿐 차단 아님; 최종 판정은 LLM 레인.
- formatAssetReport(report,opts) — text: 종류별 개수 / sidecar 누락 목록 / 가짜-실재 의심 목록(+best-effort·LLM-레인-권위 면책 문구) / 'advisory only — always exit 0; CI 차단 게이트 금지' 푸터.
- 이유: AC3·AC5·F3.

### src/intake.js — 크롤 가드 재사용 + 바이너리 fetch (AC6 결정)
- assertSafeUrl/2단 lookup/리다이렉트 재검증/5MB·30s 캡은 그대로 재사용.
- **AC6 결정(F2)**: 크롤을 두 경로로 분리·명문화한다.
  (a) 스크린샷(레퍼런스/실재 화면): 기존 node src/cli.js shot(puppeteer→PNG) 재사용 — 신규 코드 없음.
  (b) 바이너리 에셋 파일(실로고/이미지 등): fetchSource는 utf8 텍스트 전용이라 바이너리 미지원 → 동일 SSRF/캡/리다이렉트 가드를 공유하는 바이너리 fetch 헬퍼(예: fetchBinary(url) → Buffer, 동일 assertSafeUrl·guardedLookup·MAX_BYTES·TIMEOUT 사용)를 추가한다. 텍스트 경로(fetchSource)와 가드 코드 공유, 본문 읽기만 Buffer 분기.
  - 두 경로 모두 consent 프롬프트 후에만 실행, 결과에 provenance/license sidecar 작성.
- 이유: AC6(재작성).

### assets/samples/ (신규 번들)
- starter: samples/textures/{paper-noise,dot-grid}.svg(CC0 자작), samples/icons/placeholder-mark.svg(자작), 최소 1 자작 SVG 로고. 각 *.license.txt(CC0/자작, source 명시).
- 이유: AC7.

### tests/unit/assets.test.js + tests/fixtures/assets/ (신규)
- node:test. assets.js 단위 + cli.js assets end-to-end + exit 계약 테스트. 픽스처 dir(정상/누락/의심/빈-concept-sheet) 구성.

## 3. 에셋 게이트 통합 방식 (재설계, F1)
- 새 Phase 없음. 점수 강제는 불가(F1)이므로 'first' 강제는 두 머신/규율 지점:
  1. 인터뷰 must-answer 규율(Phase 1, interview.md): concept lock 진입 전 에셋 질문 1회 필수 제시 + sourcing plan 응답 기록(점수와 무관). 미응답 시 Phase 2 진입 보류. 이는 규율 문구이지 점수 게이트가 아님.
  2. concept-sheet 에셋 계획 섹션 non-empty(Phase 2): 이 섹션이 비면 assets CLI/감사가 advisory 경고 — 강제의 **머신 검증** 지점.
- 빌드 비차단: 어느 지점도 exit/빌드를 막지 않음.
- audit 2채널과의 관계: assets 검사는 별도 명령(디렉터리 입력). audit(파일 입력, fail시 exit1)에 흡수하지 않음(B 기각). 성격은 advisory-only(always exit 0). 이중채점 금지: S2 가짜-실재 최종 판정은 LLM 레인 단일 권위, assets는 sidecar 근거 의심표시만.

## 4. assets [dir] CLI 명세
- 사용법: node src/cli.js assets [dir] [--json]
- exit 계약(고정, F-P1/F5): 검사 결과(suspect/missing 개수)와 무관하게 **always exit 0**. 입력 오류(dir 미지정/없음/파일아님)만 exit 2. → CI 차단 게이트로 사용 금지(문서·리포트 푸터 명시).
- text 출력:
    assets: [dir]
    종류별 개수: logo N · image N · texture N · font N · other N (total N)
    sidecar 누락 (M):
      - assets/images/foo.png
    가짜-실재 의심 (K, advisory; 최종 판정은 LLM 레인):
      - assets/icons/openai.svg — logo-as-customer 의심: 트레이드마크 마크, sidecar 명목적 참조 근거 없음
    (best-effort 검사 — 누락/의심은 권고일 뿐. advisory only — always exit 0; CI 차단 게이트 금지)
- JSON: auditAssets 반환 객체 그대로(2-space).

## 5. Pre-mortem 시나리오
1. advisory 무시 → 에셋-우선 사문화. 0개여도 진행되니 형식적으로 samples 찍고 패스. 완화: 인터뷰 must-answer 규율(미응답 시 Phase2 보류) + concept-sheet 빈 섹션 머신 advisory 경고를 Phase 5 납품 요약에 포함(가시화) + 디폴트 수렴 금지 규율.
2. S4 재정의가 슬롭 범람. '소스 불문 합법'을 'AI 아무거나 OK'로 오독. 완화: S4 문구에 게으른/범용/안 어울리는 판정 기준 + 아트디렉션·통합·sidecar source 요건; S2 하드라인 불변; S4 LLM 레인 잔류(의미 판단).
3. 크롤 consent 우회 / SSRF. 완화: assertSafeUrl/guardedLookup/캡을 텍스트·바이너리 경로 공유로 재사용, consent 프롬프트 필수 → 결과 sidecar provenance, 크롤 결과도 assets CLI sidecar 누락 검사 대상.
4. 가짜-실재 휴리스틱 오탐. 완화: advisory 표시일 뿐 차단 아님; sidecar 명목적/trademark/주체 근거 있으면 제외; reason 노출; 최종 판정 LLM 레인.
5. assets exit 0을 CI 게이트로 오용 → 무조건 통과로 보안 착시. 완화(F5): 문서·리포트 푸터에 'CI 차단 게이트 금지' 명시, blocking이 필요하면 audit 레인 사용 안내.

## 6. 확장 테스트 계획
- unit (tests/unit/assets.test.js): classifyKind, parseSidecar(정상/누락/공백), detectFabrication(3 신호 양성 + 명목적 근거 시 음성), auditAssets(개수·missingSidecar·suspect·skipped best-effort).
- integration: cli assets end-to-end(text/JSON), **exit 0 계약 테스트**(suspect/missing 있어도 exit 0; 없는 dir/파일 dir → exit 2). 기존 intake/audit/shot 회귀(허용커맨드 배열 변경 무해).
- e2e: pipeline.test.js 확장 — 인터뷰 must-answer → concept-sheet 에셋 섹션 채움/빈경우 advisory → build → assets advisory(exit 0) 스모크. 문서 단계는 파일 존재/형식 검증.
- observability: 리포트 형식 스냅샷(섹션 헤더·best-effort·LLM-권위·CI금지 푸터), exit 코드 계약(검사 무관 0; 입력오류 2).
- 크롤: fetchBinary가 assertSafeUrl/캡 가드 공유하는지 단위 테스트(private 주소 거부, 5MB 초과 abort) — 바이너리 경로 추가 시.

## 7. 테스트 가능한 합격 기준 (재작성)
- AC1 (재작성, F1): 점수 강제 주장 삭제. (a) interview.md에 에셋 must-answer 규율 문구 존재(grep). (b) concept-sheet 템플릿에 에셋 계획(Sourcing Plan) 섹션 존재. (c) assets CLI가 concept-sheet 에셋 섹션 빈/없음 입력에서 advisory 경고 출력. brand 가중 0.10·임계 0.80·--quick 차원 집합 불변(테스트로 회귀 확인).
- AC2: cli assets가 0-에셋 디렉터리에서 exit 0; concept-sheet에 에셋 계획 섹션 존재.
- AC3: node src/cli.js assets [fixture]가 counts·missingSidecar·suspect 3종 출력 + exit 0; assets.test.js green.
- AC4: design-tells.md S4가 '소스 불문 게으른/범용 금지'로 갱신 + 'AI생성 sidecar source 합법' 문구.
- AC5: detectFabrication이 가짜 로고/스크린샷/데이터 픽스처에서 suspect 반환; 명목적 근거 시 음성; 문서 S2 하드라인 + 'LLM 레인 단일 판정 권위' 명문.
- AC6 (재작성, F2): 크롤 절차 문서에 (a)스크린샷=기존 shot 재사용 (b)바이너리=동일 SSRF/캡 가드 공유 fetchBinary로 명확히 정의 + consent 프롬프트 + provenance sidecar 명문. 바이너리 fetch 추가 시 가드 공유 단위 테스트 green. intake.js 기존 가드 회귀 green.
- AC7: assets/samples/ 존재 + 각 파일 .license.txt 동반(sidecar 존재 검증).
- AC8: asset-library.md 4경로·source·번들·CLI·크롤절차 반영; npm test green(회귀 0).
- AC9 (신규, F-P1/F5): assets CLI exit 계약 잠금 — suspect>0·missing>0에서도 exit 0; 입력오류만 exit 2. 테스트로 고정. 문서에 'CI 차단 게이트 금지' 명시.

## 8. 검증 단계
- npm test (unit + e2e) green — 신규 assets.test.js 포함.
- npm run test:unit / npm run test:e2e 분리 확인.
- node src/cli.js assets tests/fixtures/assets/mixed → text·exit 0.
- node src/cli.js assets tests/fixtures/assets/suspect → suspect 출력에도 exit 0(AC9).
- node src/cli.js assets tests/fixtures/assets/mixed --json → JSON 파싱.
- node src/cli.js assets does-not-exist → exit 2 클린 에러.
- npm run benchmark → 탐지기 회귀 없음(S4 재정의가 audit 기계 레인 미변경, baseline 불변).
- 기존 회귀: intake/preview/audit/shot 정상(cli.test.js) + 명료도 점수 모델 불변 확인.

## Handoff
- executor 3슬라이스: (1) src/assets.js + cli 배선 + exit 계약 tests, (2) 문서 4종(interview must-answer/asset-library 4경로·크롤·CLI/design-tells S4·S2권위/concept-sheet 에셋섹션) 갱신, (3) assets/samples/ 번들 + (선택)intake.js fetchBinary + 가드 테스트.
- architect: exit 계약·advisory 분리·바이너리 fetch 가드 공유 검토. critic: AC 검증성 재확인.
- 승인 전 제품 코드/문서 수정 금지(계획만).

## Revision Changelog (iter 1 → iter 2)
- F1(P0 치명): brand 가중 격상 강제 주장 삭제. 점수 모델 불변, 강제를 인터뷰 must-answer 규율 + concept-sheet non-empty 머신 신호로 재설계. Opt C 코드근거 기각 추가. AC1 재작성.
- F2(P0): AC6 확정 — 스크린샷=기존 shot 재사용, 바이너리=동일 SSRF/캡 가드 공유 fetchBinary 추가로 결정. utf8 전용 한계 명문.
- F-P1: exit 0 계약 고정, 'audit 패턴 참고'(자기모순) 폐기, 신규 AC9 + 테스트 승격.
- F3(P1): assets best-effort 면책 + S2 판정 LLM 레인 단일 권위·기계는 의심표시만 문서화(이중채점 금지).
- F5(P2): always exit 0이므로 CI 차단 게이트 금지를 문서·리포트 푸터에 명시.
