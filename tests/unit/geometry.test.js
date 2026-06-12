import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { analyzeVisualTells } from '../../src/geometry.js';
import { auditHtml, combineAudits } from '../../src/audit.js';

const hasPuppeteer = await import('puppeteer').then(() => true, () => false);
const fixture = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));

// puppeteer 미설치 환경에서는 시각 레인 테스트를 skip — M0~M2 보존 원칙.
const opts = { skip: !hasPuppeteer };

test('slop-source: S3 caught — everything renders centered', opts, async () => {
  const findings = await analyzeVisualTells(fixture('examples/slop-source.html'));
  const s3 = findings.find((f) => f.id === 'S3');
  assert.equal(s3.pass, false);
  assert.match(s3.evidence, /center-aligned/);
});

test('feature-grid: L1 caught by box geometry, invisible to static audit', opts, async () => {
  const path = fixture('tests/fixtures/slop/feature-grid.html');
  assert.equal(auditHtml(await (await import('node:fs/promises')).readFile(path, 'utf8')).pass, true,
    'static lane must NOT catch this fixture');
  const findings = await analyzeVisualTells(path);
  const l1 = findings.find((f) => f.id === 'L1');
  assert.equal(l1.pass, false);
  assert.match(l1.evidence, /3× identical 280×180/);
});

test('clean restaurant page passes both visual tells', opts, async () => {
  const findings = await analyzeVisualTells(fixture('tests/fixtures/clean/restaurant.html'));
  assert.ok(findings.every((f) => f.pass), JSON.stringify(findings));
});

test('combineAudits merges visual findings into score', () => {
  const staticResult = { findings: [{ id: 'C1', name: 'x', pass: true, evidence: null }], failed: [], slopScore: 0, pass: true };
  const merged = combineAudits(staticResult, [{ id: 'L1', name: 'uniform-card-grid', pass: false, evidence: 'e' }]);
  assert.deepEqual(merged.failed, ['L1']);
  assert.equal(merged.slopScore, 0.5);
  assert.equal(merged.pass, false);
});

test('missing puppeteer raises actionable guidance', { skip: hasPuppeteer }, async () => {
  await assert.rejects(() => analyzeVisualTells('x.html'), /npm install puppeteer/);
});
