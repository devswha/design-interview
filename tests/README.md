# 테스트 컨벤션

`node:test` 기반. **프레임워크·빌드·러너 설정 없음** — `node --test`가 전부다. 새 테스트도 이 규약을 따른다.

## 레이아웃

| 디렉터리 | 용도 | 러너 글롭 |
|---|---|---|
| `tests/unit/*.test.js` | 모듈 단위 + CLI 표면 계약 | `npm run test:unit` |
| `tests/e2e/*.test.js` | 실제 CLI(`node src/cli.js`)로 파이프라인 검증 | `npm run test:e2e` |
| `tests/fixtures/{clean,slop,assets}/` | 기대 판정이 고정된 입력. **모든 픽스처는 여기 또는 `redteam/`에 둔다 — 레포 루트 금지.** | — |
| `tests/redteam/` | 적대적 픽스처(우회·오탐 회귀) | — |
| `tests/quality/` | 벤치마크 게이트(`baseline.json` + `benchmark.mjs`) | `npm run benchmark` |
| `tests/helpers/` | 공유 하네스(아래). `*.test.js`가 아니라 러너에 안 잡힌다. | — |

## 공유 하네스 (`tests/helpers/index.js`)

보일러플레이트는 직접 만들지 말고 **반드시 헬퍼를 쓴다.** 규약을 바꾸려면 이 파일 하나만 고친다.

```js
// 경로·CLI·임시디렉터리·감사조회 — 비시각 테스트도 안전(puppeteer 안 끌어옴)
import {
  ROOT, repoPath, repoUrl, fixturePath, redteamPath, examplePath, CLI,
  runCli, withTempDir, findingById, hasWarning,
} from '../helpers/index.js';

// puppeteer 게이트 — 시각 레인(geometry/shot) 테스트에서만 import
import { hasPuppeteer, visualTest, noPuppeteerTest } from '../helpers/puppeteer.js';
```

- **경로**: 인라인 `new URL('../../…', import.meta.url)` 금지. `fixturePath('clean/x.html')`, `redteamPath('y.html')`, `examplePath('slop-source.html')`, 또는 `repoPath`/`repoUrl`을 쓴다.
- **CLI 실행**: `execFile`/`promisify` 직접 만들지 말고 `runCli(...argv)` → `{ code, stdout, stderr }`. `process.execPath` + `cwd=ROOT` 단일 규약(상대 인자가 호출 위치와 무관하게 풀린다).
- **puppeteer**: 직접 `import('puppeteer')` 감지 금지. 시각 레인 테스트는 `test('…', visualTest, …)`, 미설치 분기 테스트는 `noPuppeteerTest`. 둘 다 skip 사유를 남긴다.
- **임시 디렉터리**: `mkdtemp`+`finally`+`rm` 직접 짜지 말고 `withTempDir(async (dir) => { … })`. 권한 잠금/정리 오류까지 견고하게 처리한다.
- **감사 결과**: `findings.find((f) => f.id === 'X')` 대신 `findingById(findings, 'X')`(없으면 명확히 throw), 경고는 `hasWarning(warnings, 'name')`.

## 머신 레인 검사 추가 규칙 (불변식)

새 머신 레인 검사(static/visual)는 **한 커밋 안에** 다음을 모두 포함한다:

1. 검사 구현(`src/audit.js` 또는 `src/geometry.js`)
2. 양면 픽스처: 발화하는 입력 + 발화하면 안 되는 clean 가드(오탐0)
3. `tests/quality/baseline.json` 갱신 — `npm run benchmark` 통과
4. 해당 tell/principle 코어 문서(`core/design-tells.md` / `core/design-principles.md`)와 `SKILL.md` 동기화

머신 레인으로 승격된 항목은 LLM 체크리스트에서 제거한다(이중 채점 금지).

## 에러 규율 테스트

CLI 사용자 입력 오류는 **스택트레이스 없이** 메시지 + 올바른 exit code여야 한다. 회귀 방지로 항상 함께 단언한다:

```js
const r = await runCli('audit', 'does-not-exist.html');
assert.equal(r.code, 2);
assert.ok(!r.stderr.includes('node:internal'), 'no stack trace');
```

exit code: 입력 오류 `2` · 감사 fail/fetch fail/shot fail `1` · 정상 `0`.
