// M4 소스 인테이크 — slop 소스에서 보존 클레임을 구조화 추출한다.
//
// Phase 0에서 클레임(숫자·가격·기능)을 동결 자산으로 잡아두고,
// Phase 5에서 빌드 산출물과 대조한다 (patina MPS 원칙: 디자인이 바뀌어도
// 숫자·사실·인과는 불변). URL 입력은 SSRF 가드를 통과해야 한다.
//
// SSRF 가드는 2단이다: ①사전 검증(assertSafeUrl — 스킴/호스트/DNS),
// ②연결 시점 검증(node http/https의 lookup 훅) — 검증과 연결 사이에
// DNS 응답이 바뀌는 리바인딩을 차단한다.
//
// fetchBinary 결과는 호출자가 카테고리 디렉터리(assets/icons|images|textures)에 저장하고 .license.txt sidecar(source/license/출처)를 동반해야 한다(NF2).

import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { stripTags } from './text.js';

// ---------------------------------------------------------------- 클레임 추출

// 숫자 원자: 선두 숫자 + (천단위/소수점) 내부 런. 내부 런에서 공백(\s)을 빼고
// 길이를 {0,40}로 묶는다 — 줄을 넘나드는 \s + 단위 실패 백트래킹이 2MB 입력에서
// O(n²) ReDoS(intake 행)를 내던 것을 막고, 앞 숫자를 통째로 삼켜 잘못 동결하던
// (구분자+숫자 reach-back) 회귀도 함께 닫는다. {0,40}는 천단위 구분 포함 어떤 실제
// 숫자도 담으면서(이전 {0,18}은 20자 초과 그룹 숫자를 잘라 동결) 백트래킹은 여전히 유계.
const NUMBER_SOURCE = String.raw`\d(?:[\d.,]{0,40}\d)?`;
const RANGE_SEP = String.raw`\s*[-–—~]\s*`; // 하이픈/en·em대시 + 한국어 주력 범위 글리프 '~'
// 기간 단위. 개\s?월은 stripTags가 인라인 요소 사이에 공백을 넣은 '3 개 월'까지 흡수해
// 수량 '개' phantom을 막는다. 복수형 trailing-s를 모두 허용(wks/mins/yrs/secs).
const DUR_UNITS = String.raw`시간|분(?![야양])|초|일(?![0-9A-Za-z정요주반상자치출])|개\s?월|년|days?|hours?|minutes?|months?|weeks?|h\b|mins?\b|wks?\b|mo\b|yrs?\b|secs?\b|ms\b`;
// 수량 단위. 개(?!\s?월)로 공백이 끼인 '개 월'도 수량에서 배제(개월은 기간).
const QTY_UNITS = String.raw`개(?!\s?월)|종|가지|명|곳|templates?|items?|features?|users?|projects?`;
const PRICE_SUFFIX = String.raw`원|달러|€`;

const CLAIM_PATTERNS = [
  // 가격: 9,000원 / ₩9,000 / $8 / $8/user/month / 8달러
  { kind: 'price', re: new RegExp(String.raw`(?:₩\s?${NUMBER_SOURCE}|${NUMBER_SOURCE}\s?원|\$\s?${NUMBER_SOURCE}(?:\s?\/\s?[a-z가-힣]+){0,2}|${NUMBER_SOURCE}\s?달러|${NUMBER_SOURCE}\s?€)`, 'giu') },
  // 백분율: 99.9%
  { kind: 'percent', re: new RegExp(String.raw`${NUMBER_SOURCE}\s?%`, 'gu') },
  // 기간/시간: 24시간, 5분, 30일, 7 days, 24h, 3 months, 4 wks
  { kind: 'duration', re: new RegExp(String.raw`${NUMBER_SOURCE}\s?(?:${DUR_UNITS})`, 'giu') },
  // 수량: 30개, 30개의 템플릿, 30 templates, 12종
  { kind: 'quantity', re: new RegExp(String.raw`${NUMBER_SOURCE}\s?(?:${QTY_UNITS})`, 'giu') },
];

// 범위 클레임은 단일 패턴보다 먼저 돌려 양 끝점을 한 스팬으로 동결한다(하한 누락 방지).
const CLAIM_RANGE_PATTERNS = [
  { kind: 'duration', re: new RegExp(String.raw`${NUMBER_SOURCE}${RANGE_SEP}${NUMBER_SOURCE}\s?(?:${DUR_UNITS})`, 'giu') },
  { kind: 'quantity', re: new RegExp(String.raw`${NUMBER_SOURCE}${RANGE_SEP}${NUMBER_SOURCE}\s?(?:${QTY_UNITS})`, 'giu') },
  { kind: 'percent', re: new RegExp(String.raw`${NUMBER_SOURCE}${RANGE_SEP}${NUMBER_SOURCE}\s?%`, 'gu') },
  { kind: 'price', re: new RegExp(String.raw`(?:\$|₩)\s?${NUMBER_SOURCE}${RANGE_SEP}(?:\$|₩)?\s?${NUMBER_SOURCE}|${NUMBER_SOURCE}${RANGE_SEP}${NUMBER_SOURCE}\s?(?:${PRICE_SUFFIX})`, 'giu') },
];

// 숫자 폭탄 방어: 실제 클레임에 16자리+ 숫자 연속이나 2000자+ 라인은 없다.
// 캡 없이 matchAll을 돌리면 1MB 숫자 라인에서 O(n²)로 행이 걸린다.
const MAX_DIGIT_RUN = 15;
const MAX_SCAN_LINE = 2000;
const MAX_SCAN_BYTES = 2 * 1024 * 1024;

function boundForScan(text) {
  return String(text)
    .slice(0, MAX_SCAN_BYTES)
    .split('\n')
    .map((line) => line.slice(0, MAX_SCAN_LINE))
    .join('\n')
    .replace(/\d{16,}/g, (run) => run.slice(0, MAX_DIGIT_RUN));
}

function contextAround(text, index, length, span = 40) {
  let start = Math.max(0, index - span);
  let end = Math.min(text.length, index + length + span);
  // 서로게이트 페어 한가운데서 자르면 외톨이 서로게이트(�)가 남는다.
  // start가 low 서로게이트면 그 앞의 high가 잘려나간 것 → 한 칸 민다.
  // end 직전이 high 서로게이트면 뒤의 low가 잘려나갈 것 → 한 칸 당긴다.
  if (start > 0 && text.charCodeAt(start) >= 0xdc00 && text.charCodeAt(start) <= 0xdfff) start += 1;
  if (end < text.length && text.charCodeAt(end - 1) >= 0xd800 && text.charCodeAt(end - 1) <= 0xdbff) end -= 1;
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

function looksLikeHtml(source) {
  return /<[a-z!][\s\S]*>/i.test(source);
}

// 기능 클레임: HTML이면 li/h2/h3, 마크다운/플레인이면 불릿 라인.
function extractFeatureClaims(source) {
  const scan = boundForScan(source);
  const features = [];
  if (looksLikeHtml(scan)) {
    for (const [, , inner] of scan.matchAll(/<(li|h2|h3)\b[^>]*>([\s\S]{0,2000}?)<\/\1\s*>/gi)) {
      const text = stripTags(inner).replace(/\s+/g, ' ').trim();
      if (text.length >= 4) features.push(text.slice(0, MAX_SCAN_LINE));
    }
  } else {
    for (const line of scan.split('\n')) {
      const m = /^\s*(?:[-*•]|\d+\.)\s+(.+)$/.exec(line.slice(0, MAX_SCAN_LINE));
      if (m && m[1].trim().length >= 4) features.push(m[1].trim());
    }
  }
  return features;
}

// 소스(HTML/마크다운/플레인텍스트)에서 보존 클레임을 추출한다.
// 반환: { claims: [{ kind, value, context }] } — kind: price|percent|duration|quantity|feature
export function extractClaims(source) {
  const raw = boundForScan(source);
  const text = looksLikeHtml(raw) ? stripTags(raw).replace(/\s+/g, ' ') : raw;
  const claims = [];
  const seen = new Set();
  const occupied = [];

  const addClaim = (kind, value, index, length) => {
    const key = `${kind}:${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    occupied.push([index, index + length]);
    claims.push({ kind, value, context: contextAround(text, index, length) });
  };

  const overlapsClaim = (index, length) => occupied.some(([start, end]) => index < end && index + length > start);

  for (const { kind, re } of CLAIM_RANGE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      addClaim(kind, m[0].trim(), m.index, m[0].length);
    }
  }
  for (const { kind, re } of CLAIM_PATTERNS) {
    for (const m of text.matchAll(re)) {
      if (overlapsClaim(m.index, m[0].length)) continue;
      addClaim(kind, m[0].trim(), m.index, m[0].length);
    }
  }
  for (const feature of extractFeatureClaims(raw)) {
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

// CLI 라우팅용: scheme:// 형태면 전부 URL로 취급해 가드를 태운다.
// (http/https만 정규식으로 거르면 ftp://가 파일 경로로 새는 구멍이 생긴다.)
export function looksLikeUrl(target) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(target);
}

// IPv6 주소를 8개 16비트 그룹으로 정식 전개한다. 끝의 dotted IPv4 표기는
// 두 그룹으로 환산. 실패 시 null.
function expandV6Groups(addr) {
  let a = addr.toLowerCase();
  const dotted = /^(.*):(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (dotted) {
    const o = dotted[2].split('.').map(Number);
    if (o.some((n) => n > 255)) return null;
    a = `${dotted[1]}:${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`;
  }
  const hasCompress = a.includes('::');
  const [headStr, tailStr = ''] = hasCompress ? a.split('::') : [a];
  const head = headStr ? headStr.split(':').filter(Boolean) : [];
  const tail = hasCompress && tailStr ? tailStr.split(':').filter(Boolean) : [];
  const fill = 8 - head.length - tail.length;
  if (!hasCompress && head.length !== 8) return null;
  if (hasCompress && fill < 1) return null;
  const groups = [...head, ...Array(hasCompress ? fill : 0).fill('0'), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

// IPv4-mapped/compatible/NAT64 IPv6이면 내장된 IPv4를 돌려준다.
// dotted(::ffff:172.16.0.1)와 hex(::ffff:ac10:1) 표기 모두 잡는다.
function embeddedV4(addr) {
  const g = expandV6Groups(addr);
  if (!g) return null;
  const v4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  const mapped = g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff;
  const compatible = g.slice(0, 6).every((x) => x === 0);
  const nat64 = g[0] === 0x0064 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0);
  return mapped || compatible || nat64 ? v4 : null;
}

// private/loopback/link-local/메타데이터 대역 차단.
// IPv4 내장 IPv6는 모든 표기를 IPv4 검사로 환원한다.
export function isPrivateAddress(addr) {
  if (isIP(addr) === 4) {
    const [a, b] = addr.split('.').map(Number);
    return a === 10 || a === 127 || a === 0
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 169 && b === 254);
  }
  const v6 = addr.toLowerCase();
  const v4 = embeddedV4(v6);
  if (v4) return isPrivateAddress(v4);
  const groups = expandV6Groups(v6);
  const linkLocal = groups ? (groups[0] & 0xffc0) === 0xfe80 : false;
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd')
    || linkLocal;
}

function abortError() {
  const err = new Error('lookup timed out');
  err.name = 'AbortError';
  return err;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw signal.reason ?? abortError();
}

function withAbort(promise, signal) {
  if (!signal) return promise;
  throwIfAborted(signal);
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason ?? abortError()), { once: true });
    }),
  ]);
}

// URL 한 개를 사전 검증한다 — 스킴, 호스트명, DNS 해석 결과까지.
export async function assertSafeUrl(rawUrl, { lookupImpl = dnsLookup, signal } = {}) {
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
  const resolved = await withAbort(lookupImpl(host, { all: true }), signal);
  if (!resolved || resolved.length === 0) throw new Error(`blocked: ${host} did not resolve`);
  for (const { address } of resolved) {
    if (isPrivateAddress(address)) {
      throw new Error(`blocked: ${host} resolves to private address ${address}`);
    }
  }
  return url;
}

// 연결 시점 lookup 훅 — 소켓이 실제로 붙을 주소를 다시 검증한다.
// 사전 검증(assertSafeUrl)과 연결 사이에 DNS 응답이 바뀌어도(리바인딩)
// private 주소로는 연결되지 않는다.
function guardedLookup(lookupImpl, signal) {
  return (hostname, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'function' ? {} : options ?? {};
    withAbort(lookupImpl(hostname, { all: true }), signal).then((addrs) => {
      if (!addrs || addrs.length === 0) {
        cb(new Error(`no addresses for ${hostname}`));
        return;
      }
      const bad = addrs.find((a) => isPrivateAddress(a.address));
      if (bad) {
        cb(new Error(`blocked: ${hostname} resolves to private address ${bad.address}`));
        return;
      }
      if (opts.all) cb(null, addrs);
      else if (addrs[0]) cb(null, addrs[0].address, addrs[0].family);
      else cb(new Error(`no addresses for ${hostname}`));
    }, (err) => cb(err));
  };
}

function requestOnce(url, { lookupImpl, signal }) {
  return new Promise((resolvePromise, rejectPromise) => {
    const mod = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = mod(url, { lookup: guardedLookup(lookupImpl, signal), signal }, resolvePromise);
    req.on('error', rejectPromise);
    req.end();
  });
}

function readCappedBody(res, cap, { encoding = 'utf8' } = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks = [];
    let total = 0;
    res.on('data', (chunk) => {
      total += chunk.length;
      if (total > cap) {
        res.destroy();
        rejectPromise(new Error(`response exceeds ${cap} byte cap`));
        return;
      }
      chunks.push(chunk);
    });
    res.on('end', () => {
      const buf = Buffer.concat(chunks);
      resolvePromise(encoding === null ? buf : buf.toString(encoding));
    });
    res.on('error', rejectPromise);
  });
}

// SSRF 가드를 통과한 URL을 가져온다. 리다이렉트는 매 hop 재검증.
// encoding 'utf8'(기본)이면 문자열, null이면 Buffer 반환.
// requestImpl은 테스트 주입용 — 형태는 requestOnce와 동일.
// 보안 핵심 경로(사전검증·연결시점 가드·hop 재검증·캡)는 여기 한 곳뿐 —
// fetchSource/fetchBinary가 인코딩만 달리해 공유한다.
async function fetchGuarded(rawUrl, { requestImpl = requestOnce, lookupImpl = dnsLookup, encoding = 'utf8' } = {}) {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let url = await assertSafeUrl(rawUrl, { lookupImpl, signal });
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await requestImpl(url, { lookupImpl, signal });
    const status = res.statusCode;
    if (status >= 300 && status < 400) {
      const location = res.headers?.location;
      res.resume?.();
      if (!location) throw new Error(`redirect without location from ${url.href}`);
      url = await assertSafeUrl(new URL(location, url).href, { lookupImpl, signal });
      continue;
    }
    if (status < 200 || status >= 300) {
      res.resume?.();
      throw new Error(`fetch failed: ${status} ${res.statusMessage ?? ''}`.trim());
    }
    return readCappedBody(res, FETCH_MAX_BYTES, { encoding });
  }
  throw new Error(`too many redirects (max ${MAX_REDIRECTS})`);
}

// SSRF 가드를 통과한 URL을 텍스트로 가져온다.
export function fetchSource(rawUrl, opts = {}) {
  return fetchGuarded(rawUrl, { ...opts, encoding: 'utf8' });
}

// SSRF 가드를 통과한 URL을 바이너리(Buffer)로 가져온다. 가드는 fetchSource와 동일 경로 공유.
export function fetchBinary(rawUrl, opts = {}) {
  return fetchGuarded(rawUrl, { ...opts, encoding: null });
}
