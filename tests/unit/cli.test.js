import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { CLI, ROOT, runCli, withTempDir } from '../helpers/index.js';


// CLI 에러 규율 회귀 테스트 (G001 리뷰 블로커): 사용자 입력 오류는
// 스택트레이스 없이 사용자용 메시지 + exit 2.

const execFileAsync = promisify(execFile);


test('audit on missing file: clean error, exit 2, no stack trace', async () => {
  const r = await runCli('audit', 'does-not-exist.html');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /cannot read .*does-not-exist\.html: no such file/);
  assert.ok(!r.stderr.includes('node:internal'), 'no stack trace');
  assert.ok(!r.stderr.includes('at async'), 'no stack frames');
});

test('audit --visual on missing file: same clean error before visual lane', async () => {
  const r = await runCli('audit', 'does-not-exist.html', '--visual');
  assert.equal(r.code, 2);
  assert.ok(!r.stderr.includes('node:internal'));
});

test('audit on directory path: clean EISDIR error, exit 2, no stack trace', async () => {
  const r = await runCli('audit', 'examples');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /cannot read .*examples: is a directory/);
  assert.ok(!r.stderr.includes('node:internal'), 'no stack trace');
});

test('preview on directory --against: clean EISDIR error, exit 2', async () => {
  const r = await runCli('preview', 'examples/slop-source.html', '--against', 'core');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /cannot read core: is a directory/);
  assert.ok(!r.stderr.includes('node:internal'));
});

test('preview with directory --out: clean write error, exit 2', async () => {
  await withTempDir(async (dir) => {
    const r = await runCli('preview', 'examples/slop-source.html', '--out', dir);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /cannot write .*: .*is a directory|cannot write .*: EISDIR/);
    assert.ok(!r.stderr.includes('node:internal'), 'no stack trace');
  });
});

test('preview missing --out value: clean usage error, exit 2', async () => {
  const r = await runCli('preview', 'examples/slop-source.html', '--out');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /--out requires a path/);
  assert.ok(!r.stderr.includes('node:internal'));
});

test('shot --visual without file: usage, exit 2', async () => {
  const r = await runCli('shot', '--visual');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /usage: design-interview/);
  assert.ok(!r.stderr.includes('ERR_FILE_NOT_FOUND'));
  assert.ok(!r.stderr.includes('node:internal'));
});

test('audit on a pipe with a writer reads content (stdin/process-substitution path)', async (t) => {
  await withTempDir(async (dir) => {
    const fifo = join(dir, 'input.fifo');
    try {
      await execFileAsync('mkfifo', [fifo]);
    } catch {
      t.skip('mkfifo unavailable');
      return;
    }

    // 백그라운드 writer가 FIFO에 HTML을 흘려보낸다 → audit이 일반 파이프처럼 읽어야 한다.
    // R3 회귀 가드: 이전 `!isFile()` 차단이 stdin·process substitution을 깨뜨렸다.
    const html = '<html><body><h1>hi</h1><p>clean honest copy here</p></body></html>';
    const writer = execFileAsync('sh', ['-c', `printf '%s' "$0" > "$1"`, html, fifo]);

    let r;
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [CLI, 'audit', fifo], {
        cwd: ROOT,
        timeout: 8000,
      });
      r = { code: 0, stdout, stderr };
    } catch (err) {
      r = { code: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
    }
    await writer.catch(() => {});

    assert.ok(!r.stderr.includes('not a regular file'), 'a pipe must not be rejected as a special file');
    assert.notEqual(r.code, 2, 'reading a pipe-with-writer is not an input error');
    assert.ok(!r.stderr.includes('node:internal'), 'no stack trace');
  });
});

test('intake ftp:// and file:// rejected by URL guard, not file path', async () => {
  for (const url of ['ftp://example.test/resource', 'file:///etc/passwd']) {
    const r = await runCli('intake', url);
    assert.equal(r.code, 1, url);
    assert.match(r.stderr, /intake failed: blocked: only http\/https/);
    assert.ok(!r.stderr.includes('node:internal'));
  }
});

test('intake --json without target: usage, exit 2, no internal TypeError', async () => {
  const r = await runCli('intake', '--json');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /usage: design-interview/);
  assert.ok(!r.stderr.includes('paths[0]'), 'no low-level path TypeError');
  assert.ok(!r.stderr.includes('node:internal'), 'no stack trace');
});

test('audit --visual without target: usage, exit 2, no internal TypeError', async () => {
  const r = await runCli('audit', '--visual');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /usage: design-interview/);
  assert.ok(!r.stderr.includes('paths[0]'), 'no low-level path TypeError');
  assert.ok(!r.stderr.includes('node:internal'), 'no stack trace');
});

test('preview on missing --against file: clean error, exit 2', async () => {
  const r = await runCli('preview', 'examples/slop-source.html', '--against', 'nope.html');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /cannot read nope\.html: no such file/);
  assert.ok(!r.stderr.includes('node:internal'));
});

test('unknown command prints usage, exit 2', async () => {
  const r = await runCli('frobnicate', 'x.html');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /usage: design-interview/);
});
