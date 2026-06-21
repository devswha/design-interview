import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INERT_CSP,
  stripActiveContent,
  neutralizeRemoteUrls,
  sanitizeStyleTag,
  getAttr,
  isStylesheetLink,
  isRemoteHref,
  isRemoteUrl,
} from '../../src/inert-html.js';

test('INERT_CSP blocks scripts and remote subresources', () => {
  assert.match(INERT_CSP, /script-src 'none'/);
  assert.match(INERT_CSP, /default-src 'none'/);
  assert.match(INERT_CSP, /img-src data:/);
  assert.match(INERT_CSP, /font-src data:/);
  assert.match(INERT_CSP, /frame-src 'none'/);
  // 원격 이미지/스타일은 허용되지 않는다(data:만).
  assert.doesNotMatch(INERT_CSP, /img-src[^;]*https?:/);
});

test('stripActiveContent removes scripts, handlers, and javascript: URLs', () => {
  const out = stripActiveContent(
    `<p>a</p><script>alert(1)</script><button onclick="evil()">x</button><a href="javascript:evil()">y</a>`,
  );
  assert.doesNotMatch(out, /<script/i);
  assert.doesNotMatch(out, /onclick/i);
  assert.doesNotMatch(out, /javascript:/i);
});

test('stripActiveContent removes base and meta refresh', () => {
  const out = stripActiveContent(`<base href="https://evil.test/"><meta http-equiv="refresh" content="0;url=https://evil.test">`);
  assert.doesNotMatch(out, /<base/i);
  assert.doesNotMatch(out, /http-equiv\s*=\s*["']?refresh/i);
});

test('stripActiveContent strips iframe srcdoc (CSP bypass surface)', () => {
  const out = stripActiveContent(`<iframe srcdoc="<script>alert(1)</script>"></iframe>`);
  assert.doesNotMatch(out, /srcdoc/i);
});

test('stripActiveContent removes remote stylesheet links and remote media URLs', () => {
  const out = stripActiveContent(
    `<link rel="stylesheet" href="https://cdn.test/x.css"><img src="https://cdn.test/a.png"><source srcset="https://cdn.test/b.png 1x">`,
  );
  assert.doesNotMatch(out, /https:\/\/cdn\.test\/x\.css/);
  assert.doesNotMatch(out, /https:\/\/cdn\.test\/a\.png/);
  assert.doesNotMatch(out, /https:\/\/cdn\.test\/b\.png/);
});

test('stripActiveContent keeps local relative content intact', () => {
  const html = `<link rel="stylesheet" href="local.css"><a href="/online=1">ok</a>`;
  const out = stripActiveContent(html);
  assert.match(out, /local\.css/);
  // `/on…=` 경로를 핸들러로 오인해 잘라먹지 않는다.
  assert.match(out, /\/online=1/);
});

test('stripActiveContent handles unclosed script tags', () => {
  assert.doesNotMatch(stripActiveContent('<p>a</p><script>while(1){}'), /<script/i);
});

test('neutralizeRemoteUrls disables remote and javascript url() but keeps local', () => {
  assert.match(neutralizeRemoteUrls('a{background:url(https://cdn.test/x.png)}'), /url\("#"\)/);
  assert.match(neutralizeRemoteUrls('a{background:url(//cdn.test/x.png)}'), /url\("#"\)/);
  assert.match(neutralizeRemoteUrls('a{background:url(javascript:evil())}'), /url\("#"\)/);
  assert.match(neutralizeRemoteUrls('a{background:url(local.png)}'), /url\(local\.png\)/);
});

test('neutralizeRemoteUrls is linear on unterminated url(', () => {
  const css = 'a{background:url(https://cdn.test/x'.repeat(2000);
  const out = neutralizeRemoteUrls(css); // 미완 url( — 그대로 두되 무한 루프/폭주 없음
  assert.equal(typeof out, 'string');
});

test('sanitizeStyleTag drops @import and neutralizes remote url()', () => {
  const out = sanitizeStyleTag(`<style>@import url(https://cdn.test/x.css); a{background:url(https://cdn.test/y.png)}</style>`);
  assert.doesNotMatch(out, /@import/i);
  assert.doesNotMatch(out, /https:\/\/cdn\.test\/y\.png/);
});

test('getAttr / isStylesheetLink / isRemoteHref / isRemoteUrl helpers', () => {
  assert.equal(getAttr('<link rel="stylesheet" href="x.css">', 'href'), 'x.css');
  assert.equal(isStylesheetLink('<link rel="stylesheet preload">'), true);
  assert.equal(isStylesheetLink('<link rel="preload">'), false);
  assert.equal(isRemoteHref('https://x.test/a'), true);
  assert.equal(isRemoteHref('//x.test/a'), true);
  assert.equal(isRemoteHref('local.css'), false);
  assert.equal(isRemoteUrl('http://x.test'), true);
  assert.equal(isRemoteUrl('data:image/png;base64,AAAA'), false);
});
