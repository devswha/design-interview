import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditHtml, formatAuditReport } from '../../src/audit.js';

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

// ---------------------------------------------------------------------------
// TY4 type-family-discipline
// ---------------------------------------------------------------------------

test('TY4 parses font: shorthand — family-only regex would miss the third family', () => {
  const two = auditHtml(`<style>
    body{font-family:Inter,sans-serif} h1{font-family:Poppins,sans-serif}
  </style>`);
  assert.ok(!two.failed.includes('TY4'), 'two families are within budget');
  const three = auditHtml(`<style>
    body{font-family:Inter,sans-serif} h1{font-family:Poppins,sans-serif}
    blockquote{font:16px/1.5 Georgia, serif}
  </style>`);
  assert.ok(three.failed.includes('TY4'), 'shorthand-declared Georgia must be counted');
  assert.match(three.findings.find((f) => f.id === 'TY4').evidence, /georgia/);
});

test('TY4 exempts mono stacks scoped to code contexts, flags decorative mono roles', () => {
  const scoped = auditHtml(`<style>
    body{font-family:Inter,sans-serif} h1{font-family:'Playfair Display',serif}
    code,pre{font-family:'JetBrains Mono',monospace}
  </style>`);
  assert.ok(!scoped.failed.includes('TY4'), 'code/pre mono does not count against the family budget');
  const decorative = auditHtml(`<style>
    body{font-family:Inter,sans-serif}
    .price{font-family:'Space Mono',monospace} .badge{font-family:'Space Mono',monospace}
  </style>`);
  assert.ok(decorative.failed.includes('TY4'), 'mono on two non-code roles fails');
});

test('TY4 requires generic fallback, exempts bare system-ui and inherit', () => {
  const bare = auditHtml('<style>body{font-family:Helvetica}</style>');
  assert.ok(bare.failed.includes('TY4'));
  const sys = auditHtml('<style>body{font-family:system-ui}</style>');
  assert.ok(!sys.failed.includes('TY4'));
  const inh = auditHtml('<style>body{font-family:Georgia,serif}button{font-family:inherit}</style>');
  assert.ok(!inh.failed.includes('TY4'), 'font-family:inherit is not a stack');
});

test('TY4 ignores @font-face definitions and resolves var() stacks', () => {
  const r = auditHtml(`<style>
    @font-face{font-family:'Custom Sans';src:url(a.woff2)}
    :root{--ff-body:Georgia, serif}
    body{font-family:var(--ff-body)}
  </style>`);
  assert.ok(!r.failed.includes('TY4'), '@font-face name needs no generic; var() resolves via :root');
});

// ---------------------------------------------------------------------------
// CO1 color-literal-budget
// ---------------------------------------------------------------------------

const hexList = (n) => Array.from({ length: n }, (_, i) => `.c${i}{color:#${(i + 1).toString(16).padStart(3, '1')}}`).join('');

test('CO1 fails above 12 distinct loose literals, counts duplicates once', () => {
  const over = auditHtml(`<style>${hexList(13)}</style>`);
  assert.ok(over.failed.includes('CO1'));
  const within = auditHtml(`<style>${hexList(12)}.dup{background:#111}</style>`);
  assert.ok(!within.failed.includes('CO1'), 'repeated literal is one resolved value');
  const notation = auditHtml(`<style>${hexList(12)}.x{border-color:#111111}</style>`);
  assert.ok(!notation.failed.includes('CO1'), '#111 and #111111 resolve to the same color');
});

test('CO1 ignores :root token definitions and var() references', () => {
  const tokens = Array.from({ length: 15 }, (_, i) => `--c${i}:#${(i + 1).toString(16).padStart(3, '2')}`).join(';');
  const r = auditHtml(`<style>:root{${tokens}}.a{color:var(--c1);background:var(--c2)}</style>`);
  assert.ok(!r.failed.includes('CO1'), 'token sheet and var() usage are budget-free');
});

test('CO1 matches named colors as whole tokens only — no substring or font-name hits', () => {
  const r = auditHtml(`<style>${hexList(12)}
    .a{border-color:var(--reddish)}
    .b{font-family:'Red Hat Display',sans-serif;font:14px/1.4 'Tan Pearl',serif}
  </style>`);
  assert.ok(!r.failed.includes('CO1'), 'reddish/font names must not count as red/tan');
  const named = auditHtml(`<style>${hexList(12)}.c{border:1px solid tomato}</style>`);
  assert.ok(named.failed.includes('CO1'), 'a real named color as 13th literal fails');
});

// ---------------------------------------------------------------------------
// DE1 shadow-physics-budget
// ---------------------------------------------------------------------------

test('DE1 splits multi-shadow lists at top level, not inside rgba()', () => {
  const r = auditHtml(`<style>.a{box-shadow:
    0 1px 2px rgba(0,0,0,.1), 0 2px 4px rgba(0,0,0,.1),
    0 4px 8px rgba(0,0,0,.1), 0 8px 16px rgba(0,0,0,.1)}</style>`);
  assert.ok(r.failed.includes('DE1'));
  assert.match(r.findings.find((f) => f.id === 'DE1').evidence, /4 distinct/);
});

test('DE1 resolves var() and dedupes identical signatures across media queries', () => {
  const r = auditHtml(`<style>
    :root{--shadow-sm:0 2px 8px rgba(0,0,0,.12)}
    .card{box-shadow:var(--shadow-sm)}
    @media (min-width:800px){.card{box-shadow:0 2px 8px rgba(0, 0, 0, 0.12)}}
  </style>`);
  assert.ok(!r.failed.includes('DE1'), 'same resolved value is one signature');
});

test('DE1 flags physics violations on blurred shadows', () => {
  const hex8 = auditHtml('<style>.a{box-shadow:0 4px 12px #00000080}</style>');
  assert.ok(hex8.failed.includes('DE1'), '8-digit hex alpha .5 > .3');
  const slash = auditHtml('<style>.a{box-shadow:0 4px 12px rgb(0 0 0 / 0.45)}</style>');
  assert.ok(slash.failed.includes('DE1'), 'slash-syntax alpha .45 > .3');
  const up = auditHtml('<style>.a{box-shadow:0 -6px 16px rgba(0,0,0,.2)}</style>');
  assert.ok(up.failed.includes('DE1'), 'negative y-offset floats the shadow');
  const tinted = auditHtml('<style>.a{box-shadow:0 4px 12px rgba(91,108,240,.2)}</style>');
  assert.ok(tinted.failed.includes('DE1'), 'non-neutral shadow color');
  const sane = auditHtml('<style>.a{box-shadow:0 2px 8px rgba(0,0,0,.12),inset 0 1px 0 rgba(255,255,255,.6)}</style>');
  assert.ok(!sane.failed.includes('DE1'), 'soft neutral shadow + inset highlight passes');
});

test('DE1 sanctions exactly one hard-offset brutalist shadow', () => {
  const one = auditHtml('<style>.a{box-shadow:4px 4px 0 #000}</style>');
  assert.ok(!one.failed.includes('DE1'), 'alpha/neutrality caps do not apply at blur 0');
  const two = auditHtml('<style>.a{box-shadow:4px 4px 0 #000}.b{box-shadow:8px 8px 0 #000}</style>');
  assert.ok(two.failed.includes('DE1'), 'two distinct hard-offset signatures fail');
});

test('DE1 ignores focus-ring shadows — DE3가 권장하는 outline 대체와 충돌하지 않는다', () => {
  // 브루탈리스트 그림자 1종 + :focus-visible 포커스 링(blur 0) — 링은 고도 표면이 아니다.
  const r = auditHtml(`<style>
    .a{box-shadow:6px 6px 0 #000}
    button:focus-visible{outline:none;box-shadow:0 0 0 2px #1f1d1a}
  </style>`);
  assert.ok(!r.failed.includes('DE1'), 'focus-ring box-shadow does not count toward hard-offset budget');
  assert.ok(!r.failed.includes('DE3'), 'the same ring satisfies DE3 as a visible replacement');
});

// ---------------------------------------------------------------------------
// DE3 quality-floor
// ---------------------------------------------------------------------------

test('DE3 flags outline:none focus rules without replacement', () => {
  const bare = auditHtml('<style>button:focus{outline:none}</style>');
  assert.ok(bare.failed.includes('DE3'));
  const replaced = auditHtml('<style>button:focus{outline:none;box-shadow:0 0 0 2px #1f1d1a}</style>');
  assert.ok(!replaced.failed.includes('DE3'), 'replacement in the same rule passes');
});

test('DE3 lenient excuse: any visible :focus-visible treatment clears the page', () => {
  const r = auditHtml(`<style>
    button:focus{outline:0}
    :focus-visible{outline:2px solid #1f1d1a}
  </style>`);
  assert.ok(!r.failed.includes('DE3'), 'split-selector pages must not FP');
});

test('DE3 flags transition:all including inside shorthand', () => {
  const all = auditHtml('<style>*{transition:all .3s ease}</style>');
  assert.ok(all.failed.includes('DE3'));
  const scoped = auditHtml('<style>a{transition:opacity .2s,transform .2s}</style>');
  assert.ok(!scoped.failed.includes('DE3'));
});

test('DE3 flags zoom-blocking viewport meta', () => {
  const noScale = auditHtml('<meta name="viewport" content="width=device-width, user-scalable=no"><p>x</p>');
  assert.ok(noScale.failed.includes('DE3'));
  const maxOne = auditHtml('<meta name="viewport" content="width=device-width, maximum-scale=1.0"><p>x</p>');
  assert.ok(maxOne.failed.includes('DE3'));
  const sane = auditHtml('<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5"><p>x</p>');
  assert.ok(!sane.failed.includes('DE3'), 'maximum-scale=5 still allows zoom');
});

test('DE3 requires width/height attributes on img', () => {
  const missing = auditHtml('<img src="hero.jpg" alt="가게 전경">');
  assert.ok(missing.failed.includes('DE3'));
  const sized = auditHtml('<img src="hero.jpg" width="800" height="600" alt="가게 전경">');
  assert.ok(!sized.failed.includes('DE3'));
});

// ---------------------------------------------------------------------------
// warnings 채널 — 절대 fail로 승격되지 않는다
// ---------------------------------------------------------------------------

test('warnings flag straight quotes / -- / ... but never fail the audit', () => {
  const r = auditHtml('<p>It\'s a "quoted" promise -- trust us ...</p>');
  assert.equal(r.pass, true);
  assert.deepEqual(r.failed, []);
  const names = r.warnings.map((w) => w.name);
  assert.ok(names.includes('straight-quotes'));
  assert.ok(names.includes('double-hyphen'));
  assert.ok(names.includes('ascii-ellipsis'));
  const report = formatAuditReport(r);
  assert.match(report, /WARN\s+straight-quotes/);
});

test('warnings exempt code/pre/kbd/samp contexts', () => {
  const r = auditHtml('<pre>npm install --save-dev "thing" ...</pre><p>국밥 9,000원</p>');
  assert.deepEqual(r.warnings, []);
});
// ---------------------------------------------------------------------------
// TY5-B/C 한글 조판 정적 경고 (WARN, 보수적)
// ---------------------------------------------------------------------------

test('TY5-B warns when Korean body has a Latin-only font stack', () => {
  const r = auditHtml('<style>body{font-family:Inter,sans-serif}</style><p>국밥 한 그릇 9,000원</p>');
  assert.equal(r.pass, true, 'WARN은 납품을 막지 않는다');
  assert.ok(r.warnings.some((w) => w.name === 'hangul-no-korean-font'));
});

test('TY5-B silent when the stack already names a Korean font', () => {
  const r = auditHtml('<style>body{font-family:Pretendard,sans-serif}</style><p>국밥 한 그릇 9,000원</p>');
  assert.ok(!r.warnings.some((w) => w.name === 'hangul-no-korean-font'));
});

test('TY5-C warns on Korean fake italic', () => {
  const r = auditHtml('<p style="font-style:italic">강조하고 싶은 한글 문장</p>');
  assert.equal(r.pass, true);
  assert.ok(r.warnings.some((w) => w.name === 'hangul-fake-italic'));
});

test('TY5-B/C stay silent on non-Korean pages', () => {
  const r = auditHtml('<style>body{font-family:Inter,sans-serif;font-style:italic}</style><p>English only paragraph, nothing to flag</p>');
  assert.ok(!r.warnings.some((w) => w.name.startsWith('hangul-')));
});
