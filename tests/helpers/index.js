// tests/helpers — 공유 테스트 하네스 (node:test 기반, 프레임워크·빌드 없음).
//
// 테스트 파일마다 흩어져 미묘하게 달랐던 보일러플레이트를 한곳으로 모은다.
// 규약을 바꾸려면 이 파일 하나만 고친다.
//
//   1) 경로 해석   — ROOT / repoPath / repoUrl / fixturePath / redteamPath / examplePath / CLI
//   2) CLI 실행    — runCli(...argv) → { code, stdout, stderr }  (단일 규약)
//   3) 임시 디렉터리 — withTempDir(fn)  (성공·실패·권한오류 무관 정리)
//   4) 감사 결과 조회 — findingById / hasWarning
//
// puppeteer 게이트(hasPuppeteer / visualTest / noPuppeteerTest)는 ./puppeteer.js에 분리한다 —
// 비시각 단위 테스트가 puppeteer 모듈을 끌어오지 않도록(ROADMAP: 시각 외는 puppeteer 불요).
//
// 이 디렉터리의 파일은 `*.test.js`가 아니므로 테스트 러너 글롭에 잡히지 않는다(헬퍼 전용).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdtemp, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);

// ── 1) 경로 해석 ─────────────────────────────────────────────────────────────
// 모든 경로는 레포 루트 기준. import.meta.url은 tests/helpers/index.js → '../..'이 루트.

/** 레포 루트 절대 경로. */
export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** 레포 루트 기준 상대경로 → 절대 fs 경로. */
export function repoPath(rel) {
  return resolve(ROOT, rel);
}

/** 레포 루트 기준 상대경로 → file:// URL (readFile에 직접 넘길 수 있다). */
export function repoUrl(rel) {
  return new URL(rel, `file://${ROOT}/`);
}

/** tests/fixtures 하위 경로. */
export const fixturePath = (rel) => repoPath(join('tests/fixtures', rel));
/** tests/redteam 하위 경로. */
export const redteamPath = (rel) => repoPath(join('tests/redteam', rel));
/** examples 하위 경로. */
export const examplePath = (rel) => repoPath(join('examples', rel));

/** CLI 진입점(src/cli.js) 절대 경로. */
export const CLI = repoPath('src/cli.js');

// ── 2) CLI 실행 ──────────────────────────────────────────────────────────────
// 단일 규약: 현재 노드 실행기(process.execPath)로 src/cli.js를 cwd=ROOT에서 실행한다.
//   - 'node' PATH 조회 대신 process.execPath → 멀티 버전 환경에서도 같은 런타임.
//   - cwd=ROOT → 상대 인자(examples/…)가 어디서 호출하든 동일하게 풀린다.
//   - exit!=0이면 execFile이 throw → { code, stdout, stderr }로 정규화(스택트레이스 검사 가능).

/** CLI를 한 번 실행하고 { code, stdout, stderr }로 정규화해 반환한다(throw 없음). */
export async function runCli(...argv) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, ...argv], { cwd: ROOT });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

// ── 3) 임시 디렉터리 ─────────────────────────────────────────────────────────

/**
 * 임시 디렉터리를 만들어 fn(dir)을 실행하고, 끝나면 정리한다(성공·실패 무관).
 * fn의 반환값을 그대로 돌려준다.
 *
 * 정리는 견고하게: chmod 000으로 잠긴 디렉터리(권한 테스트)도 복구 후 제거하고,
 * 정리 단계 오류가 테스트 판정을 가리지 않도록 swallow한다.
 */
export async function withTempDir(fn, prefix = 'di-test-') {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await chmod(dir, 0o700).catch(() => {});
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── 4) 감사 결과 조회 ────────────────────────────────────────────────────────

/** findings 배열에서 id로 단건 조회. 없으면 후보 id를 담아 명확히 throw. */
export function findingById(findings, id) {
  const found = findings.find((f) => f.id === id);
  if (!found) {
    throw new Error(`finding ${id} 없음 — 존재하는 id: ${findings.map((f) => f.id).join(', ') || '(없음)'}`);
  }
  return found;
}

/** warnings 배열에 name 매칭 경고가 있는지. */
export function hasWarning(warnings, name) {
  return (warnings ?? []).some((w) => w.name === name);
}
