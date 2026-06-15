# 컨셉 시트 — {프로젝트명}

> Phase 2 산출물. 사용자 승인으로 잠긴다. 빌드는 이 시트를 벗어날 수 없다.

## 방향 선언

{○○처럼 보이고 ○○처럼 읽히는 페이지 — 한 문장}

## 인터뷰 요약

| 차원 | 결정 | 최종 점수 |
|---|---|---|
| audience | {도착 맥락 한 문장} | {0.00} |
| mood | {형용사 + 대비 진술} | {0.00} |
| brand | {자산 유무, 색/서체} | {0.00} |
| structure | {첫 화면 우선순위} | {0.00} |
| conversion | {단일 전환 행동 + CTA 방향} | {0.00} |
| reference | {URL + 좋았던 이유} | {0.00} |

## 시각 언어

- **팔레트**: {색상 3–5개, 각 역할 — 배경/본문/강조/보더}
- **타이포**: 제목 {폰트명/웨이트}, 본문 {폰트명/크기/행간}
- **밀도·여백**: {빽빽/표준/성김 + 근거}

## 토큰 커밋 (design-principles 빌드 전 결정 — 잠금 대상)

| 토큰 | 결정 | 근거 원칙 |
|---|---|---|
| 타입 스케일 | {비율 또는 값 세트, ≤6단계 — 예: 16/19/24/32/44} | TY1 |
| 본문 크기 | {16–21px 중 선택 — 밀도 방침에서 도출, 고정 디폴트 금지} | TY2 |
| 폰트 성격 분류 | {우아/담백/기술적/경쾌 + 디스플레이·본문 페어링} | TY4 |
| 스페이싱 스케일 | {예: 4/8 기반 {8,16,24,32,48,64,96}} | SP1 |
| 극성 | {라이트/다크 — 명시 선택, 디폴트 없음} | CO2 |
| 시그니처 무브 | {최대 1개 — 최강 차별점에서 도출, 없으면 "없음"} | HI2/LA2 |
| 모션 역할·예산 | {motion-role: none/orientation/feedback/progress/reveal/delight · motion-budget: 0/micro-only/one-signature — CSS-first 무JS} | MO1/MO4 |
| 시각 임팩트 | {첫 viewport 지배요소 1개 · 타입스케일 드라마(양끝) · 대비 헤드룸} | 시각 임팩트/HI2 |
| 에셋 계획 (Sourcing Plan) | {per-asset 1행: asset-type(logo/image/texture/font) · 경로(path\|generate\|samples\|crawl) · 실제 파일 · source/license 메모. 예: `logo · path · assets/icons/brand.svg · CC0 자작` / `texture · samples · assets/samples/textures/paper-noise.svg · CC0`} | asset-library |
| 에셋 준비도 | {`node src/cli.js assets assets --concept-sheet <this>` 결과: prebuild readiness READY · usable visual anchors N. NOT READY면 승인 요청 금지} | asset-library |
<!-- 이 행이 placeholder만으로 비면 `node src/cli.js assets` advisory 경고 발생 -->

## 섹션 구조 (위→아래)

1. {섹션명} — 역할: {단 하나}
2. …

## 카피 보이스

{소스 클레임을 어떤 목소리로 재서술할지 — 어미, 거리감, 문장 길이}

## 하지 않을 것

design-tells에서 이 컨셉에 특히 위험한 항목:

- [ ] {id} — {이 프로젝트에서 위험한 이유}
- [ ] …

## 보존 클레임 (변경 불가)

| 클레임 | 소스 위치 |
|---|---|
| {숫자/기능/가격} | {줄/섹션} |

## 제안서 전용 (--page proposal일 때만)

- **수신**: prepared-for {클라이언트명 — 동결}, prepared-by {벤더}, 날짜 {…}, 버전 {…}, 유효기한 {동결}
- **평가 루브릭**: {배점표 유무, 항목별 가중치 → 섹션 분량 예산}
- **클라이언트 문제 표현**: {클라이언트 자신의 말 — 동결, problem 섹션 서두에 사용}
- **유일 CTA**: {mailto/캘린더/서명란 + 실명 담당자}
- **스파인 확인**: summary → problem → approach → evidence → pricing → next-steps (PR1 — 가격은 접근 뒤)

---
승인: {날짜 / 사용자 확인}
