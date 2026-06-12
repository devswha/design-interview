import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditHtml } from '../../src/audit.js';

const CLEAN = `<!doctype html><html><head><style>
  body{background:#faf8f4;color:#1f1d1a;font-family:serif}
  .hero{border-radius:0}.note{border-radius:4px}.photo{border-radius:2px}
</style></head><body>
  <h1>매일 아침 다섯 시간 고아낸 국물</h1>
  <p>돼지 사골만 씁니다. 30년째 같은 거래처에서 받습니다.</p>
  <ul><li>국밥 9,000원</li><li>수육 한 접시 15,000원</li></ul>
  <button>전화 예약</button>
</body></html>`;

test('slop fixture fails machine checks with evidence', async () => {
  const html = await readFile(new URL('../../examples/slop-source.html', import.meta.url), 'utf8');
  const r = auditHtml(html);
  assert.equal(r.pass, false);
  assert.ok(r.failed.includes('C1'), 'purple gradient hero');
  assert.ok(r.failed.includes('T1'), 'emoji bullets');
  assert.ok(r.failed.includes('T2'), 'hype adjectives');
  assert.ok(r.failed.includes('T4'), 'Simple. Powerful. Seamless.');
  for (const f of r.findings.filter((x) => !x.pass)) assert.ok(f.evidence, `${f.id} has evidence`);
});

test('clean page passes all machine checks', () => {
  const r = auditHtml(CLEAN);
  assert.deepEqual(r.failed, []);
  assert.equal(r.pass, true);
  assert.equal(r.slopScore, 0);
});

test('C1 ignores non-purple gradients', () => {
  const r = auditHtml('<style>.x{background:linear-gradient(#e8e4dc,#d9d2c5)}</style><p>ok</p>');
  assert.ok(!r.failed.includes('C1'));
});

test('S5 flags three identical nonzero radii, allows varied ones', () => {
  const uniform = auditHtml('<style>.a{border-radius:12px}.b{border-radius:12px}.c{border-radius:12px}</style>');
  assert.ok(uniform.failed.includes('S5'));
  const varied = auditHtml('<style>.a{border-radius:12px}.b{border-radius:4px}.c{border-radius:0}</style>');
  assert.ok(!varied.failed.includes('S5'));
});

test('T2 checks body text only, not attributes or css', () => {
  const r = auditHtml('<div class="seamless-grid" data-x="effortless"><p>국밥 9,000원</p></div>');
  assert.ok(!r.failed.includes('T2'));
});

test('T4 ignores normal multi-sentence headings', () => {
  const r = auditHtml('<h2>아침에 끓여서 저녁에 다 팝니다. 남는 국물은 버립니다.</h2>');
  assert.ok(!r.failed.includes('T4'));
});
