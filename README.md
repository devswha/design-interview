# design-interview

**Interview-driven page tailoring.** slop 소스를 받아, 디자인 인터뷰로 컨셉·방향을 사용자에게 받아낸 뒤, AI 티 안 나는 랜딩/상세/제안서 페이지를 제작하는 에이전트 스킬. 금지 목록(design-tells)과 시니어 원칙(design-principles)을 양면 규율로 쓴다.

AI가 혼자 디자인하지 않는다. 컨셉이 사용자 승인으로 잠기기 전에는 한 줄의 HTML도 생성하지 않는다.

## Workflow

```
slop 소스
  → Phase 0 인테이크         소스 파싱, 클레임(숫자·사실) 동결
  → Phase 1 디자인 인터뷰     6차원 명료도 게이팅, 한 번에 한 질문   (deep-interview 방식)
  → Phase 2 컨셉 잠금        컨셉 시트 승인 — 승인 전 빌드 금지
  → Phase 3 빌드             단일 HTML, design-tells 금지 목록 적용
  → Phase 4 브라우저 프리뷰   built/original/both 토글 검수 루프    (patina browser 방식)
  → Phase 5 슬롭 감사 + 납품  design-tells 체크리스트 + 클레임 대조
```

## Usage

스킬로 호출:

```
/skill:design-interview --standard ./slop-draft.md
```

인테이크 CLI (Phase 0 — 클레임 동결):

```bash
node src/cli.js intake slop-source.html --json   # 가격·수량·기간·기능 클레임 구조화
node src/cli.js intake https://example.com/page  # URL은 SSRF 가드 통과 필수
```

프리뷰 CLI (Phase 4):

```bash
node src/cli.js preview built.html --against slop-source.html
# → built.preview.html  (브라우저로 열어 built/original/both 토글 검수)
node src/cli.js shot built.html                  # desktop/mobile 풀페이지 캡처 → 자기검수
```

슬롭 감사 CLI (Phase 5, 결정론적):

```bash
node src/cli.js audit built.html --visual
# design-tell audit — built.html
#   FAIL  C1 purple-gradient        ← linear-gradient(135deg,#667eea,#764ba2)  (정적: CSS 파싱)
#   FAIL  S3 perfect-symmetry       ← 8/8 text blocks render center-aligned   (시각: 렌더 기하)
#   ...
#   slop score: 71% (5/7 tells)     ← exit 1, 납품 불가
# --visual은 puppeteer 필요; 미설치면 정적 텔만 판정
```

벤치마크 (텔 수정 시 회귀 게이트):

```bash
npm run benchmark
# 4/4 fixtures match baseline — miss(탐지 후퇴)/fp(오탐 후퇴) 발생 시 exit 1
```

## Layout

| 경로 | 역할 |
|---|---|
| `SKILL.md` | 스킬 본문 — 5단계 오케스트레이션 |
| `core/interview.md` | 6차원 인터뷰 프레임워크 + 명료도 점수 모델 (+ 제안서 장르 보정) |
| `core/design-tells.md` | AI 디자인 텔 금지 목록 (빌드 규율 + 납품 감사 체크리스트) |
| `core/design-principles.md` | 시니어 디자인 원칙 24종 — 텔의 양성 대응물 (토큰 규율 + 제안서 장르 + 기계 검사 레인) |
| `templates/concept-sheet.md` | Phase 2 컨셉 시트 양식 |
| `src/intake.js` | 클레임 추출기 + SSRF 가드 URL fetch |
| `src/preview.js` | inert 프리뷰 빌더 — CSP + 무스크립트 radio 토글 |
| `src/audit.js` | 정적 design-tell 감사기 — LLM 자기 채점 없이 코드로 판정 |
| `src/geometry.js` | 시각 텔(L1/S3) — 렌더된 박스 기하 판정 |
| `src/screenshot.js` | desktop/mobile 풀페이지 캡처 (puppeteer 선택 의존) |
| `src/cli.js` | `intake` / `preview` / `audit` / `shot` 진입점 |

## Principles

- **클레임 보존**: 디자인이 바뀌어도 소스의 숫자·기능·가격·인과는 불변 ([patina](https://github.com/devswha/patina)의 MPS 원칙).
- **Inert preview**: 검수 화면은 스크립트 실행 불가. patina browser preview의 보안 모델을 따른다.
- **탐지 우회 아님**: 허용된 AI 보조 제작에서 사람 손맛을 입히는 도구다.

## Test

```bash
npm test            # unit + e2e (e2e는 intake→audit→preview→shot 실CLI 파이프라인)
npm run benchmark   # baseline 회귀 게이트
```
