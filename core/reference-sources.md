# 레퍼런스 소스 정책

Phase 1의 reference 차원은 “좋아 보이는 URL 하나”가 아니라, 빌드 전에 어떤 레이어를 빌리고 어떤 레이어를 버릴지 잠그는 입력이다. `awesome-design-md` 같은 `DESIGN.md` 컬렉션은 이 목적에 맞는 참고 자료지만, 브랜드별 산문·토큰·이미지·레이아웃을 복사하는 소스가 아니다.

## 소스 등급

| source type | trust level | use policy | do not copy |
|---|---|---|---|
| 사용자 보유 브랜드 가이드·에셋 | high | 프로젝트 정본. 색·서체·로고·금지사항을 우선 적용하고 sidecar를 남긴다. | 라이선스 불명 파일, 누락된 사용권, 설명 없는 원격 링크 |
| 실제 제품/웹사이트 URL | medium | `intake` SSRF 가드와 `shot` 캡처를 거친 뒤, “빌릴 레이어 / 버릴 레이어 / 복제 금지 조건”으로 요약한다. | pixel layout, 페이지 산문, 이미지 파일, 상표를 고객·파트너처럼 보이게 하는 배치 |
| `DESIGN.md` 파일 | medium | 구조화된 design-system 힌트로만 쓴다. 토큰 섹션, 컴포넌트 범주, Do/Don'ts, agent prompt guide 같은 구조를 컨셉 시트 질문으로 바꾼다. | brand-specific tokens, proprietary fonts, 원문 prompt 문장, 브랜드별 컴포넌트 이름 |
| 공개 큐레이션/갤러리 | low | mood vocabulary와 비교 후보를 넓히는 용도. 컨셉 시트에는 출처와 채택하지 않을 점을 함께 기록한다. | 순위·추천 문구의 권위화, preview 이미지, 스폰서/광고 문구 |
| 생성 이미지·자가 제작 스케치 | conditional | source/license sidecar가 있고 컨셉의 시각 앵커로 통합될 때만 사용한다. | 실재 제품 스크린샷처럼 보이는 가짜 화면, 데이터·차트의 사실 주장 |

## `DESIGN.md` 반영 규칙

`DESIGN.md`는 AI가 읽기 좋은 시각 정체성 문서로 취급한다. 사용 가능한 것은 형식과 질문 구조다.

- **빌릴 수 있음**: 색 역할이 분리되는 방식, 타이포 계층을 표로 고정하는 방식, spacing/rounded/component token 범주, Do/Don'ts, responsive behavior, agent prompt guide 같은 섹션 구조.
- **빌리면 안 됨**: 브랜드별 hex 값, proprietary fonts, 상표명 컴포넌트, 이미지 설명, 원문 카피, 특정 사이트의 pixel layout.
- **컨셉 시트 변환**: `DESIGN.md`를 받으면 “시각 언어”와 “토큰 커밋”을 채우기 전, 레퍼런스 브리프 표에 어떤 레이어를 빌릴지 먼저 적는다.
- **복제 금지**: 레퍼런스가 강할수록 “버릴 레이어”와 “복제 금지 조건”을 더 구체적으로 쓴다. 이 조건이 없으면 reference 점수는 1.0이 아니다.

## 레퍼런스 브리프 점수

| 점수 | 조건 |
|---:|---|
| 0.30 | URL 또는 파일만 있고 좋았던 이유가 추상적이다. |
| 0.50 | 좋았던 이유가 있으며 mood/audience 중 하나와 연결된다. |
| 0.75 | 빌릴 레이어가 구체적이다. 예: palette role, typography hierarchy, density, section rhythm, image behavior. |
| 1.00 | 빌릴 레이어, 버릴 레이어, 토큰 영향, 복제 금지 조건이 모두 컨셉 시트에 기록된다. |

## 체크리스트

- [ ] 레퍼런스 출처와 캡처/파일 경로를 기록했다.
- [ ] 빌릴 레이어가 형태가 아니라 역할로 쓰였다.
- [ ] 버릴 레이어가 최소 1개 이상 있다.
- [ ] 토큰 커밋에 영향을 주는 항목을 적었다.
- [ ] 복제 금지 조건이 검수 가능한 문장이다.
