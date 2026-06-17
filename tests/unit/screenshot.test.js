import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { captureFile, VIEWPORTS } from '../../src/screenshot.js';
import { examplePath, withTempDir } from '../helpers/index.js';
import { visualTest, noPuppeteerTest } from '../helpers/puppeteer.js';

// puppeteer 설치 여부에 따라 분기하는 테스트 — 어느 환경에서든 결정적이다.

test('viewport presets cover desktop and mobile', () => {
  assert.ok(VIEWPORTS.desktop.width > VIEWPORTS.mobile.width);
});

test('missing puppeteer raises actionable install guidance', noPuppeteerTest, async () => {
  await assert.rejects(() => captureFile('x.html'), /npm install puppeteer/);
});

test('captureFile requires an html path before loading puppeteer', async () => {
  await assert.rejects(() => captureFile(undefined), /htmlPath is required/);
});

test('unknown viewport name is rejected', visualTest, async () => {
  await assert.rejects(
    () => captureFile(examplePath('slop-source.html'), { viewports: ['tv'] }),
    /unknown viewport "tv"/,
  );
});
test('captureFile keeps page JavaScript disabled', visualTest, async () => {
  await withTempDir(async (dir) => {
    const htmlPath = join(dir, 'script-disabled.html');
    await writeFile(htmlPath, `<!doctype html>
<html>
<head>
  <style>
    body { margin: 0; }
    main { width: 100px; height: 100px; background: #111; }
  </style>
</head>
<body>
  <main></main>
  <script>
    const tall = document.createElement('div');
    tall.style.height = '2000px';
    document.body.appendChild(tall);
  </script>
</body>
</html>`);
    const [{ path }] = await captureFile(htmlPath, { viewports: ['desktop'] });
    const png = await readFile(path);
    const height = png.readUInt32BE(20);
    assert.equal(height, VIEWPORTS.desktop.height);
  });
});
