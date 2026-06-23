import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CLI, ROOT, runCli, withTempDir } from '../helpers/index.js';

function validOptions(overrides = {}) {
  return JSON.stringify({
    schemaVersion: 1,
    boardId: 'cli-sess',
    roundId: 'r1',
    dimension: 'mood',
    question: '어떤 분위기?',
    recommendedNumber: 1,
    recommendReason: '소스 톤',
    options: [
      { number: 1, label: '문구점', rationale: '절제', visual: { type: 'moodChips', chips: [{ kind: 'color', value: '#e8e2d0' }, { kind: 'type', value: 'serif' }] } },
      { number: 2, label: '터미널', rationale: '다크', visual: { type: 'plain', text: '모노·기능' } },
    ],
    ...overrides,
  });
}

test('board without args: usage, exit 2', async () => {
  const r = await runCli('board');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /usage:/);
});

test('board with options but no --out: usage, exit 2', async () => {
  await withTempDir(async (dir) => {
    const opts = join(dir, 'o.json');
    await writeFile(opts, validOptions());
    const r = await runCli('board', opts);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /usage:/);
  });
});

test('board end-to-end: exit 0, prints openable file:// link, writes inert HTML', async () => {
  await withTempDir(async (dir) => {
    const opts = join(dir, 'o.json');
    const out = join(dir, 'board.html');
    await writeFile(opts, validOptions());
    const r = await runCli('board', opts, '--out', out);
    assert.equal(r.code, 0, r.stderr);
    assert.match(r.stdout.trim(), /^file:\/\//);
    assert.ok(r.stdout.trim().endsWith('board.html'), r.stdout);
    const html = await readFile(out, 'utf8');
    assert.match(html, /id="dsiv-board-root"/);
    assert.match(html, /script-src 'none'/);
    assert.doesNotMatch(html, /<script/i);
    assert.match(html, /board:cli-sess/); // stale marker
  });
});

test('board --serve --port 0 prints a loopback URL on an ephemeral port', async () => {
  await withTempDir(async (dir) => {
    const opts = join(dir, 'o.json');
    const out = join(dir, 'board.html');
    await writeFile(opts, validOptions());
    const child = spawn(process.execPath, [CLI, 'board', opts, '--out', out, '--serve', '--port', '0'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const closed = new Promise((resolvePromise) => child.once('close', resolvePromise));
    try {
      await new Promise((resolvePromise, reject) => {
        const timer = setTimeout(() => reject(new Error(`timed out waiting for server URL; stderr=${stderr}`)), 3000);
        child.stdout.on('data', () => {
          if (/^http:\/\/127\.0\.0\.1:\d+\/\s*$/m.test(stdout)) {
            clearTimeout(timer);
            resolvePromise();
          }
        });
        child.once('exit', (code) => {
          clearTimeout(timer);
          reject(new Error(`server exited before URL; code=${code}; stderr=${stderr}`));
        });
        child.once('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      assert.match(stdout.trim(), /^http:\/\/127\.0\.0\.1:\d+\/$/);
      const res = await fetch(stdout.trim());
      assert.equal(res.status, 200);
      assert.match(await res.text(), /id="dsiv-board-root"/);
    } finally {
      child.kill('SIGTERM');
      await closed;
    }
  });
});

test('board with non-core dimension: schema error, exit 2, no stack', async () => {
  await withTempDir(async (dir) => {
    const opts = join(dir, 'o.json');
    await writeFile(opts, validOptions({ dimension: 'palette' }));
    const r = await runCli('board', opts, '--out', join(dir, 'b.html'));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /dimension/);
    assert.ok(!r.stderr.includes('node:internal'), 'no stack trace');
    assert.ok(!r.stderr.includes('at async'), 'no stack frames');
  });
});

test('board with malformed JSON: clean error, exit 2', async () => {
  await withTempDir(async (dir) => {
    const opts = join(dir, 'o.json');
    await writeFile(opts, '{ not valid json');
    const r = await runCli('board', opts, '--out', join(dir, 'b.html'));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /JSON/);
    assert.ok(!r.stderr.includes('node:internal'), 'no stack trace');
  });
});

test('board with missing imageFile: asset error, exit 2', async () => {
  await withTempDir(async (dir) => {
    const opts = join(dir, 'o.json');
    await writeFile(opts, validOptions({
      recommendedNumber: null, recommendReason: null,
      options: [{ number: 1, label: '참고', rationale: 'x', visual: { type: 'imageFile', path: 'ghost.png', alt: 'a', kind: 'reference' } }],
    }));
    const r = await runCli('board', opts, '--out', join(dir, 'b.html'));
    assert.equal(r.code, 2);
    assert.match(r.stderr, /찾을 수 없|imageFile/);
  });
});

test('board validation failure preserves the existing out file (atomic)', async () => {
  await withTempDir(async (dir) => {
    const opts = join(dir, 'o.json');
    const out = join(dir, 'board.html');
    await writeFile(out, '<!-- PRIOR -->');
    await writeFile(opts, validOptions({ dimension: 'palette' })); // invalid
    const r = await runCli('board', opts, '--out', out);
    assert.equal(r.code, 2);
    const kept = await readFile(out, 'utf8');
    assert.equal(kept, '<!-- PRIOR -->', '검증 실패 시 기존 out 파일 보존');
  });
});

test('board success overwrites the out file with a fresh marker', async () => {
  await withTempDir(async (dir) => {
    const opts = join(dir, 'o.json');
    const out = join(dir, 'board.html');
    await writeFile(out, '<!-- PRIOR -->');
    await writeFile(opts, validOptions({ roundId: 'r9' }));
    const r = await runCli('board', opts, '--out', out);
    assert.equal(r.code, 0, r.stderr);
    const html = await readFile(out, 'utf8');
    assert.doesNotMatch(html, /PRIOR/);
    assert.match(html, /round:r9/);
  });
});
