import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureFile, VIEWPORTS } from '../../src/screenshot.js';

// puppeteer 설치 여부에 따라 분기하는 테스트 — 어느 환경에서든 결정적이다.
const hasPuppeteer = await import('puppeteer').then(() => true, () => false);

test('viewport presets cover desktop and mobile', () => {
  assert.ok(VIEWPORTS.desktop.width > VIEWPORTS.mobile.width);
});

test('missing puppeteer raises actionable install guidance', { skip: hasPuppeteer }, async () => {
  await assert.rejects(() => captureFile('x.html'), /npm install puppeteer/);
});

test('captureFile requires an html path before loading puppeteer', async () => {
  await assert.rejects(() => captureFile(undefined), /htmlPath is required/);
});

test('unknown viewport name is rejected', { skip: !hasPuppeteer }, async () => {
  await assert.rejects(
    () => captureFile('examples/slop-source.html', { viewports: ['tv'] }),
    /unknown viewport "tv"/,
  );
});
