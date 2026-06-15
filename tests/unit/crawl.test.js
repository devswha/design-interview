// tests/unit/crawl.test.js — crawl.js 단위 + cli crawl 입력/SSRF 계약.
// 네트워크 없이: 파일명 추론·저장·sidecar는 직접, fetch는 주입 모킹.
// SSRF 차단은 실제 가드로(127.0.0.1은 진짜 private라 외부 없이 검증).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deriveFilename, saveCrawledAsset, crawlAsset } from '../../src/crawl.js';
import { runCli, withTempDir } from '../helpers/index.js';

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

test('deriveFilename: --name 경로 탈출/확장자 없음 거부 (path traversal 차단)', () => {
  // 디렉터리 분리자·..는 basename으로 스트립되어 outDir를 벗어날 수 없다.
  assert.equal(deriveFilename('https://x.com/x.svg', '../../etc/evil.png'), 'evil.png');
  assert.equal(deriveFilename('https://x.com/x.svg', 'sub/dir/mark.svg'), 'mark.svg');
  // basename 후 확장자가 없으면 거부(종류 분류 불가).
  assert.throws(() => deriveFilename('https://x.com/x.svg', '../../tmp/'), (e) => e.userError === true);
  assert.throws(() => deriveFilename('https://x.com/x.svg', 'no-ext'), (e) => e.userError === true);
});

test('saveCrawledAsset: 파일 + provenance sidecar 작성', async () => {
  await withTempDir(async (dir) => {
    const buf = Buffer.from('<svg/>');
    const r = await saveCrawledAsset(buf, { url: 'https://x.com/logo.svg', outDir: dir });
    assert.equal(r.bytes, buf.length);
    assert.equal(await readFile(r.filePath, 'utf8'), '<svg/>');
    const side = await readFile(r.sidecarPath, 'utf8');
    assert.match(side, /source: crawled:https:\/\/x\.com\/logo\.svg/);
    assert.match(side, /REVIEW-REQUIRED/);
  });
});

test('crawlAsset: fetch 주입 → 저장; 비URL → userError', async () => {
  await withTempDir(async (dir) => {
    const r = await crawlAsset('https://x.com/mark.svg', {
      outDir: dir,
      fetchImpl: async () => Buffer.from('DATA'),
    });
    assert.equal(await readFile(r.filePath, 'utf8'), 'DATA');
    await assert.rejects(
      () => crawlAsset('not-a-url', { outDir: dir, fetchImpl: async () => Buffer.from('x') }),
      (e) => e.userError === true,
    );
  });
});

test('cli crawl: 비URL → exit 2', async () => {
  const r = await runCli('crawl', 'just-a-string');
  assert.equal(r.code, 2);
  assert.ok(!r.stderr.includes('node:internal'), '스택트레이스 없음');
});

test('cli crawl: 인자 없음 → usage exit 2', async () => {
  const r = await runCli('crawl');
  assert.equal(r.code, 2);
});

test('cli crawl: private 주소(SSRF) → exit 1 차단', async () => {
  const r = await runCli('crawl', 'http://127.0.0.1/logo.png');
  assert.equal(r.code, 1, 'SSRF 가드가 private 주소 차단 → exit 1');
  assert.match(r.stderr, /private|blocked|crawl failed/i);
});