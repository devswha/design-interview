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
  assert.match(out, /h1\{color:#222\}/);
});

test('remote stylesheet links are stripped from preview head', () => {
  const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="https://cdn.example/theme.css">
    <link href="//cdn.example/print.css" rel="stylesheet">
    <style>h1{color:#222}</style>
    </head><body><h1>x</h1></body></html>`;
  const out = buildPreviewHtml({ builtHtml: html });
  assert.ok(!out.includes('cdn.example'), 'remote stylesheet hrefs must not survive');
  assert.match(out, /h1\{color:#222\}/, 'safe inline style remains');
});

test('stylesheet link parser ignores data-* attribute suffixes', () => {
  const html = `<!doctype html><html><head>
    <link data-rel="stylesheet" href="favicon.ico">
    <link data-href="https://cdn.example/a.css" rel="stylesheet" href="local.css">
    </head><body><h1>x</h1></body></html>`;
  const out = buildPreviewHtml({ builtHtml: html });
  assert.ok(!out.includes('favicon.ico'), 'data-rel is not rel');
  assert.match(out, /href="local\.css"/, 'real local href is preserved');
  assert.match(out, /data-href="https:\/\/cdn\.example\/a\.css"/, 'data-href does not make a local href remote');
});

test('stripActiveContent handles unclosed script tags', () => {
  assert.ok(!/<script/i.test(stripActiveContent('<p>a</p><script>while(1){}')));
});

test('buildPreviewHtml requires builtHtml', () => {
  assert.throws(() => buildPreviewHtml({}), /builtHtml is required/);
});
