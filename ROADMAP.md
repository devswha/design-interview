# design-interview 로드맵

patina 트랙(스킬 + 결정론적 엔진 + 벤치마크)을 따른다. 각 마일스톤은 수용 기준이 코드로 검증 가능해야 닫힌다.

## M0 — 스캐폴드 ✅

스킬 + inert 브라우저 프리뷰.

- [x] SKILL.md 5-phase 오케스트레이션 (인터뷰 게이트 2개: 컨셉 잠금, 납품 감사)
- [x] `core/interview.md` 6차원 명료도 모델, `core/design-tells.md` 텔 목록 18종
- [x] `src/preview.js` — CSP + 무스크립트 radio 토글 (patina browser 방식)
- [x] 단위 테스트 (`npm test`)

## M1 — 결정론적 감사 엔진 ✅

LLM 자기 채점 제거.

- [x] `src/audit.js` — C1/T1/T2/T4/S5 기계 판정, slop score
- [x] `audit` CLI 레인, fail 시 exit 1 (납품 차단)
- [x] 오탐 방지 테스트 (속성/CSS 제외, 비보라 그라데이션 허용 등)

## M2 — 벤치마크 / 회귀 게이트 ✅

텔을 추가·수정할 때 좋아졌는지 나빠졌는지 숫자로 안다.

- [x] `tests/fixtures/{slop,clean}/` 픽스처 코퍼스
- [x] `tests/quality/baseline.json` — 픽스처별 기대 판정
- [x] `npm run benchmark` — baseline 대비 탐지 누락(miss)·오탐(false positive) 회귀 시 exit 1
- [ ] 코퍼스 확장: 실제 AI 생성 랜딩 10종+ (v0/lovable/bolt 산출물 수집) — `tests/redteam/` 적대 픽스처 8종은 확보됨

## M3 — 비주얼 레인 ✅

레이아웃 텔(L1, S3)을 기계 레인으로 승격. 모델이 자기 산출물을 *눈으로* 검수.

- [x] `src/screenshot.js` — puppeteer 동적 로드, 미설치 시 명확한 안내 (선택 의존성, typed error)
- [x] Phase 4에 스크린샷 자기검수 단계 추가 (shot → 모델이 이미지 검토 → 수정)
- [x] 기하 기반 탐지: `src/geometry.js` — 렌더된 박스 좌표로 L1(균일 그리드)·S3(완전 대칭) 판정, `audit --visual` 합류
- [x] L2(전부 중앙 단일컬럼) 기하 판정 승격 — M6에서 해소. L3는 적대 심사 기각(M6 기각 기록 참조)
- [ ] viewport 2종(모바일/데스크탑) 캡처를 감사 리포트에 첨부

## M4 — 소스 인테이크 파이프라인 ✅ (스냅샷 동결만 잔여)

Phase 0의 URL 경로를 코드로.

- [x] 클레임 추출기 — 가격·수량·백분율·기간·기능 클레임 구조화, Phase 5 대조표 자동 생성
- [x] `intake` CLI 레인 — 파일/URL 입력, `--json`
- [x] SSRF 가드 — private/loopback/link-local/메타데이터 대역 차단, DNS 해석 검증, 리다이렉트 hop별 재검증, 5MB/30s 캡
- [ ] URL → 에셋 동결 스냅샷 (patina `freezeSnapshotAssets` 축소판: same-origin CSS 인라인)

## M4.5 — E2E 파이프라인 검증 ✅

- [x] `tests/e2e/pipeline.test.js` — intake→audit(--visual)→preview→shot 실CLI 호출 검증
- [x] `npm test` = unit + e2e, `npm run test:e2e` 분리 실행
- [x] CLI 에러 규율: 입력 오류 exit 2(스택트레이스 금지), 감사 fail exit 1, 시각 폴백은 puppeteer 미설치 한정

## M5 — 패키징 / 판매

- [ ] `install.sh` — Claude Code / Codex / Cursor / OpenCode 스킬 설치 (patina install.sh 방식)
- [ ] 버전드 스킬 번들 + CHANGELOG
- [ ] patina 연동: 설치 감지 시 Phase 5 카피 감사를 `patina --score`로 자동 위임
- [ ] 데모 자산: before/after GIF, slop score 배지

## M6 — 시니어 디자이너 고도화 (양성 원칙 레이어)

음성 텔 목록만으로는 "AI 티 없음"까지만 간다. 시니어가 *하는* 것의 레이어를 추가
(리서치: 10개 소스 207개 원시 원칙 → 적대적 종합·비평 → 24개 채택, `artifacts/research/`).

- [x] `core/design-principles.md` — 24개 원칙 (TY/SP/CO/LA/HI/CN/IM/DE/PR), 레인 표기, 충돌 해소 기록
- [x] SKILL.md 통합 — Phase 2 토큰 커밋, Phase 3 토큰 우선 빌드 + 양성 규율, Phase 5 원칙 감사 (기계/LLM 레인 분리 유지)
- [x] 제안서(proposal) 페이지 유형 — `--page proposal`, 인터뷰 차원 재해석, 컨셉 시트 제안서 블록, PR1 스파인
- [x] 정적 기계 검사 4종 승격: TY4(패밀리 규율)·CO1(색 리터럴 예산)·DE1(그림자 물리)·DE3(품질 바닥선 + warn 채널)
- [x] 시각 기계 검사 3종: L2 승격(M3 백로그 해소)·TY1(타입 스케일)·TY2(행길이/본문 크기) + isVisible 강화(opacity/오프스크린/클립 디코이 방어)
- [x] DE1 포커스 링 스코핑(:focus류 box-shadow는 고도 예산 제외 — DE3 권장 대체와의 자가당착 해소) + shot/geometry에 `document.fonts.ready` 대기(slides-grab 채용 — 웹폰트 적용 전 측정 방지)
- [ ] 승격 대기 (비평 통과, 구현 유예): HI2 뷰포트 CTA 카운트, LA3 듀얼 렌더, PR1 정적 스파인(장르 플래그 필요), CO1 arm b(원형 hue 클러스터), TY5 한글 조건부
- [ ] C5 left-accent-card 기계 승격 검토 (slides-grab 검토에서 채용한 신규 LLM 텔 — 정적 기준 스케치: border-left solid 채도색 + radius 동일 룰 + 반복 카운트) / 모바일 가로 오버플로 기하 검사 (LA3 듀얼 렌더와 합류)
- [ ] 대비(4.5:1) 렌더 시점 기계 검사 — 최고가치 시각 후보
- [ ] img alt 정적 검사 (장식 alt="" 허용)
- [ ] 다크 극성 수치 — CO2/CO3/DE1의 다크 캔버스 대응 수치 리서치
- [ ] 기각 기록: L3(우회 취약), TY3(line-height:normal 함정), DE2(상속 속성 — 정적 부적합, 시각 재설계 필요)

## 운영 원칙

- 텔 추가는 반드시 픽스처 + baseline 갱신과 한 커밋으로 (M2 게이트가 강제)
- 기계 레인이 커버하는 텔은 SKILL.md LLM 체크리스트에서 제거 — 이중 채점 금지
- 의존성은 선택적으로: puppeteer 없는 환경에서도 M0~M2 전 기능 동작
