import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../helpers/index.js';

// CLI 에러 규율 회귀 테스트 (G001 리뷰 블로커): 사용자 입력 오류는
// 스택트레이스 없이 사용자용 메시지 + exit 2.

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
