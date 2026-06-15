import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractClaims, buildClaimTable, assertSafeUrl, isPrivateAddress, fetchSource, looksLikeUrl } from '../../src/intake.js';
import { examplePath } from '../helpers/index.js';

const byKind = (claims, kind) => claims.filter((c) => c.kind === kind).map((c) => c.value);

test('korean prices and quantities extracted', () => {
  const { claims } = extractClaims('돼지국밥 9,000원, 수육 15,000원. 템플릿 30개 포함, 만족도 99.9%.');
  assert.ok(byKind(claims, 'price').includes('9,000원'));
  assert.ok(byKind(claims, 'price').includes('15,000원'));
  assert.ok(byKind(claims, 'quantity').includes('30개'));
  assert.ok(byKind(claims, 'percent').includes('99.9%'));
});

test('english pricing forms extracted', () => {
  const { claims } = extractClaims('From $8/user/month. Includes 30 templates and a 7 days trial.');
  assert.ok(byKind(claims, 'price').some((v) => v.startsWith('$8')));
  assert.ok(byKind(claims, 'quantity').includes('30 templates'));
  assert.ok(byKind(claims, 'duration').includes('7 days'));
});

test('html source: tags stripped, list items become feature claims', async () => {
  const html = await readFile(examplePath('slop-source.html'), 'utf8');
  const { claims } = extractClaims(html);
  assert.ok(byKind(claims, 'quantity').some((v) => v.includes('30개')));
  assert.ok(byKind(claims, 'feature').some((v) => v.includes('템플릿')));
  assert.ok(claims.every((c) => !c.value.includes('<')), 'no tags leak into claims');
});

test('claims dedupe and table renders', () => {
  const r = extractClaims('9,000원 그리고 또 9,000원');
  assert.equal(byKind(r.claims, 'price').length, 1);
  const table = buildClaimTable(r, { source: 'x.html' });
  assert.match(table, /\| price \| 9,000원 \|/);
  assert.match(buildClaimTable({ claims: [] }), /추출된 클레임 없음/);
});

test('context window never splits a surrogate pair (no lone surrogate �)', () => {
  // 🚀(U+1F680) 직후에 클레임을 두면, 클레임 기준 span 컷이
  // 이모지 서로게이트 페어 한가운데를 가를 수 있다.
  const src = '지금 시작하기 🚀 템플릿 30개 포함, 손쉽게 활용하세요.';
  const { claims } = extractClaims(src);
  const q = claims.find((c) => c.kind === 'quantity' && c.value === '30개');
  assert.ok(q, '수량 클레임이 추출돼야 한다');
  // 외톨이 서로게이트(0xD800–0xDFFF without partner)가 남으면 안 된다.
  for (let i = 0; i < q.context.length; i++) {
    const code = q.context.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = q.context.charCodeAt(i + 1);
      assert.ok(next >= 0xdc00 && next <= 0xdfff, `lone high surrogate at ${i}`);
      i += 1;
    } else {
      assert.ok(!(code >= 0xdc00 && code <= 0xdfff), `lone low surrogate at ${i}`);
    }
  }
  assert.ok(!q.context.includes('\ufffd'), 'replacement char must not appear');
});

test('ssrf: private address detection', () => {
  for (const addr of ['127.0.0.1', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateAddress(addr), true, addr);
  }
  for (const addr of ['8.8.8.8', '172.32.0.1', '1.1.1.1', '2606:4700::1111']) {
    assert.equal(isPrivateAddress(addr), false, addr);
  }
});

test('ssrf: scheme, localhost, literal-ip, and dns-resolved blocks', async () => {
  await assert.rejects(() => assertSafeUrl('ftp://example.com/x'), /only http\/https/);
  await assert.rejects(() => assertSafeUrl('http://localhost/x'), /private host/);
  await assert.rejects(() => assertSafeUrl('http://127.0.0.1/x'), /private address/);
  await assert.rejects(() => assertSafeUrl('http://169.254.169.254/meta'), /private address/);
  const evilLookup = async () => [{ address: '10.0.0.7', family: 4 }];
  await assert.rejects(
    () => assertSafeUrl('http://rebind.example.com/', { lookupImpl: evilLookup }),
    /resolves to private address 10\.0\.0\.7/,
  );
});

test('ssrf: redirect hops are re-validated, private target never requested', async () => {
  const okLookup = async () => [{ address: '93.184.216.34', family: 4 }];
  const requested = [];
  const requestImpl = async (url) => {
    requested.push(url.href);
    assert.ok(!url.href.includes('127.0.0.1'), 'private redirect target must never be requested');
    return { statusCode: 302, headers: { location: 'http://127.0.0.1/internal' }, resume() {} };
  };
  await assert.rejects(
    () => fetchSource('http://public.example.com/', { requestImpl, lookupImpl: okLookup }),
    /private address/,
  );
  assert.deepEqual(requested, ['http://public.example.com/']);
});

test('ssrf: connect-time guarded lookup blocks dns rebinding', async () => {
  // 사전 검증은 공인 IP를 돌려주고, 연결 시점 lookup은 private을 돌려준다.
  let calls = 0;
  const rebindingLookup = async () => {
    calls += 1;
    return calls === 1
      ? [{ address: '93.184.216.34', family: 4 }]
      : [{ address: '10.0.0.7', family: 4 }];
  };
  // 실제 requestOnce 경로를 태우되 소켓 연결 전에 lookup 훅에서 막혀야 한다.
  await assert.rejects(
    () => fetchSource('http://rebind.example.com/', { lookupImpl: rebindingLookup }),
    /resolves to private address 10\.0\.0\.7/,
  );
});

test('ssrf: ipv4-mapped ipv6 ranges reduce to ipv4 rules (dotted and hex forms)', () => {
  for (const addr of [
    '::ffff:172.16.0.1', '::ffff:172.31.9.9', '::ffff:10.1.2.3', '::ffff:169.254.169.254', '::ffff:0.0.0.0',
    '::ffff:ac10:1', '::ffff:7f00:1', '0:0:0:0:0:ffff:ac10:1', '0000:0000:0000:0000:0000:ffff:a9fe:a9fe',
  ]) {
    assert.equal(isPrivateAddress(addr), true, addr);
  }
  for (const addr of ['::ffff:8.8.8.8', '::ffff:808:808', '2606:4700::1111']) {
    assert.equal(isPrivateAddress(addr), false, addr);
  }
});

test('ssrf: hex-mapped literal in URL is blocked', async () => {
  await assert.rejects(() => assertSafeUrl('http://[::ffff:ac10:1]/x'), /private address/);
});

test('looksLikeUrl routes every scheme to the guard', () => {
  for (const u of ['http://x', 'https://x', 'ftp://x', 'file:///etc/passwd', 'gopher://x']) {
    assert.equal(looksLikeUrl(u), true, u);
  }
  for (const p of ['./page.html', 'examples/slop.html', 'C:no', 'plain text']) {
    assert.equal(looksLikeUrl(p), false, p);
  }
});

test('number bomb: 1MB digit line completes fast and bounded', () => {
  const bomb = '9'.repeat(1024 * 1024);
  const started = Date.now();
  const { claims } = extractClaims(bomb);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 3000, `took ${elapsed}ms`);
  assert.ok(claims.length < 50, 'no claim explosion');
});
