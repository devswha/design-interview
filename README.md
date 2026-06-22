<p align="center">
  <img src="assets/icons/design-interview-mark.svg" alt="design-interview mark" width="148">
</p>

<h1 align="center">design-interview</h1>

<p align="center">
  <strong>Interview-driven page tailoring. No AI slop.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
  <a href="#install"><img alt="Skill: Claude Code | Codex | Cursor | OpenCode | gajae" src="https://img.shields.io/badge/Skill-Claude%20Code%20%7C%20Codex%20%7C%20Cursor%20%7C%20OpenCode%20%7C%20gajae-blueviolet"></a>
  <img alt="runtime deps: 0" src="https://img.shields.io/badge/runtime%20deps-0-brightgreen">
  <img alt="audit: deterministic" src="https://img.shields.io/badge/audit-deterministic-blue">
  <img alt="node &gt;= 22.12" src="https://img.shields.io/badge/node-%3E%3D22.12-339933">
</p>

slop 소스를 받아 **디자인 인터뷰**로 컨셉·방향을 사용자에게 받아낸 뒤, AI 티 안 나는 랜딩/상세/제안서 페이지를 만드는 에이전트 스킬. 금지 목록(`design-tells`)과 시니어 원칙(`design-principles`)을 양면 규율로 쓰고, 납품 직전 **결정론적 감사**로 슬롭 지문을 코드로 차단한다.

AI가 혼자 디자인하지 않는다 — 라운드마다 디자이너가 방향을 *추천*하되 결정은 사용자가 하고, 컨셉이 사용자 승인으로 잠기기 전에는 한 줄의 HTML도 생성하지 않는다.

탐지 우회 도구가 아니다. 허용된 AI 보조 제작에서 사람 손맛을 입히고, 검수 화면은 스크립트가 돌지 않는 **inert HTML**(CSP 잠금, 원격 리소스 없음)로 남긴다.

## Workflow

```text
slop 소스
  → Phase 0  인테이크       소스 파싱, 클레임(숫자·사실) 동결
  → Phase 1  디자인 인터뷰   6차원 게이팅, 한 번에 한 질문 + 라운드별 추천(쉬운 말)
                            ↳ 선택지는 브라우저 옵션 보드(inert HTML)로 보여주고 사용자가 고른다
  → Phase 2  컨셉 잠금       컨셉 시트 승인 — 승인 전 빌드 금지
  → Phase 3  빌드           단일 HTML, design-tells 금지 목록 적용
  → Phase 4  브라우저 프리뷰  built / original / both 토글 검수 루프
  → Phase 5  슬롭 감사 + 납품  design-tell 체크리스트 + 클레임 대조
```

## Install

**Claude Code — 플러그인 마켓플레이스 (클론 없이, 권장):**

```text
/plugin marketplace add devswha/design-interview
/plugin install design-interview@design-interview
```

**Claude Code · Codex CLI · Cursor · OpenCode — 설치 스크립트:**

```bash
curl -fsSL https://raw.githubusercontent.com/devswha/design-interview/main/install.sh | bash
```

설치 후 스킬을 호출한다:

```text
/design-interview --standard ./slop-draft.md
/design-interview --quick   https://example.com/landing
```

비시각 레인(`intake`/`audit`/`preview`/`assets`/`crawl`)은 **런타임 의존성 0**이라 클론만으로 동작한다. 시각 레인(`shot`, `audit --visual` — 풀페이지 스크린샷 + 렌더 기하 텔)은 puppeteer가 필요하다:

```bash
cd ~/.claude/skills/design-interview && npm install   # 없으면 정적 레인으로 자동 폴백
```

설치 제어 환경변수: `DI_REF=<tag-or-sha>` (체크아웃 핀), `DI_REPO_URL=<url-or-path>` (소스 repo), `INSTALL_{CLAUDE,CODEX,CURSOR,OPCODE}=true|false`.

**Gajae Code (`gjc`) — 네이티브 스킬:**

gjc는 `native` 스킬만 인식한다(`~/.gjc/agent/skills/<name>/SKILL.md` 또는 `<project>/.gjc/skills/<name>/SKILL.md`). 위 스크립트로 엔진을 깐 뒤 심볼릭 링크로 노출한다:

```bash
mkdir -p ~/.gjc/agent/skills
ln -sfn ~/.claude/skills/design-interview ~/.gjc/agent/skills/design-interview
```

`~/.gjc/agent/config.yml`에서 네이티브 스킬 탐색을 켜고(`skills.enabled: true`, 유저 레벨이면 `enablePiUser: true`) `/skill:design-interview`로 호출한다. 엔진(`src/cli.js`)은 SKILL.md의 `$DI` 리졸버가 경로를 풀어 cwd와 무관하게 동작한다. gjc의 "묻지 말고 바로 실행" 기본값은 이 스킬의 **인터뷰-우선 실행 계약**이 덮어쓴다 — 인터뷰 없이 마무리하지 않는다.

> gjc 주의: 빌드 단계에서 쓰기 도구가 막히면 'interview' 키워드로 시드된 번들 `deep-interview` 가드일 수 있다 — `gjc state clear --mode deep-interview`로 해제한다(우리 인터뷰와 무관한 cwd 가드).

## Commands

CLI 진입점은 `node src/cli.js <command>`. 모든 서브커맨드는 미지 플래그·잉여 인자에 즉시 exit 2(usage)로 실패한다.

| Command | Phase | Purpose |
|---|---|---|
| `intake <src> [--json]` | 0 | 클레임(가격·수량·기간·기능) 구조화 추출·동결. URL은 SSRF 가드 통과 필수 |
| `board <opts.json> --out <f> [--serve --port <n>]` | 1 | 검증된 옵션 모델 → inert 옵션 보드 HTML (시각 인터뷰) |
| `assets <dir> [--concept-sheet <f>] [--json]` | 1/2 | prebuild readiness — sidecar 있는 시각 앵커 존재 확인 |
| `crawl <url> --out <dir> [--name <f>]` | 1/2 | consent-gated 외부 에셋 수집 + provenance sidecar |
| `preview <built> [--against <slop>]` | 4 | inert built/original/both 토글 프리뷰 HTML |
| `shot <built>` | 4 | desktop/mobile 풀페이지 캡처 (puppeteer 필요) |
| `audit <built> [--visual]` | 5 | 결정론적 design-tell 감사 — LLM 자기 채점 없이 코드로 판정 |

핵심 흐름:

```bash
# Phase 1 — 시각 인터뷰: 옵션 카드를 브라우저로 비교, 추천 배지 표시
node src/cli.js board round2.options.json --out board.html
#   → file:///…/board.html   (file:// 막는 호스트는 --serve로 localhost 폴백)
node src/cli.js board round2.options.json --out board.html --serve --port 8787

# Phase 4 — 검수: built ⇄ original 토글, 풀페이지 스크린샷 자기검수
node src/cli.js preview built.html --against slop-source.html   # → built.preview.html
node src/cli.js shot built.html

# Phase 5 — 결정론적 슬롭 감사 (FAIL이면 exit 1, 납품 불가)
node src/cli.js audit built.html --visual
#   FAIL  C1 purple-gradient    ← linear-gradient(135deg,#667eea,#764ba2)
#   FAIL  S3 perfect-symmetry   ← 8/8 text blocks render center-aligned
#   slop score: 71% (5/7 tells)
```

옵션 보드와 프리뷰 출력은 inert 보안 모델을 공유한다: 무스크립트, 원격 리소스 없음, 모든 사용자 텍스트 escape, `--against` 토글은 스크립트 없는 radio-hack. `imageFile` 카드는 pre-sized 실제 파일(+sidecar)만 magic-byte 검증 후 임베드한다(생성·리사이즈 금지).

## Layout

| 경로 | 역할 |
|---|---|
| `SKILL.md` | 스킬 본문 — Phase 0–5 오케스트레이션 |
| `core/interview.md` | 6차원 인터뷰 프레임워크 + 명료도 점수 모델 (+ 제안서 장르 보정) |
| `core/reference-sources.md` | URL·DESIGN.md·갤러리 레퍼런스 사용 정책 — 구조만 빌리고 복제 금지 |
| `core/design-tells.md` | AI 디자인 텔 금지 목록 (빌드 규율 + 납품 감사 체크리스트) |
| `core/design-principles.md` | 시니어 디자인 원칙 24종 — 텔의 양성 대응물 (토큰 규율 + 기계 검사 레인) |
| `core/asset-library.md` | 에셋 인벤토리·라이선스 sidecar 규칙 |
| `templates/concept-sheet.md` | Phase 2 컨셉 시트 양식 |
| `assets/` | 자가호스팅 폰트·이미지·텍스처·아이콘 + `.license.txt` sidecar (브랜드 마크 포함) |
| `src/intake.js` | 클레임 추출기 + SSRF 가드 URL fetch |
| `src/board.js` | Phase 1 옵션 보드 직렬화 — 검증 옵션 모델 → inert 단일 HTML |
| `src/preview.js` | inert 프리뷰 빌더 — CSP + 무스크립트 토글, 패널별 CSS 스코프 |
| `src/inert-html.js` | 액티브 콘텐츠 스트립 + 원격 URL 무력화 + INERT_CSP (preview·board 공유) |
| `src/audit.js` | 정적 design-tell 감사기 — 코드로 판정 |
| `src/geometry.js` | 시각 텔(L1/S3) — 렌더된 박스 기하 판정 |
| `src/screenshot.js` | desktop/mobile 풀페이지 캡처 (puppeteer 선택 의존) |
| `src/cli.js` | `intake`/`board`/`preview`/`audit`/`shot`/`assets`/`crawl` 진입점 |

## Principles

- **클레임 보존** — 디자인이 바뀌어도 소스의 숫자·기능·가격·인과는 불변 ([patina](https://github.com/devswha/patina)의 MPS 원칙).
- **Inert preview** — 검수 화면은 스크립트 실행 불가이며 원격 stylesheet 링크를 보존하지 않는다. patina browser preview의 보안 모델을 따른다.
- **Visual interview** — 인터뷰 선택지는 텍스트가 아니라 브라우저 옵션 보드로 보여준다. 보드는 판단하지 않고 검증된 옵션 모델을 inert HTML로 직렬화만 한다(추천·점수·열기는 호스트 레이어).
- **Asset-first** — font-only·0-asset 상태에서는 컨셉을 잠그지 않는다. 최소 1개 이상의 sidecar 있는 logo/image/texture가 필요하다.
- **Reference-safe** — `DESIGN.md`와 레퍼런스 갤러리는 시각 언어 *구조*를 빌리는 입력이다. 브랜드별 토큰·원문·이미지·pixel layout은 복제하지 않는다.
- **결정론적 게이트** — 하드 텔은 blocking, 표현 항목은 advisory. advisory는 납품을 막지 않고, blocking은 항상 막는다. 회귀는 baseline 벤치마크가 union으로 잡는다.

## Test

```bash
npm test            # unit + e2e (e2e는 intake→audit→preview→shot 실CLI 파이프라인)
npm run benchmark   # baseline 회귀 게이트 — miss(탐지 후퇴)/fp(오탐 후퇴) 시 exit 1
```

## License

MIT. See [LICENSE](LICENSE).
