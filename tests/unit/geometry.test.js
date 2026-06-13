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
  const { findings } = await analyzeVisualTells(fixture('examples/slop-source.html'))
  const s3 = findings.find((f) => f.id === 'S3');
  assert.equal(s3.pass, false);
  assert.match(s3.evidence, /center-aligned/);
});

test('feature-grid: L1 caught by box geometry, invisible to static audit', opts, async () => {
  const path = fixture('tests/fixtures/slop/feature-grid.html');
  assert.equal(auditHtml(await (await import('node:fs/promises')).readFile(path, 'utf8')).pass, true,
    'static lane must NOT catch this fixture');
  const { findings } = await analyzeVisualTells(path)
  const l1 = findings.find((f) => f.id === 'L1');
  assert.equal(l1.pass, false);
  assert.match(l1.evidence, /3× identical 280×180/);
});

test('clean restaurant page passes visual checks', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/fixtures/clean/restaurant.html'))
  assert.ok(findings.every((f) => f.pass), JSON.stringify(findings));
});

test('combineAudits merges visual findings into score', () => {
  const staticResult = { findings: [{ id: 'C1', name: 'x', pass: true, evidence: null }], failed: [], slopScore: 0, pass: true };
  const merged = combineAudits(staticResult, [{ id: 'L1', name: 'uniform-card-grid', pass: false, evidence: 'e' }]);
  assert.deepEqual(merged.failed, ['L1']);
  assert.equal(merged.slopScore, 0.5);
  assert.equal(merged.pass, false);
});

test('combineAudits merges duplicate IDs without double-scoring', () => {
  const staticResult = {
    findings: [{ id: 'DE3', name: 'quality-floor', pass: true, evidence: null }],
    failed: [],
    slopScore: 0,
    pass: true,
  };
  const merged = combineAudits(staticResult, [
    { id: 'DE3', name: 'quality-floor', pass: false, evidence: 'contrast 1.8:1' },
  ]);
  assert.deepEqual(merged.failed, ['DE3']);
  assert.equal(merged.findings.length, 1, 'same principle ID must not be counted twice');
  assert.equal(merged.slopScore, 1);
  assert.match(merged.findings[0].evidence, /contrast 1\.8/);
  assert.equal(merged.pass, false);
});

test('combineAudits preserves visual warnings without scoring them', () => {
  const staticResult = {
    findings: [{ id: 'C1', name: 'x', pass: true, evidence: null }],
    failed: [],
    slopScore: 0,
    pass: true,
    warnings: [{ name: 'straight-quotes', lane: 'static', evidence: '"q"' }],
  };
  const merged = combineAudits(staticResult, {
    findings: [{ id: 'L1', name: 'uniform-card-grid', pass: true, evidence: null }],
    warnings: [{ name: 'webfont-cdn-dependency', lane: 'visual', evidence: 'fonts.googleapis.com' }],
  });
  // 시각 warning은 채점에 끼지 않는다 — slopScore/pass/failed 불변, exit 0 유지
  assert.equal(merged.pass, true);
  assert.equal(merged.slopScore, 0);
  assert.deepEqual(merged.failed, []);
  // static + visual warnings가 모두 보존된다
  assert.equal(merged.warnings.length, 2);
  assert.deepEqual(merged.warnings.map((w) => w.lane).sort(), ['static', 'visual']);
});

test('combineAudits still accepts a legacy findings array', () => {
  const staticResult = { findings: [{ id: 'C1', name: 'x', pass: true, evidence: null }], failed: [], slopScore: 0, pass: true, warnings: [] };
  const merged = combineAudits(staticResult, [{ id: 'L1', name: 'uniform-card-grid', pass: false, evidence: 'e' }]);
  assert.deepEqual(merged.failed, ['L1']);
  assert.deepEqual(merged.warnings, []);
});

test('missing puppeteer raises actionable guidance', { skip: hasPuppeteer }, async () => {
  await assert.rejects(() => analyzeVisualTells('x.html'), /npm install puppeteer/);
});

// ── L2 승격 불변식: L2와 S3는 서로 다른 입력에서 발화해야 한다 ──

test('L2/S3 disjoint: centered narrow columns with left text fire L2 only', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/redteam/centered-columns-left-text.html'))
  const l2 = findings.find((f) => f.id === 'L2');
  assert.equal(l2.pass, false);
  assert.match(l2.evidence, /3\/3 top-level sections are centered single columns/);
  assert.equal(findings.find((f) => f.id === 'S3').pass, true, 'left-aligned text must not trip S3');
});

test('L2/S3 disjoint: slop-source fires S3 only (2 sections — not enough L2 evidence)', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('examples/slop-source.html'))
  assert.equal(findings.find((f) => f.id === 'S3').pass, false);
  assert.equal(findings.find((f) => f.id === 'L2').pass, true, 'fewer than 3 qualifying sections must pass L2');
});

// ── isVisible 강화 레드팀 ──

test('redteam: opacity:0 left-aligned decoy section cannot rescue L2', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/redteam/opacity-decoy-section.html'))
  const l2 = findings.find((f) => f.id === 'L2');
  assert.equal(l2.pass, false, 'invisible decoy must be excluded from qualifying sections');
  assert.match(l2.evidence, /3\/3/, 'decoy must not appear in the denominator');
});

test('redteam: offscreen/clipped/transparent text must not pad TY1 size count', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/redteam/hidden-text-size-padding.html'))
  const ty1 = findings.find((f) => f.id === 'TY1');
  assert.equal(ty1.pass, true, `hidden sizes leaked into the count: ${ty1.evidence}`);
});

test('existing redteam fixtures keep their pre-hardening L1/S3 verdicts', opts, async () => {
  // isVisible 강화 전(2026-06-13 기준) 판정을 고정 — 회귀하면 여기서 깨진다.
  const expected = {
    'display-none-fourth-card.html': { L1: false, S3: true },
    'empty.html': { L1: true, S3: true },
    'inherited-center-text.html': { L1: true, S3: false },
    'no-body.html': { L1: true, S3: true },
    'seventy-nine-percent-center.html': { L1: true, S3: true },
    'three-card-size-delta.html': { L1: true, S3: true },
    'three-centered-text.html': { L1: true, S3: true },
    'two-card-grid.html': { L1: true, S3: true },
  };
  for (const [file, verdicts] of Object.entries(expected)) {
    const { findings } = await analyzeVisualTells(fixture(`tests/redteam/${file}`))
    for (const [id, pass] of Object.entries(verdicts)) {
      assert.equal(findings.find((f) => f.id === id).pass, pass, `${file} ${id} verdict changed`);
    }
  }
});

// ── TY1 type-scale-chaos ──

test('TY1: eight-plus visible font sizes fail, evidence lists them', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/redteam/type-scale-chaos.html'))
  const ty1 = findings.find((f) => f.id === 'TY1');
  assert.equal(ty1.pass, false);
  assert.match(ty1.evidence, /10 distinct font sizes:/);
  // 21.6px·13.4px는 1px 버킷으로 22·13에 합산되어야 한다
  assert.match(ty1.evidence, /\b22\b/);
  assert.match(ty1.evidence, /\b13\b/);
});

// ── TY2 measure-discipline ──

test('TY2 arm a: full-bleed 120+ char paragraph exceeds 40em measure (saas-landing)', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/fixtures/slop/saas-landing.html'))
  const ty2 = findings.find((f) => f.id === 'TY2');
  assert.equal(ty2.pass, false);
  assert.match(ty2.evidence, /em wide \(limit 40\)/);
  assert.match(ty2.evidence, /TaskFlow is a revolutionary/);
});

test('TY2 arm b: sub-15.5px body paragraph inside <main> fails', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/redteam/main-small-paragraph.html'))
  const ty2 = findings.find((f) => f.id === 'TY2');
  assert.equal(ty2.pass, false);
  assert.match(ty2.evidence, /13px \(min 15\.5px\)/);
});

test('TY2 arm b: page without <main> silently skips the size check', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/redteam/no-main-small-paragraph.html'))
  assert.equal(findings.find((f) => f.id === 'TY2').pass, true);
});

// ── DE3 contrast-discipline ──

test('DE3 contrast: body text below 4.5:1 fails on solid backgrounds', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/redteam/low-contrast-text.html'))
  const de3 = findings.find((f) => f.id === 'DE3');
  assert.equal(de3.pass, false);
  assert.match(de3.evidence, /contrast \d+\.\d+:1/);
  assert.match(de3.evidence, /limit 4\.5:1/);
});

test('DE3 contrast: large text uses the 3:1 threshold', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/redteam/large-text-contrast.html'))
  const de3 = findings.find((f) => f.id === 'DE3');
  assert.equal(de3.pass, true, de3.evidence);
  assert.match(de3.evidence, /checked/);
});

test('DE3 contrast: gradient and image backgrounds are explicit skips', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/redteam/contrast-gradient-skip.html'))
  const de3 = findings.find((f) => f.id === 'DE3');
  assert.equal(de3.pass, true, de3.evidence);
  assert.match(de3.evidence, /skipped/);
  assert.match(de3.evidence, /gradient:1/);
  assert.match(de3.evidence, /image:1/);
});
// ── TY5-A 한글 어절 중간 줄바꿈 (시각 fail, 양면) ──

test('TY5 hangul: mid-word break in narrow column fails (no keep-all)', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/redteam/hangul-word-break.html'));
  const ty5 = findings.find((f) => f.id === 'TY5');
  assert.equal(ty5.pass, false);
  assert.match(ty5.evidence, /어절 중간 줄바꿈/);
});

test('TY5 hangul: keep-all spaced text does not fire (clean guard, 오탐0)', opts, async () => {
  const { findings } = await analyzeVisualTells(fixture('tests/redteam/hangul-keepall-clean.html'));
  assert.equal(findings.find((f) => f.id === 'TY5').pass, true);
});

// ── webfont ② 선언 폰트 미적용 (시각 WARN, 보수적) ──

test('webfont ② warns when a declared @font-face fails to load', opts, async () => {
  const { warnings } = await analyzeVisualTells(fixture('tests/redteam/webfont-not-applied.html'));
  assert.ok(warnings.some((w) => w.name === 'webfont-not-applied'), JSON.stringify(warnings));
});

test('webfont ② silent when no @font-face is declared (clean guard)', opts, async () => {
  const { warnings } = await analyzeVisualTells(fixture('tests/redteam/hangul-keepall-clean.html'));
  assert.ok(!warnings.some((w) => w.name === 'webfont-not-applied'));
});
