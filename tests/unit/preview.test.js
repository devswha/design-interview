import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPreviewHtml, stripActiveContent } from '../../src/preview.js';

const BUILT = `<!doctype html><html><head><style>h1{color:#222}</style></head>
<body><h1>국밥집 페이지</h1><script>alert(1)</script><a href="javascript:evil()">x</a>
<button onclick="evil()">go</button></body></html>`;

const SLOP = `<html><head></head><body><h1>✨ 혁신적인 솔루션</h1></body></html>`;

test('preview is inert: scripts, handlers, javascript: URLs removed', () => {
  const out = buildPreviewHtml({ builtHtml: BUILT });
  assert.ok(!/<script/i.test(out));
  assert.ok(!/onclick/i.test(out));
  assert.ok(!/javascript:/i.test(out));
  assert.match(out, /Content-Security-Policy/);
  assert.match(out, /script-src 'none'/);
});

test('built-only preview has no original toggle', () => {
  const out = buildPreviewHtml({ builtHtml: BUILT });
  assert.match(out, /국밥집 페이지/);
  assert.ok(!out.includes('original (slop)'));
  assert.ok(!out.includes('id="dsiv-original"'));
});

test('--against adds 3-state toggle and original pane', () => {
  const out = buildPreviewHtml({ builtHtml: BUILT, originalHtml: SLOP });
  assert.match(out, /id="dsiv-built"[^>]*checked/);
  assert.match(out, /id="dsiv-original"/);
  assert.match(out, /id="dsiv-both"/);
  assert.match(out, /혁신적인 솔루션/);
  assert.match(out, /납품물 아님/);
});

test('built head styles are carried into the preview', () => {
  const out = buildPreviewHtml({ builtHtml: BUILT });
  assert.match(out, /\.dsiv-built h1 \{ color:#222 \}/);
});

test('remote stylesheet links are stripped from preview head', () => {
  const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="https://cdn.example/theme.css">
    <link href="//cdn.example/print.css" rel="stylesheet">
    <style>h1{color:#222}</style>
    </head><body><h1>x</h1></body></html>`;
  const out = buildPreviewHtml({ builtHtml: html });
  assert.ok(!out.includes('cdn.example'), 'remote stylesheet hrefs must not survive');
  assert.match(out, /\.dsiv-built h1 \{ color:#222 \}/, 'safe inline style remains');
});

test('stylesheet link parser ignores data-* attribute suffixes', () => {
  const html = `<!doctype html><html><head>
    <link data-rel="stylesheet" href="favicon.ico">
    <link data-href="https://cdn.example/a.css" rel="stylesheet" href="local.css">
    </head><body><h1>x</h1></body></html>`;
  const out = buildPreviewHtml({ builtHtml: html });
  assert.ok(!out.includes('favicon.ico'), 'data-rel is not rel');
  assert.ok(!out.includes('href="local.css"'), 'dead local stylesheet links are dropped');
  assert.ok(!out.includes('data-href="https://cdn.example/a.css"'), 'dead local stylesheet links are dropped with their tag');
});

test('inline style imports and remote CSS URLs are neutralized', () => {
  const html = `<!doctype html><html><head>
    <style>@import url("https://evil.example/steal.css");h1{color:#222;background:url(//evil.example/pixel.png)}</style>
    </head><body><h1>x</h1></body></html>`;
  const out = buildPreviewHtml({ builtHtml: html });
  assert.ok(!out.includes('@import'), 'remote @import rule is removed');
  assert.ok(!out.includes('evil.example'), 'remote CSS URL is neutralized');
  assert.match(out, /\.dsiv-built h1 \{ color:#222;background:url\("#"\) \}/, 'safe inline declarations remain');
});

test('body-level base, remote stylesheet link, and remote media URLs are stripped', () => {
  const out = buildPreviewHtml({
    builtHtml: '<body>ok</body>',
    originalHtml: '<body><base href="https://evil/"><link rel=stylesheet href="https://evil/steal.css"><img src="https://evil/track.gif"><source srcset="//evil/a.webp 1x, local.webp 2x"></body>',
    title: 't',
  });
  assert.ok(!out.includes('steal.css'));
  assert.ok(!/<base\b/i.test(out));
  assert.ok(!out.includes('https://evil/track.gif'));
  assert.ok(!out.includes('//evil/a.webp'));
  assert.match(out, /src="#"/, 'remote img src is neutralized');
  assert.match(out, /local\.webp 2x/, 'local srcset candidate survives');
});

test('preview CSP blocks remote style, image, and font subresources', () => {
  const out = buildPreviewHtml({ builtHtml: BUILT });
  const csp = /Content-Security-Policy" content="([^"]+)"/.exec(out)?.[1] ?? '';
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'none'/);
  assert.match(csp, /style-src 'unsafe-inline'(?:;|$)/);
  assert.match(csp, /img-src data:(?:;|$)/);
  assert.match(csp, /font-src data:(?:;|$)/);
  assert.doesNotMatch(csp, /(?:style-src|img-src|font-src)[^;]*\*/);
});

test('chrome visibility rules outrank audited CSS by #dsiv-root scope + source order', () => {
  const html = `<!doctype html><html><head>
    <style>.dsiv-bar{display:none !important}body .dsiv-pane{display:block !important}</style>
    </head><body><h1>x</h1></body></html>`;
  const out = buildPreviewHtml({ builtHtml: html });
  // 크롬은 #dsiv-root로 스코프(특이도 ↑) + !important.
  assert.match(out, /#dsiv-root \.dsiv-pane\{display:none!important\}/);
  assert.match(out, /#dsiv-root #dsiv-built:checked~\.dsiv-built,#dsiv-root #dsiv-original:checked~\.dsiv-original\{display:block!important\}/);
  assert.match(out, /#dsiv-root #dsiv-both:checked~\.dsiv-pane\{display:block!important\}/);
  // 크롬·토글·패널은 #dsiv-root 안에 있어 스코프가 실제로 매칭된다.
  assert.match(out, /<div id="dsiv-root">/);
  // CHROME_CSS는 수집된 산출물 스타일보다 뒤에 와야 동률 !important도 크롬이 이긴다.
  assert.ok(out.indexOf('#dsiv-root .dsiv-bar{position') > out.indexOf('.dsiv-bar{display:none'),
    'chrome CSS must be emitted after audited styles');
});

test('stripActiveContent handles unclosed script tags', () => {
  assert.ok(!/<script/i.test(stripActiveContent('<p>a</p><script>while(1){}')));
});

test('buildPreviewHtml requires builtHtml', () => {
  assert.throws(() => buildPreviewHtml({}), /builtHtml is required/);
});

test('preview title is HTML-escaped (caller-controlled filename cannot inject markup)', () => {
  const out = buildPreviewHtml({ builtHtml: BUILT, title: 'x</title><style>body{display:none}</style>' });
  // 원시 닫는 태그가 그대로 새지 않고 escape되어야 한다.
  assert.ok(!out.includes('x</title><style>'));
  assert.match(out, /&lt;\/title&gt;/);
});

test('pane styles are isolated per built and original side', () => {
  const out = buildPreviewHtml({
    builtHtml: '<html><head><style>p{color:rgb(0,128,0)}</style></head><body><p>built</p></body></html>',
    originalHtml: '<html><head><style>p{color:rgb(255,0,0)}</style></head><body><p>orig</p></body></html>',
  });
  assert.match(out, /\.dsiv-built p \{ color:rgb\(0,128,0\) \}/);
  assert.match(out, /\.dsiv-original p \{ color:rgb\(255,0,0\) \}/);
  assert.ok(!/\.dsiv-built p \{ color:rgb\(255,0,0\)/.test(out));
});

test('selector scoping handles root, selector-list, and root-like non-roots', () => {
  const out = buildPreviewHtml({
    builtHtml: `<html><head><style>
      body{a:b}
      body.theme .card{a:b}
      html[data-mode]{a:b}
      html body .chain{a:b}
      :root{--x:1}
      .a,.b{a:b}
      tbody{a:b}
      .bodyish{a:b}
    </style></head><body>x</body></html>`,
  });
  assert.match(out, /\.dsiv-built \{ a:b \}/);
  assert.match(out, /\.dsiv-built\.theme \.card \{ a:b \}/);
  assert.match(out, /\.dsiv-built\[data-mode\] \{ a:b \}/);
  assert.match(out, /\.dsiv-built \.chain \{ a:b \}/);
  assert.match(out, /\.dsiv-built \{ --x:1 \}/);
  assert.match(out, /\.dsiv-built \.a,\.dsiv-built \.b \{ a:b \}/);
  assert.match(out, /\.dsiv-built tbody \{ a:b \}/);
  assert.match(out, /\.dsiv-built \.bodyish \{ a:b \}/);
});

test('nested media rules are preserved with inner selectors scoped', () => {
  const out = buildPreviewHtml({
    builtHtml: '<html><head><style>@media (max-width:600px){.card{display:block}}</style></head><body></body></html>',
  });
  assert.match(out, /@media \(max-width:600px\) \{ \.dsiv-built \.card \{ display:block \} \}/);
});

test('declaration at-rules stay unprefixed (@font-face global; @keyframes namespaced per pane)', () => {
  const out = buildPreviewHtml({
    builtHtml: '<html><head><style>@font-face{font-family:X;src:url(./f.woff2)}@keyframes spin{from{}to{}}</style></head><body></body></html>',
  });
  assert.match(out, /@font-face\{font-family:X;src:url\(\.\/f\.woff2\)\}/);
  // @keyframes is left a declaration at-rule (not selector-prefixed) but name-namespaced per pane (#38 collision fix).
  assert.match(out, /@keyframes spin__dsiv-built\{from\{\}to\{\}\}/);
  assert.doesNotMatch(out, /\.dsiv-built @font-face/);
  assert.doesNotMatch(out, /\.dsiv-built @keyframes/);
});

test('malformed CSS is stripped and reported without leaking rules', () => {
  const out = buildPreviewHtml({
    builtHtml: '<html><head><style>.leak{color:red</style></head><body></body></html>',
  });
  assert.ok(!out.includes('.leak{color:red'));
  assert.match(out, /malformed CSS stripped/);
});

test('pane root preserves safe html and body attributes', () => {
  const out = buildPreviewHtml({
    builtHtml: '<html lang="ko" data-shell="web"><head></head><body class="theme" data-mode="x" id="bad" style="color:red" onclick="x()">ok</body></html>',
  });
  assert.match(out, /<div class="dsiv-pane dsiv-built theme" lang="ko" data-shell="web" data-mode="x">/);
  assert.doesNotMatch(out, /id="bad"/);
  assert.doesNotMatch(out, /onclick/);
});

test('local CSS inputs inline scoped and link warnings render without dead links', () => {
  const out = buildPreviewHtml({
    builtHtml: '<html><head><link rel="stylesheet" href="./x.css"></head><body><p>x</p></body></html>',
    builtLocalCss: ['p{color:blue}'],
    builtLinkWarnings: ['stylesheet skipped: ./x.css (missing)'],
  });
  assert.match(out, /\.dsiv-built p \{ color:blue \}/);
  assert.match(out, /<span class="dsiv-warning">stylesheet skipped: \.\/x\.css \(missing\)<\/span>/);
  assert.ok(!out.includes('<link'));
});

test('chrome CSS follows scoped styles, CSP is unchanged, and built-only has no original pane', () => {
  const out = buildPreviewHtml({ builtHtml: BUILT, builtLocalCss: ['p{color:blue}'] });
  const csp = /Content-Security-Policy" content="([^"]+)"/.exec(out)?.[1] ?? '';
  assert.equal(csp, "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; frame-src 'none'; script-src 'none'");
  assert.ok(out.indexOf('#dsiv-root .dsiv-bar{position') > out.indexOf('.dsiv-built p { color:blue }'));
  assert.ok(!out.includes('dsiv-original"><span'));
});

// Gate-found #38 hardening: unscoped at-rule leak, functional-pseudo root, dsiv-* class spoof.
const styleBlocksOf = (h) => (h.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');

test('#38: unknown/unscoped grouping at-rules (@scope) are dropped, not emitted global', () => {
  const out = buildPreviewHtml({
    builtHtml: '<html><head><style>@scope (body){p{color:rgb(0,128,0)}}</style></head><body><p>b</p></body></html>',
    originalHtml: '<html><head><style>p{color:rgb(255,0,0)}</style></head><body><p>o</p></body></html>',
  });
  assert.ok(!/@scope/.test(styleBlocksOf(out)), '@scope must not survive in any <style> (would leak across panes)');
  assert.match(out, /at-rule dropped/);
  // grouping at-rules that DO scope safely still work:
  const media = buildPreviewHtml({ builtHtml: '<html><head><style>@media (min-width:1px){.x{color:red}}</style></head><body><p>x</p></body></html>' });
  assert.match(styleBlocksOf(media), /@media \(min-width:1px\) \{ \.dsiv-built \.x/);
  // @starting-style recurses (inner scoped):
  const ss = buildPreviewHtml({ builtHtml: '<html><head><style>@starting-style{.x{opacity:0}}</style></head><body><p>x</p></body></html>' });
  assert.match(styleBlocksOf(ss), /@starting-style \{ \.dsiv-built \.x/);
});

test('#38: root inside :is()/:where()/:not() is dropped+warned, not silently mis-scoped', () => {
  const out = buildPreviewHtml({ builtHtml: '<html><head><style>:is(body) p{color:red}:where(:root){--c:red}.ok{color:green}</style></head><body><p>x</p></body></html>' });
  const styles = styleBlocksOf(out);
  assert.ok(!/:is\(body\)/.test(styles) && !/:where\(:root\)/.test(styles), 'functional-pseudo root forms must not be emitted');
  assert.match(out, /selector skipped/);
  assert.match(styles, /\.dsiv-built \.ok/, 'non-root selectors still scope normally');
});

test('#38: reserved dsiv-* source classes are filtered from the pane root (no toggle spoof)', () => {
  const out = buildPreviewHtml({ builtHtml: '<html><head></head><body class="dsiv-original dsiv-bar theme">x</body></html>' });
  const paneClass = /<div class="(dsiv-pane dsiv-built[^"]*)"/.exec(out)?.[1] ?? '';
  assert.ok(paneClass.includes('theme'), 'real page classes preserved');
  assert.ok(!/\bdsiv-original\b/.test(paneClass) && !/\bdsiv-bar\b/.test(paneClass), 'reserved dsiv-* tokens stripped');
});

// Gate re-review #38 hardening (round 2): body <style> leak + :is(.body) class false-positive.
test('#38: body <style> tags are scoped into the pane, not injected raw (no cross-pane leak)', () => {
  const out = buildPreviewHtml({
    builtHtml: '<html><body><p>built</p></body></html>',
    originalHtml: '<html><body><style>p{color:rgb(255,0,0)}</style><p>orig</p></body></html>',
  });
  const paneRegion = out.slice(out.indexOf('<div id="dsiv-root"'));
  assert.ok(!/<style>/.test(paneRegion), 'no raw <style> injected inside panes');
  assert.match(styleBlocksOf(out), /\.dsiv-original p/, 'original body style scoped to its pane');
});

test('#38: :is(.body) (class, not element) is scoped, not dropped; :is(body) element still dropped', () => {
  const cls = buildPreviewHtml({ builtHtml: '<html><head><style>:is(.body) p{color:green}</style></head><body><div class="body"><p>x</p></div></body></html>' });
  assert.match(styleBlocksOf(cls), /\.dsiv-built :is\(\.body\) p/, '.body class must scope, not drop');
  const el = buildPreviewHtml({ builtHtml: '<html><head><style>:is(body) p{color:red}</style></head><body><p>x</p></body></html>' });
  assert.ok(!/:is\(body\)/.test(styleBlocksOf(el)), ':is(body) element form still dropped+warned');
});

test('#38: @keyframes are namespaced per pane so same-named animations do not cross-contaminate', () => {
  const out = buildPreviewHtml({
    builtHtml: '<html><head><style>.card{animation:fadeIn 1s both}@keyframes fadeIn{from{opacity:0}to{opacity:1}}</style></head><body><div class="card">b</div></body></html>',
    originalHtml: '<html><head><style>@keyframes fadeIn{from{transform:scale(.5)}to{transform:scale(2)}}</style></head><body><p>o</p></body></html>',
  });
  assert.match(out, /@keyframes fadeIn__dsiv-built/);
  assert.match(out, /@keyframes fadeIn__dsiv-original/);
  assert.match(out, /animation:fadeIn__dsiv-built 1s both/);
  // no bare global "fadeIn" keyframes that both panes would share
  assert.ok(!/@keyframes fadeIn\{/.test(out.replace(/fadeIn__\w+/g, 'X')) && !/@keyframes fadeIn /.test(out.replace(/fadeIn__\w+/g, 'X')));
});
