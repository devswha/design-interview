import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { analyzeVisualTells } from '../../src/geometry.js';
import { auditHtml, combineAudits } from '../../src/audit.js';
import { repoPath, findingById, hasWarning, withTempDir } from '../helpers/index.js';
import { visualTest, noPuppeteerTest } from '../helpers/puppeteer.js';

test('slop-source: S3 caught — everything renders centered', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('examples/slop-source.html'))
  const s3 = findingById(findings, 'S3');
  assert.equal(s3.pass, false);
  assert.match(s3.evidence, /center-aligned/);
});

test('feature-grid: L1 caught by box geometry, invisible to static audit', visualTest, async () => {
  const path = repoPath('tests/fixtures/slop/feature-grid.html');
  assert.equal(auditHtml(await readFile(path, 'utf8')).pass, true,
    'static lane must NOT catch this fixture');
  const { findings } = await analyzeVisualTells(path)
  const l1 = findingById(findings, 'L1');
  assert.equal(l1.pass, false);
  assert.match(l1.evidence, /3× identical 280×180/);
});

test('clean restaurant page passes visual checks', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/fixtures/clean/restaurant.html'))
  assert.ok(findings.every((f) => f.pass), JSON.stringify(findings));
});

test('combineAudits merges visual findings into a 0..1 score', () => {
  const staticResult = { findings: [{ id: 'C1', name: 'x', severity: 'blocking', pass: true, evidence: null }], failed: [], slopScore: 0, pass: true };
  const merged = combineAudits(staticResult, [{ id: 'L1', name: 'uniform-card-grid', severity: 'advisory', pass: false, evidence: 'e' }]);
  assert.deepEqual(merged.failed, ['L1']);
  // slopScore는 분자/분모를 같은 findings 집합으로: 1 fail / 2 findings.
  assert.equal(merged.slopScore, 1 / 2);
  // L1은 advisory → 차단하지 않는다(advisory-never-blocks).
  assert.equal(merged.pass, true);
});

test('combineAudits fails open: severity-less visual finding is advisory, not blocking', () => {
  const staticResult = auditHtml('<p>hi</p>');
  // 객체 형태 + 레거시 배열 모두 severity 누락이면 advisory(차단 아님)로 둔다.
  const obj = combineAudits(staticResult, { findings: [{ id: 'L1', name: 'x', pass: false }], warnings: [] });
  const leg = combineAudits(staticResult, [{ id: 'L1', name: 'x', pass: false }]);
  assert.equal(obj.pass, true, 'object-form severity-less finding must not block');
  assert.equal(leg.pass, true, 'legacy-array severity-less finding must not block');
  // 명시적 blocking 시각 텔은 차단한다.
  const blk = combineAudits(staticResult, { findings: [{ id: 'TY5', name: 'hangul', severity: 'blocking', pass: false }], warnings: [] });
  assert.equal(blk.pass, false);
});

test('combineAudits merges duplicate IDs without double-scoring', () => {
  const staticResult = {
    findings: [{ id: 'DE3', name: 'quality-floor', severity: 'blocking', pass: true, evidence: null }],
    failed: [],
    slopScore: 0,
    pass: true,
  };
  const merged = combineAudits(staticResult, [
    { id: 'DE3', name: 'quality-floor', severity: 'blocking', pass: false, evidence: 'contrast 1.8:1' },
  ]);
  assert.deepEqual(merged.failed, ['DE3']);
  assert.equal(merged.findings.length, 1, 'same principle ID must not be counted twice');
  // 중복 병합 후 분모는 1 — 0..1 유지.
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

test('missing puppeteer raises actionable guidance', noPuppeteerTest, async () => {
  await assert.rejects(() => analyzeVisualTells('x.html'), /npm install puppeteer/);
});

// ── L2 승격 불변식: L2와 S3는 서로 다른 입력에서 발화해야 한다 ──

test('L2/S3 disjoint: centered narrow columns with left text fire L2 only', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/centered-columns-left-text.html'))
  const l2 = findingById(findings, 'L2');
  assert.equal(l2.pass, false);
  assert.match(l2.evidence, /3\/3 top-level sections are centered single columns/);
  assert.equal(findingById(findings, 'S3').pass, true, 'left-aligned text must not trip S3');
});

test('L2/S3 disjoint: slop-source fires S3 only (2 sections — not enough L2 evidence)', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('examples/slop-source.html'))
  assert.equal(findingById(findings, 'S3').pass, false);
  assert.equal(findingById(findings, 'L2').pass, true, 'fewer than 3 qualifying sections must pass L2');
});

// ── isVisible 강화 레드팀 ──

test('redteam: opacity:0 left-aligned decoy section cannot rescue L2', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/opacity-decoy-section.html'))
  const l2 = findingById(findings, 'L2');
  assert.equal(l2.pass, false, 'invisible decoy must be excluded from qualifying sections');
  assert.match(l2.evidence, /3\/3/, 'decoy must not appear in the denominator');
});

test('redteam: offscreen/clipped/transparent text must not pad TY1 size count', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/hidden-text-size-padding.html'))
  const ty1 = findingById(findings, 'TY1');
  assert.equal(ty1.pass, true, `hidden sizes leaked into the count: ${ty1.evidence}`);
});

test('existing redteam fixtures keep their pre-hardening L1/S3 verdicts', visualTest, async () => {
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
    const { findings } = await analyzeVisualTells(repoPath(`tests/redteam/${file}`))
    for (const [id, pass] of Object.entries(verdicts)) {
      assert.equal(findingById(findings, id).pass, pass, `${file} ${id} verdict changed`);
    }
  }
});

// ── TY1 type-scale-chaos ──

test('TY1: eight-plus visible font sizes fail, evidence lists them', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/type-scale-chaos.html'))
  const ty1 = findingById(findings, 'TY1');
  assert.equal(ty1.pass, false);
  assert.match(ty1.evidence, /10 distinct font sizes:/);
  // 21.6px·13.4px는 1px 버킷으로 22·13에 합산되어야 한다
  assert.match(ty1.evidence, /\b22\b/);
  assert.match(ty1.evidence, /\b13\b/);
});

// ── TY2 measure-discipline ──

test('TY2 arm a: full-bleed 120+ char paragraph exceeds 40em measure (saas-landing)', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/fixtures/slop/saas-landing.html'))
  const ty2 = findingById(findings, 'TY2');
  assert.equal(ty2.pass, false);
  assert.match(ty2.evidence, /em wide \(limit 40\)/);
  assert.match(ty2.evidence, /TaskFlow is a revolutionary/);
});

test('TY2 arm b: sub-15.5px body paragraph inside <main> fails', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/main-small-paragraph.html'))
  const ty2 = findingById(findings, 'TY2');
  assert.equal(ty2.pass, false);
  assert.match(ty2.evidence, /13px \(min 15\.5px\)/);
});

test('TY2 arm b: page without <main> now catches the dominant small body block', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/no-main-small-paragraph.html'));
  const ty2 = findingById(findings, 'TY2');
  assert.equal(ty2.pass, false);
  assert.match(ty2.evidence, /min 15\.5px/);
});

test('TY2 arm b: no-main page where only footer/legal is small stays clean (오탐0)', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/no-main-footer-legal.html'));
  assert.equal(findingById(findings, 'TY2').pass, true);
});

// ── DE3 contrast-discipline ──

test('DE3 contrast: body text below 4.5:1 fails on solid backgrounds', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/low-contrast-text.html'))
  const de3 = findingById(findings, 'DE3');
  assert.equal(de3.pass, false);
  assert.match(de3.evidence, /contrast \d+\.\d+:1/);
  assert.match(de3.evidence, /limit 4\.5:1/);
});

test('DE3 contrast: large text uses the 3:1 threshold', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/large-text-contrast.html'))
  const de3 = findingById(findings, 'DE3');
  assert.equal(de3.pass, true, de3.evidence);
  assert.match(de3.evidence, /checked/);
});

test('DE3 contrast: gradient and image backgrounds are explicit skips', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/contrast-gradient-skip.html'))
  const de3 = findingById(findings, 'DE3');
  assert.equal(de3.pass, true, de3.evidence);
  assert.match(de3.evidence, /skipped/);
  assert.match(de3.evidence, /gradient:1/);
  assert.match(de3.evidence, /image:1/);
});

test('visual containment: inline script cannot forge DE3 contrast verdict', visualTest, async () => {
  await withTempDir(async (dir) => {
    const htmlPath = join(dir, 'forge-contrast.html');
    await writeFile(htmlPath, `<!doctype html>
<html>
<head>
  <style>
    body { margin: 0; background: #fff; color: #eee; font: 18px/1.5 sans-serif; }
    main { width: 720px; padding: 48px; }
  </style>
</head>
<body>
  <main><p>This real body copy is intentionally low contrast and must fail DE3 even when page JavaScript tries to lie.</p></main>
  <script>
    window.getComputedStyle = new Proxy(window.getComputedStyle, {
      apply(target, thisArg, args) {
        const style = Reflect.apply(target, thisArg, args);
        return new Proxy(style, {
          get(value, prop) {
            if (prop === 'color') return 'rgb(0, 0, 0)';
            if (prop === 'backgroundColor') return 'rgb(255, 255, 255)';
            return value[prop];
          }
        });
      }
    });
  </script>
</body>
</html>`);
    const { findings } = await analyzeVisualTells(htmlPath);
    const de3 = findingById(findings, 'DE3');
    assert.equal(de3.pass, false);
    assert.match(de3.evidence, /contrast \d+\.\d+:1/);
  });
});

test('visual containment: remote subresources make zero network requests', visualTest, async () => {
  let requests = 0;
  const server = createServer((req, res) => {
    requests += 1;
    res.writeHead(req.url.endsWith('.woff2') ? 200 : 204, {
      'Content-Type': req.url.endsWith('.woff2') ? 'font/woff2' : 'image/png',
    });
    res.end();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const { port } = server.address();
    await withTempDir(async (dir) => {
      const htmlPath = join(dir, 'remote-subresources.html');
      await writeFile(htmlPath, `<!doctype html>
<html>
<head>
  <style>
    @font-face { font-family: "RemoteFont"; src: url("http://127.0.0.1:${port}/font.woff2"); }
    body { font-family: "RemoteFont", sans-serif; color: #111; background: #fff; }
  </style>
</head>
<body>
  <main><p>Network containment must block both font and image fetches.</p><img src="http://127.0.0.1:${port}/p.png" alt=""></main>
</body>
</html>`);
      await analyzeVisualTells(htmlPath);
    });
    assert.equal(requests, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
// ── TY5-A 한글 어절 중간 줄바꿈 (시각 fail, 양면) ──

test('TY5 hangul: mid-word break in narrow column fails (no keep-all)', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/hangul-word-break.html'));
  const ty5 = findingById(findings, 'TY5');
  assert.equal(ty5.pass, false);
  assert.match(ty5.evidence, /어절 중간 줄바꿈/);
});

test('TY5 hangul: keep-all spaced text does not fire (clean guard, 오탐0)', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/hangul-keepall-clean.html'));
  assert.equal(findingById(findings, 'TY5').pass, true);
});

// ── webfont ② 선언 폰트 미적용 (시각 WARN, 보수적) ──

test('webfont ② warns when a declared @font-face fails to load', visualTest, async () => {
  const { warnings } = await analyzeVisualTells(repoPath('tests/redteam/webfont-not-applied.html'));
  assert.ok(hasWarning(warnings, 'webfont-not-applied'), JSON.stringify(warnings));
});

test('webfont ② silent when no @font-face is declared (clean guard)', visualTest, async () => {
  const { warnings } = await analyzeVisualTells(repoPath('tests/redteam/hangul-keepall-clean.html'));
  assert.ok(!hasWarning(warnings, 'webfont-not-applied'));
});

// ── 오탐0 가드: transform / no-main dominance ──

test('TY5-A skips transformed text (rect top unreliable, no false fail)', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/hangul-transform-clean.html'));
  assert.equal(findingById(findings, 'TY5').pass, true);
});

test('TY2 no-main ignores a long fine-print div when body size dominates', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/no-main-legal-div-longer.html'));
  assert.equal(findingById(findings, 'TY2').pass, true);
});

test('scroll-driven reveal (MO4 safe pattern) is measured cleanly — no hiding/false-fail', visualTest, async () => {
  const { findings } = await analyzeVisualTells(repoPath('tests/redteam/scroll-driven-reveal.html'));
  // 콘텐츠를 opacity:0로 숨기지 않는 MO4 안전 패턴 — 시각 레인이 scroll=0에서 전부 측정,
  // L1/L2/S3/TY1/TY2/DE3 어느 것도 오판(은폐로 인한 false-pass/false-fail)하지 않는다.
  assert.ok(findings.every((f) => f.pass), JSON.stringify(findings.filter((f) => !f.pass)));
});
