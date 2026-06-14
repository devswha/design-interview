// G003 E2E — slop 소스 하나로 intake → audit → preview → shot 전체 파이프라인을
// 실제 CLI 호출(node src/cli.js)로 검증한다. 모듈 import 없이 공개 표면만 친다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SLOP = 'examples/slop-source.html';
const hasPuppeteer = await import('puppeteer').then(() => true, () => false);

async function cli(...argv) {
  try {
    const { stdout, stderr } = await run(process.execPath, [join(ROOT, 'src/cli.js'), ...argv], { cwd: ROOT });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

test('e2e 1/4 intake: claims frozen from slop source', async () => {
  const r = await cli('intake', SLOP, '--json');
  assert.equal(r.code, 0);
  const { claims } = JSON.parse(r.stdout);
  assert.ok(claims.some((c) => c.kind === 'quantity' && c.value.includes('30개')), '30개 claim frozen');
  assert.ok(claims.some((c) => c.kind === 'feature'), 'feature claims present');
});

test('e2e 2/4 audit: static machine checks block delivery', async () => {
  const r = await cli('audit', SLOP);
  assert.equal(r.code, 1, 'slop must not pass');
  for (const id of ['C1', 'T1', 'T2', 'T4']) assert.match(r.stdout, new RegExp(`FAIL\\s+${id}`));
  assert.match(r.stdout, /납품 불가/);
});

test('e2e 2/4b audit --visual: geometry lane joins the verdict', { skip: !hasPuppeteer }, async () => {
  const r = await cli('audit', SLOP, '--visual');
  assert.equal(r.code, 1);
  assert.match(r.stdout, /advise\s+S3 perfect-symmetry/); // S3는 억제 휴리스틱 → advisory(차단 아님)
  assert.match(r.stdout, /L1 uniform-card-grid/);
});

test('e2e 3/4 preview: inert toggle review artifact built against slop', async () => {
  const out = join(await mkdtemp(join(tmpdir(), 'di-e2e-')), 'out.preview.html');
  const r = await cli('preview', SLOP, '--against', SLOP, '--out', out);
  assert.equal(r.code, 0);
  assert.equal(r.stdout.trim(), out);
  const html = await readFile(out, 'utf8');
  assert.match(html, /id="dsiv-both"/);
  assert.ok(!/<script/i.test(html), 'preview stays inert');
  assert.match(html, /script-src 'none'/);
});

test('e2e 4/4 shot: both viewports captured as nonempty PNGs', { skip: !hasPuppeteer }, async () => {
  const base = join(await mkdtemp(join(tmpdir(), 'di-e2e-')), 'page');
  // shot은 입력 경로 기준으로 출력하므로 슬롭을 임시 디렉토리로 복사
  const src = join(base + '.html');
  await (await import('node:fs/promises')).copyFile(join(ROOT, SLOP), src);
  const r = await cli('shot', src);
  assert.equal(r.code, 0);
  for (const vp of ['desktop', 'mobile']) {
    assert.match(r.stdout, new RegExp(`${vp}\\t`));
    const png = await stat(`${base}.${vp}.png`);
    assert.ok(png.size > 0, `${vp} png nonempty`);
  }
});
