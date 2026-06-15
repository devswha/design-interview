# Architect Review (iter 2) — design-interview 에셋 우선 개편 개정안 재평가

정본: .gjc/specs/deep-interview-asset-first-pipeline.md · 개정안: stage-02-revision.md · 1차: stage-01-architect.md(WATCH/REQUEST CHANGES), stage-01-critic.md(ITERATE)
레인: 아키텍처 건전성 + 코드리뷰 · 모드: deliberate · 읽기 전용

## Summary
1차 두 블로커(F1 강제 메커니즘 수학적 거짓, F2 크롤 바이너리 산출 불가)와 exit0/F3/F5가 코드 근거로 모두 해소됐다. F1은 점수-강제 주장 삭제 + Opt C 코드근거 기각 + brand 가중 0.10·임계 0.80·--quick 차원집합 불변 명시 + 강제를 스펙이 지정한 인터뷰 must-answer 규율 + concept-sheet non-empty 머신신호로 재배치했고, F2는 기존 SSRF/캡 가드를 공유하는 fetchBinary 결정으로 utf8 한계를 외과적으로 해소했다. 잔여는 concept-sheet 머신신호의 탐색 계약 미정(MEDIUM/WATCH) 하나뿐. 승인 가능.

## Analysis (file-backed)
- core/interview.md: 가중표 검증 — audience/mood/structure/conversion 0.20, brand 0.10, reference 0.10. 임계 0.80 = Σ(차원×가중). 핵심 4차원만으로 정확히 0.80 → brand=0·reference=0이어도 Phase 2 진입. --quick은 audience/mood/conversion 평균 0.75로 brand 제외. ⇒ 1차 F1 수학 재확인. 개정안은 이 산식을 '변경하지 않는다'고 명문(§2 core/interview.md, AC1, Changelog F1)하여 회귀 0.
- src/intake.js: assertSafeUrl(2단 스킴/호스트/DNS) + guardedLookup(연결시점 재검증, requestOnce가 lookup 훅으로 주입) + 리다이렉트 hop별 assertSafeUrl 재검증 + FETCH_MAX_BYTES=5MB/FETCH_TIMEOUT_MS=30s/MAX_REDIRECTS=3 모두 존재. readCappedBody는 캡 초과시 res.destroy()+reject, 종료시 Buffer.concat(chunks).toString('utf8') — 텍스트 전용 확정. 개정안 F2 결정(동일 assertSafeUrl·guardedLookup·MAX_BYTES·TIMEOUT 공유, 본문읽기만 Buffer 분기)은 코드 구조와 1:1로 타당.
- src/cli.js: 허용커맨드 [intake,preview,audit,shot], 가드 (!includes||rest.length===0)→usage()(exit 2). audit 분기는 process.exit(result.pass?0:1), intake 실패 fail(...,1), 입력오류 fail(...,2). 기존엔 exit 0 고정 분기 없음 → 개정안의 '무조건 process.exit(0)' 신설·'audit 패턴 참고' 폐기가 정확.
- src/preview.js CSP: img-src * data:, font-src * data:, script-src 'none'. ⇒ 자가호스팅/data 이미지·폰트는 inert preview에서 허용, fetchBinary 산출물은 스크립트 미접촉이라 inert 무충돌.
- core/asset-library.md: 이미지=상대경로 <img src>, 아이콘=인라인 SVG, 폰트=상대경로 woff2. '단일 HTML'은 단일 문서+자가호스팅(CDN 런타임 의존 0) 의미. fetchBinary 산출물을 assets/ 하위 저장 후 상대참조하면 기존 모델과 동일, 신규 위반 없음.
- 저장소 전역 검색: 'dither' 0건. ⇒ 디더링 파이프라인 부재, 본 우려는 무효(moot).

## Root Cause (1차 대비)
1차 근본원인은 '강제를 가중 총점 임계에 의존'시킨 설계 모순이었다. 개정안은 강제를 점수에서 완전히 분리하고(스펙이 '강제 지점=인터뷰'로 못박음) 머신 검증을 advisory 신호로 보조화해 모순을 제거했다. 양성 철학(advisory exit 0)+0개 허용 제약 하에서 스펙이 허용하는 최대 강제 = 인터뷰 프롬프트 must-answer + 비차단 가시화이며 개정안이 이를 정확히 채택.

## Findings

### F1 (1차 HIGH) → RESOLVED
참조: stage-02-revision.md §2 core/interview.md·§3·§7 AC1·Changelog / core/interview.md:1-20
판정: 해소. (1) 점수-강제 주장 삭제, brand 가중·임계·--quick 불변 명시+회귀 테스트(AC1). (2) Opt C를 코드근거(0.20×4=0.80, --quick brand 제외)로 명시 기각. (3) 강제를 스펙 지정 지점(인터뷰 must-answer 규율: concept lock 진입 전 에셋 질문 1회 필수+sourcing plan 응답, 미응답시 Phase2 보류)과 concept-sheet non-empty 머신신호+Phase5 납품요약 가시화로 재배치. 스펙 하드제약('sourcing plan 선택을 건너뛸 수 없게=인터뷰에서')과 정합. AC1이 '점수 강제' tautology를 버리고 grep+섹션존재+advisory출력+불변회귀로 재작성됨.

### F2 (1차 MEDIUM-HIGH) → RESOLVED
참조: stage-02-revision.md §2 src/intake.js·§7 AC6·Changelog / src/intake.js readCappedBody·fetchSource
판정: 해소. AC6 재작성으로 크롤 2경로 확정 — (a) 스크린샷=기존 node src/cli.js shot 재사용(신규코드 0, 경계 명확), (b) 바이너리 로고/이미지=동일 assertSafeUrl·guardedLookup·MAX_BYTES·TIMEOUT 공유 fetchBinary(→Buffer) 추가. utf8 전용 한계 명문화. 두 경로 모두 consent 프롬프트 후 실행+provenance sidecar. 가드 공유 단위테스트(private 거부, 5MB abort)를 AC6/§6에 포함. 코드 구조상 readCappedBody의 본문 디코드만 파라미터화(utf8|buffer)하고 리다이렉트 루프 공유로 구현 가능 — 가드 우회 위험 없음.

### exit0 (1차 F4 self-contradiction) → RESOLVED
참조: stage-02-revision.md §2 src/cli.js·§4·§7 AC9 / src/cli.js audit 분기
판정: 해소. '분기 끝 무조건 process.exit(0), suspect/missing 개수와 독립', 'audit 패턴 참고 문구 폐기'(자기모순 제거) 명시. 입력오류(dir 미지정/없음/파일아님)만 fail(...,2). AC9 신설로 테스트 잠금(suspect>0·missing>0에도 exit 0; 입력오류 exit 2). AC2(0-에셋 exit0)/AC3(3종출력+exit0)/AC9 상호 모순 없음.

### F3 (1차 MEDIUM) → RESOLVED
참조: stage-02-revision.md §2 src/assets.js·core/design-tells.md·§7 AC5
판정: 해소. detectFabrication은 '판정 아님 의심표시만', best-effort(파싱실패 skipped, throw 안 함), 리포트 면책문구(best-effort·S2 권위=LLM 레인), sidecar 명목적/trademark/주체 근거시 음성. design-tells.md에 'S2 가짜-실재 최종판정=LLM 레인 단일권위' 명문화로 이중채점 금지. 1차 거짓안심 우려 완화.

### F5 (1차 LOW) → RESOLVED
참조: stage-02-revision.md §2·§4·§5 premortem5·§7 AC9
판정: 해소. 'always exit 0이므로 CI 차단 게이트 금지'를 asset-library CLI 절·리포트 푸터·AC9에 명시. blocking 필요시 audit 레인 안내.

### NF1 (MEDIUM, 신규) — concept-sheet 머신신호 탐색 계약 미정
참조: stage-02-revision.md §2 src/assets.js(conceptSheetAssetSection?{present,empty}(있으면))·§7 AC1(c)·templates/concept-sheet.md
영향: F1 해소의 '머신 검증' 절반이 auditAssets(dir)의 concept-sheet 섹션 non-empty 탐지에 의존한다. 그러나 assets CLI는 '에셋 디렉터리'를 입력받고, 실제 채워진 컨셉시트는 별개 마크다운 아티팩트(artifacts/*-concept-sheet.md)로 assets/ 밖에 존재한다. 개정안은 auditAssets가 컨셉시트를 dir 기준으로 어떻게 찾는지 계약을 정의하지 않으며 '(있으면)' 한정자로 미발견시 신호가 조용히 미발화한다. ⇒ (a) 프로덕션 파이프라인에서 머신신호가 no-op이 될 위험, (b) AC1(c) 픽스처(빈-concept-sheet dir)는 시트를 fixture dir 안에 넣어 통과하므로 픽스처-형(fixture-shaped) 검증으로 실제 경로를 입증 못함. 강제의 인터뷰 must-answer+Phase5 가시화 절반은 스펙대로 유효하고 스펙 자체가 concept-sheet를 advisory로 규정하므로 스펙 미준수는 아니나, 머신신호를 견고히 하려면 탐색 계약을 실행 단계에서 못박아야 함.
수정: assets CLI에 명시적 concept-sheet 경로/플래그를 받거나(예: assets [dir] --concept <sheet.md>) 관례적 위치를 정의해 스캔. AC1(c) 픽스처가 '시트 밖 경로'도 커버하도록 보강.

### NF2 (LOW, 신규) — fetchBinary 저장 경로·content-type 미명세
참조: stage-02-revision.md §2 src/intake.js·assets/samples
영향: fetchBinary 결과의 저장 디렉터리(assets/images vs icons)·파일명·content-type 검증이 미명세. SSRF 관점 위험 아님(가드 공유). 기존 assets/ 레이아웃과 일관되게 executor 해소 가능. content-type 미검증은 advisory 파이프라인에서 수용 가능(sidecar가 provenance 기록).
수정: 저장 규약(카테고리 dir + .license.txt 동반)을 §2/asset-library 크롤 절에 1줄 명시.

## 원칙 위반 플래그 (deliberate)
- 단일 HTML·런타임 0: PASS — src/assets.js node:fs/promises만, fetchBinary는 빌드타임 node:http/https 내장, 산출물 자가호스팅 상대경로/인라인. 신규 런타임 의존 0.
- SSRF 안전: PASS — 가드 무변경 공유(텍스트·바이너리 동일 assertSafeUrl/guardedLookup/리다이렉트 재검증/5MB·30s). 가드 공유 단위테스트 AC화.
- inert preview: PASS — fetchBinary 산출물은 이미지/폰트로 preview CSP(img-src/font-src * data:) 허용 범위, 스크립트 미접촉.
- 이중채점 금지: PASS — assets는 audit denominator 미합류 별도 advisory(디렉터리 입력), S2 최종판정 LLM 레인 단일권위 명문.
- claim 보존: PASS — intake 클레임 경로 무변경.
- advisory exit 0: PASS — 무조건 exit0 + AC9 잠금테스트.
- 디더링: N/A — 저장소에 디더 파이프라인 부재(검색 0건), 우려 무효.

## Recommendations (우선순위)
1. (MEDIUM/NF1) concept-sheet 탐색 계약 확정 — 명시 경로/플래그 또는 관례 위치 + AC1(c) 픽스처를 시트-밖-경로로 보강(머신신호 no-op 방지).
2. (LOW/NF2) fetchBinary 저장 규약(카테고리 dir+sidecar) 1줄 명시.
3. 실행시 가드 공유 단위테스트(private 거부·5MB abort)와 exit0 잠금테스트를 우선 작성해 회귀 게이트로.

## Architectural Status
CLEAR

## Code Review Recommendation
APPROVE

## Trade-offs
| 축 | 1차 계획 | 개정안 | 평가 |
|---|---|---|---|
| 강제 위치 | 가중 점수(거짓) | 인터뷰 must-answer + concept-sheet non-empty 머신신호 | 교체 완료(F1 해소) |
| 크롤 바이너리 | 후속 보류(AC6 모순) | fetchBinary 가드 공유 + shot 재사용 분리 | 해소(F2) |
| exit 계약 | audit 패턴 참고(자기모순) | 무조건 exit0 + AC9 잠금 | 해소(F4) |
| S2 권위 | 휴리스틱 모호 | LLM 레인 단일권위 + best-effort 면책 | 해소(F3) |
| 머신신호 결합 | — | concept-sheet 탐색 계약 미정 | 잔여(NF1, 실행시 확정) |
