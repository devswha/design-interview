// tests/unit/crawl.test.js — crawl.js 단위 + cli crawl 입력/SSRF 계약.
// 네트워크 없이: 파일명 추론·저장·sidecar는 직접, fetch는 주입 모킹.
// SSRF 차단은 실제 가드로(127.0.0.1은 진짜 private라 외부 없이 검증).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { deriveFilename, saveCrawledAsset, crawlAsset } from '../../src/crawl.js';

const run = promisify(execFile);
const CLI = fileURLToPath(new URL('../../src/cli.js', import.meta.url));

async function invoke(...argv) {
  try {
    const { stdout, stderr } = await run('node', [CLI, ...argv]);
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

test('deriveFilename: URL 확장자에서 파일명 추출', () => {
  assert.equal(deriveFilename('https://x.com/logos/openai.svg'), 'openai.svg');
  assert.equal(deriveFilename('https://x.com/a/b/hero.png?v=2'), 'hero.png');
});

test('deriveFilename: --name 우선', () => {
  assert.equal(deriveFilename('https://x.com/no-ext', 'brand.svg'), 'brand.svg');
});

test('deriveFilename: 확장자 없으면 userError', () => {
  assert.throws(() => deriveFilename('https://x.com/asset'), (e) => e.userError === true);
});

test('saveCrawledAsset: 파일 + provenance sidecar 작성', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'di-crawl-'));
  try {
    const buf = Buffer.from('<svg/>');
    const r = await saveCrawledAsset(buf, { url: 'https://x.com/logo.svg', outDir: dir });
    assert.equal(r.bytes, buf.length);
    assert.equal(await readFile(r.filePath, 'utf8'), '<svg/>');
    const side = await readFile(r.sidecarPath, 'utf8');
    assert.match(side, /source: crawled:https:\/\/x\.com\/logo\.svg/);
    assert.match(side, /REVIEW-REQUIRED/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('crawlAsset: fetch 주입 → 저장; 비URL → userError', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'di-crawl-'));
  try {
    const r = await crawlAsset('https://x.com/mark.svg', {
      outDir: dir,
      fetchImpl: async () => Buffer.from('DATA'),
    });
    assert.equal(await readFile(r.filePath, 'utf8'), 'DATA');
    await assert.rejects(
      () => crawlAsset('not-a-url', { outDir: dir, fetchImpl: async () => Buffer.from('x') }),
      (e) => e.userError === true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('cli crawl: 비URL → exit 2', async () => {
  const r = await invoke('crawl', 'just-a-string');
  assert.equal(r.code, 2);
  assert.ok(!r.stderr.includes('node:internal'), '스택트레이스 없음');
});

test('cli crawl: 인자 없음 → usage exit 2', async () => {
  const r = await invoke('crawl');
  assert.equal(r.code, 2);
});

test('cli crawl: private 주소(SSRF) → exit 1 차단', async () => {
  const r = await invoke('crawl', 'http://127.0.0.1/logo.png');
  assert.equal(r.code, 1, 'SSRF 가드가 private 주소 차단 → exit 1');
  assert.match(r.stderr, /private|blocked|crawl failed/i);
});
