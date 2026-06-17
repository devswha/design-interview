import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditHtml, combineAudits, formatAuditReport } from '../../src/audit.js';
import { stripTags } from '../../src/text.js';
import { examplePath, fixturePath, redteamPath } from '../helpers/index.js';

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
  const html = await readFile(examplePath('slop-source.html'), 'utf8');
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

test('stripTags strips unterminated script/style to EOF fast', () => {
  assert.equal(stripTags('<p>visible</p><script>seamless'), ' visible  ');
  assert.equal(stripTags('<style>.x{color:red}</style><p>visible</p>'), '  visible ');
  const html = '<script>x'.repeat(200_000);
  const started = performance.now();
  assert.equal(stripTags(html).trim(), '');
  assert.ok(performance.now() - started < 1_000, 'large unclosed script is bounded');
});

test('unclosed interactive tags still fire their blocking slop tells (no gate bypass)', () => {
  // boundedTagInner가 미닫힌 <li>/<button>/<h1>에서 null을 돌려 스킵하던 false-negative를
  // 막는다 — HTML5에서 </li>·</hN>는 선택적이므로 닫지 않은 슬롭이 차단 게이트를 우회했었다.
  // (대용량 입력 선형성은 text-layer의 stripTags 200k 테스트 + CLI DoS repro로 검증.)
  const emoji = auditHtml('<ul><li>🚀 빠른 배송<li>⚡ 신선한 재료<li>✨ 정성</ul>');
  assert.ok(emoji.failed.includes('T1'), 'unclosed <li> emoji bullets must fire T1');
  const headings = auditHtml('<section><h1>Simple. Powerful. Seamless.<h1>다음 섹션</section>');
  assert.ok(headings.failed.includes('T4'), 'unclosed <h1> symmetric triple must fire T4');
});

test('unclosed style still feeds C1', async () => {
  const html = await readFile(redteamPath('unclosed-style-gradient.html'), 'utf8');
  const r = auditHtml(html);
  assert.ok(r.blockingFailed.includes('C1'));
  assert.equal(r.pass, false);
});

test('unterminated script hype stays out of T2 body text', async () => {
  const html = await readFile(redteamPath('unclosed-script-hype.html'), 'utf8');
  const r = auditHtml(html);
  assert.ok(!r.failed.includes('T2'));
  assert.equal(r.pass, true);
});

test('combineAudits slopScore stays within 0..1 even with many visual failures (R7)', () => {
  // 정적 4건 fail + 시각 6건 fail 을 합쳐도 slopScore는 0..1을 벗어나면 안 된다
  // (분모를 MACHINE_CHECKS.length로 고정해 100% 초과(167%)가 찍히던 회귀 가드).
  const staticResult = auditHtml(CLEAN); // 0 fail
  const visual = {
    findings: ['L1', 'L2', 'S3', 'TY1', 'TY2', 'TY5'].map((id) => ({ id, name: id, severity: 'advisory', pass: false, evidence: 'e' })),
    warnings: [],
  };
  const combined = combineAudits(staticResult, visual);
  assert.ok(combined.slopScore >= 0 && combined.slopScore <= 1, `slopScore ${combined.slopScore} must be within 0..1`);
  // 분자/분모가 같은 findings 집합: 6 fail / 15 findings(9 정적 + 6 시각).
  assert.equal(combined.slopScore, 6 / 15);
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
  for (const stack of ['Pretendard,sans-serif', "'Noto Serif KR',serif", "'Noto Sans KR',sans-serif"]) {
    const r = auditHtml(`<style>body{font-family:${stack}}</style><p>국밥 한 그릇 9,000원</p>`);
    assert.ok(!r.warnings.some((w) => w.name === 'hangul-no-korean-font'), `Korean font in "${stack}" should silence TY5-B`);
  }
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
// ---------------------------------------------------------------------------
// webfont ① 원격 CDN 폰트 의존 (정적 WARN)
// ---------------------------------------------------------------------------

test('webfont ① warns on a Google Fonts <link> dependency', () => {
  const r = auditHtml('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter"><p>hello world paragraph</p>');
  assert.equal(r.pass, true, 'WARN은 납품을 막지 않는다');
  assert.ok(r.warnings.some((w) => w.name === 'webfont-cdn-dependency'));
});

test('webfont ① warns on a remote @font-face src', () => {
  const r = auditHtml('<style>@font-face{font-family:X;src:url(https://cdn.example.com/x.woff2)}body{font-family:X,sans-serif}</style><p>hello world paragraph</p>');
  assert.ok(r.warnings.some((w) => w.name === 'webfont-cdn-dependency'));
});

test('webfont ① silent on self-hosted/relative and system fonts', () => {
  const r = auditHtml('<style>@font-face{font-family:Local;src:url(./fonts/local.woff2)}body{font-family:Local,system-ui,sans-serif}</style><p>hello world paragraph</p>');
  assert.ok(!r.warnings.some((w) => w.name === 'webfont-cdn-dependency'));
});

test('TY5-B fires even when the Latin stack has no generic fallback', () => {
  const r = auditHtml('<style>body{font-family:Inter}</style><p>국밥 한 그릇 9,000원</p>');
  assert.ok(r.warnings.some((w) => w.name === 'hangul-no-korean-font'));
});

test('TY5-B silent on a CSS-wide keyword stack (inherit)', () => {
  const r = auditHtml('<style>p{font-family:inherit}</style><p>국밥 한 그릇 9,000원</p>');
  assert.ok(!r.warnings.some((w) => w.name === 'hangul-no-korean-font'));
});

test('webfont ① catches a vendor CDN font stylesheet by url', () => {
  const r = auditHtml('<link rel="stylesheet" href="https://cdn.vendor.example/fonts/inter.css"><p>hello world paragraph</p>');
  assert.ok(r.warnings.some((w) => w.name === 'webfont-cdn-dependency'));
});

// ---------------------------------------------------------------------------
// b1 reduced-motion 미가드 모션 (정적 WARN, MO2/DE3 교차 — fail 아님)
// ---------------------------------------------------------------------------

const hasMotionWarn = (r) => r.warnings.some((w) => w.name === 'motion-not-reduced-motion-guarded');

test('motion WARN fires on unguarded transition and animation, never fails', () => {
  const r = auditHtml('<style>.x{transition:transform .25s ease}.y{animation:spin 2s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}</style><p>가나다 본문</p>');
  assert.equal(r.pass, true, 'WARN은 납품을 막지 않는다');
  assert.deepEqual(r.failed, []);
  assert.ok(hasMotionWarn(r));
});

test('motion WARN silent when motion is inside prefers-reduced-motion: no-preference', () => {
  const r = auditHtml('<style>@media (prefers-reduced-motion: no-preference){.x{transition:transform .25s ease}.y{animation:spin 2s linear infinite}}@keyframes spin{to{transform:rotate(360deg)}}</style><p>가나다 본문</p>');
  assert.ok(!hasMotionWarn(r));
});

test('motion WARN silent on zero-duration / none and @keyframes from/to do not leak', () => {
  const zero = auditHtml('<style>.x{transition:color 0s}.y{animation:none}</style><p>본문</p>');
  assert.ok(!hasMotionWarn(zero));
  // @keyframes 안의 from/to 셀렉터는 규칙으로 누출되지 않는다(중첩 스캐너가 @keyframes 블록을 건너뜀)
  const kf = auditHtml('<style>@keyframes spin{from{transform:none}to{transform:rotate(360deg)}}</style><p>본문</p>');
  assert.ok(!hasMotionWarn(kf), '@keyframes 정의만으로는 미가드 모션이 아니다');
});

test('motion WARN not bypassed by an empty reduced-motion guard block', () => {
  const r = auditHtml('<style>@media (prefers-reduced-motion: no-preference){}.x{transition:transform .3s ease}</style><p>본문</p>');
  assert.ok(hasMotionWarn(r), '모션 위치로 판정 — 빈 가드 블록 우회 불가');
});

test('motion WARN: guarded-motion clean fixture is silent, exp output stays WARN0', async () => {
  const guarded = await readFile(fixturePath('clean/reduced-motion-guarded.html'), 'utf8');
  assert.ok(!hasMotionWarn(auditHtml(guarded)), 'guarded fixture must not warn');
  const unguarded = await readFile(redteamPath('motion-unguarded.html'), 'utf8');
  assert.ok(hasMotionWarn(auditHtml(unguarded)), 'unguarded fixture must warn');
  const exp = await readFile(fixturePath('clean/skillshop-mo.html'), 'utf8');
  const r = auditHtml(exp);
  assert.deepEqual(r.failed, [], 'exp stays slop 0%');
  assert.deepEqual(r.warnings, [], 'exp stays WARN0 — all motion is reduced-motion guarded');
});

// ---------------------------------------------------------------------------
// 2채널 분할 — 차단(품질바닥선+지문) vs 권고(억제 휴리스틱). pass = blocking만.
// ---------------------------------------------------------------------------

test('audit 2-channel: advisory-only fail passes the delivery gate', () => {
  // CO1(색 예산 초과)은 억제 휴리스틱 = advisory → 차단 안 함
  const r = auditHtml(`<style>${hexList(13)}</style><p>가나다 본문</p>`);
  assert.ok(r.advisoryFailed.includes('CO1'), 'CO1은 advisory 채널');
  assert.deepEqual(r.blockingFailed, [], '차단 채널 비어있음');
  assert.equal(r.pass, true, 'advisory만 실패하면 납품 게이트 통과(pass=true)');
  assert.ok(r.failed.includes('CO1'), 'failed(union)에는 여전히 포함 — benchmark 탐지');
  assert.equal(typeof r.slopScore, 'number', 'slopScore 키 존속(하위호환)');
});

test('audit 2-channel: deterministic fingerprint (C1) blocks delivery', () => {
  const r = auditHtml('<section style="background:linear-gradient(135deg,#667eea,#764ba2)"><h1>x</h1></section>');
  assert.ok(r.blockingFailed.includes('C1'), 'C1 보라그라데는 blocking 지문');
  assert.equal(r.pass, false, 'blocking 발화 시 납품 불가');
});

test('audit 2-channel: TY4 3-family is advisory (good type system not blocked)', () => {
  const r = auditHtml(`<style>
    body{font-family:Inter,sans-serif} h1{font-family:Georgia,serif}
    .n{font-family:'Space Mono',monospace} .b{font-family:'Space Mono',monospace}
  </style><p>가나다 본문</p>`);
  assert.ok(r.advisoryFailed.includes('TY4'), 'TY4는 억제 휴리스틱 = advisory');
  assert.equal(r.pass, true, '세리프+산스+모노 같은 의도된 타입 시스템은 차단 안 됨');
});
