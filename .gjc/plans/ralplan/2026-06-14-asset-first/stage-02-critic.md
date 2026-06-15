# Critic Re-gate (iter 2) — design-interview 에셋 우선(asset-first) 개정안

정본: .gjc/specs/deep-interview-asset-first-pipeline.md · 개정안: stage-02-revision.md · 1차 크리틱: stage-01-critic.md(ITERATE, required_fixes 5) · 2차 아키텍트: stage-02-architect.md(CLEAR/APPROVE)
레인: Critic 합의 · 모드: deliberate · 읽기 전용. 모든 판정은 코드 근거 직접 검증.

## [APPROVE]

1차 required_fixes 5건(P0/F1, P0/F2, P1 exit0, P1/F3, P2/F5)이 코드 근거로 전부 해소됐다. 확장 테스트 5레인·pre-mortem 5건·AC1–AC9는 모두 테스트 가능하다. Architect 2차 잔여 NF1(concept-sheet 탐색 계약)/NF2(fetchBinary 저장 규약)는 승인을 막는 수준이 아니라 executor가 실행 단계에서 해소 가능한 minor다(근거 아래). 실행 전 추측 불요, 검증 구체 → APPROVE.

## 코드 검증 (직접 확인)

- core/interview.md:11,16 — brand 가중 0.10, 임계 0.80. audience/mood/structure/conversion 0.20×4 = 정확히 0.80 → brand=0이어도 Phase 2 진입. --quick은 audience/mood/conversion 3차원 평균 0.75(brand 제외). ⇒ 1차 F1 '점수 강제 거짓' 수학 재확인. 개정안은 산식 '변경하지 않는다' 명문(§2/AC1/Changelog).
- src/intake.js:246 — readCappedBody가 Buffer.concat(chunks).toString('utf8'). fetchSource 텍스트 전용 확정. fetchBinary(동일 assertSafeUrl:178/guardedLookup:208/FETCH_MAX_BYTES:120/FETCH_TIMEOUT_MS:121 공유, 본문만 Buffer 분기) 결정은 코드 구조와 1:1.
- src/cli.js — audit 분기 process.exit(result.pass ? 0 : 1). ⇒ 'audit 패턴 참고'를 그대로 따르면 exit-0 계약 파손. 개정안은 이를 폐기·'무조건 process.exit(0)'·입력오류 exit 2 명시 + AC9 잠금. 허용커맨드에 assets 추가는 무해.

## required_fixes 5건 판정

1. P0/F1 — RESOLVED. 점수-강제 주장 삭제, brand 가중/임계/--quick 불변 명시+회귀 AC. Opt C를 코드근거(0.20×4=0.80, --quick brand 제외)로 명시 기각. 강제를 (a)인터뷰 must-answer 규율(concept lock 진입 전 에셋 질문 1회 필수+sourcing plan 응답, 미응답시 Phase2 보류) + (b)concept-sheet non-empty 머신신호+Phase5 가시화로 재배치. AC1이 tautology(텍스트 존재)를 버리고 grep+섹션존재+advisory출력+불변회귀로 재작성. 스펙 하드제약('인터뷰에서 건너뛸 수 없게')과 정합.
2. P0/F2 — RESOLVED. AC6 재작성: (a)스크린샷=기존 shot 재사용(신규코드 0) (b)바이너리=가드 공유 fetchBinary. utf8 한계 명문. consent+provenance sidecar. 가드 공유 단위테스트(private 거부·5MB abort)를 AC6/§6에 포함. '바이너리 보류+AC6 불변' 모순 제거.
3. P1 exit0 — RESOLVED. 'audit 패턴 참고'(자기모순) 폐기, '검사결과 무관 무조건 exit 0' 명시, 입력오류만 exit 2, AC9 신설로 테스트 잠금(suspect>0·missing>0에도 exit 0). 명명된 AC로 승격됨.
4. P1/F3 — RESOLVED. detectFabrication '판정 아님 의심표시만', best-effort(파싱실패 skipped, throw 안 함), 리포트 면책(best-effort·S2 권위=LLM 레인), sidecar 명목적/trademark 근거시 음성. design-tells.md에 'S2 최종판정=LLM 레인 단일권위' 명문 → 이중채점 금지.
5. P2/F5 — RESOLVED. 'always exit 0이므로 CI 차단 게이트 금지'를 asset-library CLI 절·리포트 푸터·AC9에 명시. blocking 필요시 audit 레인 안내.

## 확장 테스트·pre-mortem·합격기준 테스트가능성

- 테스트 5레인(unit: classifyKind/parseSidecar/detectFabrication/auditAssets; integration: cli e2e+exit0 계약; e2e: pipeline 스모크; observability: 리포트 스냅샷+exit코드; 크롤: 가드 공유 단위) — 구체·실행가능.
- pre-mortem 5건(사문화/슬롭범람/SSRF우회/오탐/CI오용) 각 완화책 명시 — deliberate 충족.
- AC1–AC9 전부 테스트가능: AC1(grep+섹션+advisory+불변회귀) AC2(0-에셋 exit0) AC3(3종출력+exit0+green) AC4(텍스트 grep) AC5(픽스처 양/음성) AC6(절차+가드공유테스트+회귀) AC7(sidecar 존재) AC8(반영+npm test) AC9(exit 계약 잠금).

## NF1/NF2 — 승인 차단 여부 판정

- NF1(MEDIUM, concept-sheet 탐색 계약): 차단 아님 → 실행시 해소 minor. 근거: (1)스펙이 concept-sheet 신호를 advisory로 규정 — 비차단 설계. (2)F1의 1차 강제(인터뷰 must-answer 규율)는 머신신호와 독립이며 스펙 지정 강제지점으로 완전 견고. 머신신호는 보조(belt-and-suspenders)이지 단일 강제수단 아님. (3)executor가 탐색 계약(명시 --concept 플래그 또는 관례 위치)을 선택해도 산출물의 스펙 계약(advisory)은 어느 쪽이든 충족 → 결과 정정 불요한 '추측' 아님. 다만 §2 'conceptSheetAssetSection(있으면)' + AC1(c) 픽스처가 시트를 fixture dir 안에 두면 프로덕션 경로(시트는 artifacts/*-concept-sheet.md로 assets/ 밖)에서 머신신호가 조용히 no-op 될 검증-유효성 약점이 잠재. 비차단이나 실행시 강하게 권고(아래).
- NF2(LOW, fetchBinary 저장 규약): 차단 아님 → trivial executor minor. SSRF 무관, 카테고리 dir+.license.txt 동반 1줄 명시로 해소.

## Summary
- Clarity: 양호. 파일별 변경·CLI 명세·게이트 통합 구체. 1차 'audit 패턴 참고' 자기모순 제거됨.
- Verifiability: 강화됨. AC1 tautology 탈피, exit0이 AC9로 승격, 가드 공유 테스트 AC화. NF1 AC1(c) 픽스처-형 검증만 잔여 약점(비차단).
- Completeness: 토폴로지·번들샘플·문서 4종·픽스처·테스트 포괄. AC6 범위 확정으로 1차 공백 메움.
- Big Picture: 스펙 토폴로지와 1:1. 헤드라인 목표(에셋 반드시 해결)를 스펙 허용 최대(인터뷰 must-answer+비차단 가시화)로 정확히 채택. 1차 '구성적 미달' 해소.
- Principle/Option Consistency: 강제를 점수에서 분리해 원칙↔옵션 모순 제거. Opt B/C/D 기각 근거 코드/스펙 기반 타당.
- Alternatives Depth: Opt A/B/C/D 명시·기각, '강제 위치' 축(가중점수 vs must-answer 머신신호) 흡수됨.
- Risk/Verification Rigor: pre-mortem 5+테스트 5레인+8 검증단계+benchmark 회귀. REJECT 트리거 없음.

## 비차단 실행 권고 (승인 차단 아님 — executor 해소)
1. NF1: assets CLI에 concept-sheet 명시 경로/플래그(예: --concept <sheet.md>) 또는 관례 위치 정의 + AC1(c) 픽스처를 '시트 밖 경로'로 보강해 프로덕션 머신신호 no-op 방지.
2. NF2: fetchBinary 저장 규약(카테고리 dir+.license.txt 동반) 1줄 명시.
3. 실행시 가드 공유 단위테스트·exit0 잠금테스트를 우선 작성해 회귀 게이트로.

## Routing
- 승인. executor 3슬라이스로 진행 가능. 실행 후 architect: exit 계약·가드 공유 검토. 본 Critic 재게이트 불요(잔여 비차단).
