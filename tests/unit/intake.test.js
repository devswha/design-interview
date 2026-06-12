import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractClaims, buildClaimTable, assertSafeUrl, isPrivateAddress, fetchSource } from '../../src/intake.js';

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
  const html = await readFile(new URL('../../examples/slop-source.html', import.meta.url), 'utf8');
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

test('ssrf: redirect hops are re-validated', async () => {
  const okLookup = async () => [{ address: '93.184.216.34', family: 4 }];
  const fetchImpl = async (href) => {
    assert.ok(!href.includes('127.0.0.1'), 'private redirect target must never be fetched');
    return { status: 302, ok: false, headers: new Map([['location', 'http://127.0.0.1/internal']]), statusText: 'Found' };
  };
  fetchImpl.headersFix = true;
  await assert.rejects(
    () => fetchSource('http://public.example.com/', {
      fetchImpl: async (href) => {
        const r = await fetchImpl(href);
        return { ...r, headers: { get: (k) => r.headers.get(k) } };
      },
      lookupImpl: okLookup,
    }),
    /private address/,
  );
});
