// M4 소스 인테이크 — slop 소스에서 보존 클레임을 구조화 추출한다.
//
// Phase 0에서 클레임(숫자·가격·기능)을 동결 자산으로 잡아두고,
// Phase 5에서 빌드 산출물과 대조한다 (patina MPS 원칙: 디자인이 바뀌어도
// 숫자·사실·인과는 불변). URL 입력은 SSRF 가드를 통과해야 한다.

import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { stripTags } from './audit.js';

// ---------------------------------------------------------------- 클레임 추출

const CLAIM_PATTERNS = [
  // 가격: 9,000원 / ₩9,000 / $8 / $8/user/month / 8달러
  { kind: 'price', re: /(?:₩\s?[\d,]+|[\d,]+(?:\.\d+)?\s?원|\$\s?[\d,]+(?:\.\d+)?(?:\s?\/\s?[a-z가-힣]+){0,2}|[\d,]+(?:\.\d+)?\s?달러)/giu },
  // 백분율: 99.9%
  { kind: 'percent', re: /\d+(?:\.\d+)?\s?%/g },
  // 기간/시간: 24시간, 5분, 30일, 7 days, 24h
  { kind: 'duration', re: /\d+(?:\.\d+)?\s?(?:시간|분(?![야양])|초|일(?=[\s,.!?)]|$)|개월|년|days?|hours?|minutes?|h\b|min\b)/giu },
  // 수량: 30개, 30개의 템플릿, 30 templates, 12종
  { kind: 'quantity', re: /\d[\d,]*\s?(?:개|종|가지|명|곳|templates?|items?|features?|users?|projects?)/giu },
];

function contextAround(text, index, length, span = 40) {
  const start = Math.max(0, index - span);
  const end = Math.min(text.length, index + length + span);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function looksLikeHtml(source) {
  return /<[a-z!][\s\S]*>/i.test(source);
}

// 기능 클레임: HTML이면 li/h2/h3, 마크다운/플레인이면 불릿 라인.
function extractFeatureClaims(source) {
  const features = [];
  if (looksLikeHtml(source)) {
    for (const [, , inner] of source.matchAll(/<(li|h2|h3)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
      const text = stripTags(inner).replace(/\s+/g, ' ').trim();
      if (text.length >= 4) features.push(text);
    }
  } else {
    for (const line of source.split('\n')) {
      const m = /^\s*(?:[-*•]|\d+\.)\s+(.+)$/.exec(line);
      if (m && m[1].trim().length >= 4) features.push(m[1].trim());
    }
  }
  return features;
}

// 소스(HTML/마크다운/플레인텍스트)에서 보존 클레임을 추출한다.
// 반환: { claims: [{ kind, value, context }] } — kind: price|percent|duration|quantity|feature
export function extractClaims(source) {
  const text = looksLikeHtml(source)
    ? stripTags(source).replace(/\s+/g, ' ')
    : String(source);
  const claims = [];
  const seen = new Set();
  for (const { kind, re } of CLAIM_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const value = m[0].trim();
      const key = `${kind}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      claims.push({ kind, value, context: contextAround(text, m.index, m[0].length) });
    }
  }
  for (const feature of extractFeatureClaims(source)) {
    const key = `feature:${feature}`;
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push({ kind: 'feature', value: feature, context: feature });
  }
  return { claims };
}

// Phase 5 클레임 대조표 — 컨셉 시트의 "보존 클레임" 섹션 형식.
export function buildClaimTable({ claims }, { source = '' } = {}) {
  const lines = [
    `## 보존 클레임 (변경 불가)${source ? ` — ${source}` : ''}`,
    '',
    '| kind | 클레임 | 문맥 |',
    '|---|---|---|',
  ];
  for (const c of claims) {
    lines.push(`| ${c.kind} | ${c.value.replace(/\|/g, '\\|')} | ${c.context.replace(/\|/g, '\\|')} |`);
  }
  if (!claims.length) lines.push('| - | (추출된 클레임 없음 — 수동 확인 필요) | - |');
  return lines.join('\n');
}

// ---------------------------------------------------------------- SSRF 가드

const FETCH_MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30000;
const MAX_REDIRECTS = 3;

// private/loopback/link-local/메타데이터 대역 차단.
export function isPrivateAddress(addr) {
  if (isIP(addr) === 4) {
    const [a, b] = addr.split('.').map(Number);
    return a === 10 || a === 127 || a === 0
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 169 && b === 254);
  }
  const v6 = addr.toLowerCase();
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd')
    || v6.startsWith('fe80') || v6.startsWith('::ffff:127.') || v6.startsWith('::ffff:10.')
    || v6.startsWith('::ffff:192.168.') || v6.startsWith('::ffff:169.254.');
}

// URL 한 개를 검증한다 — 스킴, 호스트명, DNS 해석 결과까지.
export async function assertSafeUrl(rawUrl, { lookupImpl = dnsLookup } = {}) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`invalid URL: ${rawUrl}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`blocked: only http/https allowed (got ${url.protocol})`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new Error(`blocked: ${host} resolves to a private host`);
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error(`blocked: ${host} is a private address`);
    return url;
  }
  const resolved = await lookupImpl(host, { all: true });
  for (const { address } of resolved) {
    if (isPrivateAddress(address)) {
      throw new Error(`blocked: ${host} resolves to private address ${address}`);
    }
  }
  return url;
}

async function readCappedBody(res, cap) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw new Error(`response exceeds ${cap} byte cap`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// SSRF 가드를 통과한 URL을 텍스트로 가져온다. 리다이렉트는 매 hop 재검증.
export async function fetchSource(rawUrl, { fetchImpl = fetch, lookupImpl = dnsLookup } = {}) {
  let url = await assertSafeUrl(rawUrl, { lookupImpl });
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetchImpl(url.href, { redirect: 'manual', signal });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new Error(`redirect without location from ${url.href}`);
      url = await assertSafeUrl(new URL(location, url).href, { lookupImpl });
      continue;
    }
    if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
    return readCappedBody(res, FETCH_MAX_BYTES);
  }
  throw new Error(`too many redirects (max ${MAX_REDIRECTS})`);
}
