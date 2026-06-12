# design-interview

**Interview-driven page tailoring.** slop 소스를 받아, 디자인 인터뷰로 컨셉·방향을 사용자에게 받아낸 뒤, AI 티 안 나는 랜딩/상세 페이지를 제작하는 에이전트 스킬.

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

프리뷰 CLI (Phase 4):

```bash
node src/cli.js preview built.html --against slop-source.html
# → built.preview.html  (브라우저로 열어 built/original/both 토글 검수)
```

슬롭 감사 CLI (Phase 5, 결정론적):

```bash
node src/cli.js audit built.html
# design-tell audit — built.html
#   FAIL  C1 purple-gradient  ← linear-gradient(135deg,#667eea,#764ba2)
#   ...
#   slop score: 80% (4/5 tells)   ← exit 1, 납품 불가
```

## Layout

| 경로 | 역할 |
|---|---|
| `SKILL.md` | 스킬 본문 — 5단계 오케스트레이션 |
| `core/interview.md` | 6차원 인터뷰 프레임워크 + 명료도 점수 모델 |
| `core/design-tells.md` | AI 디자인 텔 금지 목록 (빌드 규율 + 납품 감사 체크리스트) |
| `templates/concept-sheet.md` | Phase 2 컨셉 시트 양식 |
| `src/preview.js` | inert 프리뷰 빌더 — CSP + 무스크립트 radio 토글 |
| `src/audit.js` | 결정론적 design-tell 감사기 — LLM 자기 채점 없이 코드로 판정 |
| `src/cli.js` | `preview` / `audit` 진입점 |

## Principles

- **클레임 보존**: 디자인이 바뀌어도 소스의 숫자·기능·가격·인과는 불변 ([patina](https://github.com/devswha/patina)의 MPS 원칙).
- **Inert preview**: 검수 화면은 스크립트 실행 불가. patina browser preview의 보안 모델을 따른다.
- **탐지 우회 아님**: 허용된 AI 보조 제작에서 사람 손맛을 입히는 도구다.

## Test

```bash
npm test
```
