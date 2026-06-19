# design-interview

**Interview-driven page tailoring.** slop 소스를 받아, 디자인 인터뷰로 컨셉·방향을 사용자에게 받아낸 뒤, AI 티 안 나는 랜딩/상세/제안서 페이지를 제작하는 에이전트 스킬. 금지 목록(design-tells)과 시니어 원칙(design-principles)을 양면 규율로 쓴다.

AI가 혼자 디자인하지 않는다. 라운드마다 디자이너가 방향을 *추천*하되 결정은 사용자가 하고, 컨셉이 사용자 승인으로 잠기기 전에는 한 줄의 HTML도 생성하지 않는다.

## Install

Claude Code — 플러그인 마켓플레이스 (클론 없이, 권장):

```text
/plugin marketplace add devswha/design-interview
/plugin install design-interview@design-interview
```

Claude Code · Codex CLI · Cursor · OpenCode — 설치 스크립트:

```bash
curl -fsSL https://raw.githubusercontent.com/devswha/design-interview/main/install.sh | bash
```

설치 후 Claude 세션에서 스킬을 호출한다:

```text
/design-interview --standard ./slop-draft.md
/design-interview --quick   https://example.com/landing
```

비시각 레인(intake/audit/preview/assets/crawl)은 **런타임 의존성 0**이라 클론만으로 동작한다.
시각 레인(`shot`, `audit --visual` — 풀페이지 스크린샷 + 렌더 기하 텔)은 puppeteer가 필요하다:

```bash
cd ~/.claude/skills/design-interview && npm install   # 없으면 정적 레인으로 자동 폴백
```

설치 제어 환경변수: `DI_REF=<tag-or-sha>` (체크아웃 핀), `DI_REPO_URL=<url-or-path>` (소스 repo), `INSTALL_{CLAUDE,CODEX,CURSOR,OPCODE}=true|false`.

Gajae Code (`gjc`) — 네이티브 스킬:

gjc는 `native` 스킬만 인식한다 — `~/.gjc/agent/skills/<name>/SKILL.md`(유저) 또는 `<project>/.gjc/skills/<name>/SKILL.md`(프로젝트). 위 install.sh로 엔진을 깐 뒤(`~/.claude/skills/design-interview`) 심볼릭 링크로 노출한다:

```bash
mkdir -p ~/.gjc/agent/skills
ln -sfn ~/.claude/skills/design-interview ~/.gjc/agent/skills/design-interview
```

`~/.gjc/agent/config.yml`에서 네이티브 스킬 탐색을 켠다 (기본 off):

```yaml
skills:
  enabled: true
  enablePiUser: true        # 유저 레벨. 특정 프로젝트 한정이면 .gjc/skills/ + enablePiProject: true
```

이후 어느 gjc 세션에서나 `/skill:design-interview`로 호출한다:

```text
/skill:design-interview --standard ./slop-draft.md
```

엔진(`src/cli.js`)은 SKILL.md의 `$DI` 리졸버가 `~/.claude/skills/design-interview`에서 찾으므로 cwd와 무관하게 동작한다. 이미 로컬 클론이 있으면 두 경로(`~/.claude/skills/...`, `~/.gjc/agent/skills/...`)를 클론으로 걸어도 된다. gjc의 "묻지 말고 바로 실행" 기본값은 이 스킬의 **인터뷰-우선 실행 계약**이 덮어쓴다 — 인터뷰 없이 마무리하지 않는다.

## Workflow

```
slop 소스
  → Phase 0 인테이크         소스 파싱, 클레임(숫자·사실) 동결
  → Phase 1 디자인 인터뷰     6차원 게이팅, 한 번에 한 질문 + 라운드별 추천(쉬운 말 규율)
  → Phase 2 컨셉 잠금        컨셉 시트 승인 — 승인 전 빌드 금지
  → Phase 3 빌드             단일 HTML, design-tells 금지 목록 적용
  → Phase 4 브라우저 프리뷰   built/original/both 토글 검수 루프    (patina browser 방식)
  → Phase 5 슬롭 감사 + 납품  design-tells 체크리스트 + 클레임 대조
```

## Usage

스킬로 호출:

```
/design-interview --standard ./slop-draft.md
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

에셋 준비도 CLI (Phase 1/2):

```bash
node src/cli.js assets assets --concept-sheet concept-sheet.md
# prebuild readiness: READY        → 컨셉 승인/빌드 가능
# prebuild readiness: NOT READY    → 시각 앵커 수집/생성 후 다시 실행
node src/cli.js crawl https://example.com/hero.png --out assets/images --name hero.png
# consent-gated 외부 에셋 수집 — 사용자 허락 후 실행, sidecar license는 수동 확인
```

벤치마크 (텔 수정 시 회귀 게이트):

```bash
npm run benchmark
# all fixtures match baseline — miss(탐지 후퇴)/fp(오탐 후퇴) 발생 시 exit 1
```

레퍼런스/`DESIGN.md` 반영 (Phase 1/2):

```text
core/reference-sources.md      # URL, DESIGN.md, 갤러리, 생성 에셋의 사용 정책
templates/concept-sheet.md     # 레퍼런스 브리프: 빌릴 레이어 / 버릴 레이어 / 토큰 영향 / 복제 금지 조건
```

## Layout

| 경로 | 역할 |
|---|---|
| `SKILL.md` | 스킬 본문 — Phase 0–5 오케스트레이션 |
| `core/interview.md` | 6차원 인터뷰 프레임워크 + 명료도 점수 모델 (+ 제안서 장르 보정) |
| `core/reference-sources.md` | URL·DESIGN.md·갤러리 레퍼런스 사용 정책 — 구조만 빌리고 복제 금지 |
| `core/design-tells.md` | AI 디자인 텔 금지 목록 — 레이아웃/색/타이포/구조/모션 + AI 다이어그램 클리셰(S6) (빌드 규율 + 납품 감사 체크리스트) |
| `core/design-principles.md` | 시니어 디자인 원칙 24종 — 텔의 양성 대응물 (토큰 규율 + 제안서 장르 + 기계 검사 레인) |
| `templates/concept-sheet.md` | Phase 2 컨셉 시트 양식 |
| `src/intake.js` | 클레임 추출기 + SSRF 가드 URL fetch |
| `src/preview.js` | inert 프리뷰 빌더 — CSP + 무스크립트 radio 토글 |
| `src/audit.js` | 정적 design-tell 감사기 — LLM 자기 채점 없이 코드로 판정 |
| `src/asset-readiness.js` | prebuild asset readiness — font-only/0-asset 빌드 방지 신호 |
| `src/geometry.js` | 시각 텔(L1/S3) — 렌더된 박스 기하 판정 |
| `src/screenshot.js` | desktop/mobile 풀페이지 캡처 (puppeteer 선택 의존) |
| `src/cli.js` | `intake` / `preview` / `audit` / `shot` / `assets` / `crawl` 진입점 |

## Principles

- **클레임 보존**: 디자인이 바뀌어도 소스의 숫자·기능·가격·인과는 불변 ([patina](https://github.com/devswha/patina)의 MPS 원칙).
- **Inert preview**: 검수 화면은 스크립트 실행 불가이며 원격 stylesheet 링크를 보존하지 않는다. patina browser preview의 보안 모델을 따른다.
- **Asset-first**: font-only·0-asset 상태에서는 컨셉을 잠그지 않는다. 최소 1개 이상의 sidecar 있는 logo/image/texture가 필요하다.
- **Reference-safe**: `DESIGN.md`와 레퍼런스 갤러리는 시각 언어 구조를 빌리는 입력이다. 브랜드별 토큰·원문·이미지·pixel layout은 복제하지 않는다.
- **탐지 우회 아님**: 허용된 AI 보조 제작에서 사람 손맛을 입히는 도구다.

## Test

```bash
npm test            # unit + e2e (e2e는 intake→audit→preview→shot 실CLI 파이프라인)
npm run benchmark   # baseline 회귀 게이트
```
