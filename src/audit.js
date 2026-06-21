// Phase 5 결정론적 design-tell 감사기.
//
// LLM 자기 채점에 의존하지 않고 HTML/CSS를 직접 파싱해 design-tells의
// 기계 판정 가능한 부분집합을 검사한다. patina의 패턴 엔진과 같은 역할:
// 스킬(프롬프트)은 오케스트레이션, 숫자는 코드가 만든다.
//
// 여기서 다루는 텔: C1, T1, T2, T4, S5 + design-principles 계열 TY4, CO1, DE1, DE3.
// 나머지(L1~L4, S1~S4 등 의미 판단이 필요한 항목)는 SKILL.md Phase 5의
// LLM 체크리스트로 남는다. 감사기는 통과해도 LLM 감사를 대체하지 않는다.
// 시각 텔(L1/S3)은 src/geometry.js, 텍스트 유틸은 src/text.js 참조.
//
// 결과에는 findings 외에 warnings 채널이 있다 — craft 경고(직선 따옴표,
// "--", "..." 등)는 납품을 막지 않는다: pass/failed/exit code/benchmark 모두 무시.

import { stripTags } from './text.js';

const HYPE_LEXICON = [
  // ko — patina lexicon/ai-ko.md 계열
  '혁신적인', '완벽한', '강력한', '손쉽게', '경험하세요', '극대화', '새로운 패러다임', '최적화된',
  // en
  'seamless', 'effortless', 'revolutionary', 'game-changing', 'supercharge',
  'unleash', 'elevate your', 'transform your', 'innovative solution',
];

const HTML_SCAN_LIMIT = 2_000_000;
const TAG_BODY_LIMIT = 20_000;

// 태그 본문을 돌려준다. 닫는 태그가 없거나 같은 태그가 다시 열려도(HTML5 auto-close:
// 미닫힌 <li>/<h1>) null이 아니라 그 경계까지의 본문을 캡처한다 — 미닫힌 태그가
// 차단 텔 T1/T4를 false-negative로 통과시키던(게이트 우회) 구멍을 막는다.
// 본문은 TAG_BODY_LIMIT로 묶여 길이에 선형.
function boundedTagInner(source, lower, tag, bodyStart) {
  const searchEnd = Math.min(source.length, bodyStart + TAG_BODY_LIMIT);
  const closeTag = `</${tag}`;
  let pos = bodyStart;
  while (pos < searchEnd) {
    const next = lower.indexOf('<', pos);
    if (next < 0 || next >= searchEnd) return source.slice(bodyStart, searchEnd);
    if (lower.startsWith(closeTag, next)) return source.slice(bodyStart, next);
    if (lower.startsWith(`<${tag}`, next)) return source.slice(bodyStart, next);
    const tagEnd = lower.indexOf('>', next);
    if (tagEnd < 0 || tagEnd >= searchEnd) return source.slice(bodyStart, next);
    pos = tagEnd + 1;
  }
  return source.slice(bodyStart, searchEnd);
}

// 따옴표 인지 속성 토크나이저 — 한 HTML 태그에서 name 속성이 실제로 존재하는지 본다.
// 속성명만 순회하고 값(따옴표/unquoted)은 건너뛰므로 data-alt·myalt(접두/접미), title="alt=foo"
// (따옴표 값 내부), src=x/width=800(unquoted 값 내부 슬래시) 같은 스머글링을 모두 배제한다.
// IM2(alt)와 DE3(width/height) 공유.
function hasAttr(tag, name) {
  const s = String(tag);
  const want = name.toLowerCase();
  const nameMatch = /^<\s*[a-zA-Z][^\s/>]*/.exec(s);
  let i = nameMatch ? nameMatch[0].length : 1;
  while (i < s.length) {
    const c = s[i];
    if (c === '>') break;
    if (c === '/' || /\s/.test(c)) { i++; continue; }
    let j = i;
    while (j < s.length && !/[\s/=>]/.test(s[j])) j++;
    const attr = s.slice(i, j).toLowerCase();
    let k = j;
    while (k < s.length && /\s/.test(s[k])) k++;
    if (s[k] === '=') {
      k++;
      while (k < s.length && /\s/.test(s[k])) k++;
      if (s[k] === '"' || s[k] === "'") {
        const q = s[k];
        k++;
        while (k < s.length && s[k] !== q) k++;
        if (k < s.length) k++;
      } else {
        while (k < s.length && !/[\s>]/.test(s[k])) k++;
      }
    }
    if (attr === want) return true;
    i = k > i ? k : i + 1;
  }
  return false;
}

// ── ST1 구조 바닥선 헬퍼 (#35) ───────────────────────────────────────────────
// 빈/본문 없는/무의미 본문 문서를 차단한다. 본문 탐색은 주석·raw 블록(script/style/
// template/noscript)·따옴표 속성값 안의 <body> 토큰을 건너뛴다(스머글링 방어).
const ST1_RAW = ['script', 'style', 'template', 'noscript'];
// 본문 의미성 판정에서 제거할 비가시 블록 — noscript는 제외한다(no-JS 폴백 콘텐츠는
// 의미 있는 본문으로 인정해 실제 폴백 페이지를 오탐하지 않는다).
const ST1_CONTENT_RAW = ['script', 'style', 'template'];

// raw 텍스트 블록의 실제 닫는 태그 인덱스(`</tag` 위치). </tag 뒤에 경계(\s,>,/)가 와야
// 진짜 닫음으로 인정 — </scripture>·</stylex> 같은 접두 위장 닫음은 거부한다.
function rawCloseIndex(lower, tag, from) {
  const needle = `</${tag}`;
  let at = from;
  for (;;) {
    const idx = lower.indexOf(needle, at);
    if (idx < 0) return -1;
    const after = lower[idx + needle.length] ?? '>';
    if (after === '>' || after === '/' || /\s/.test(after)) return idx;
    at = idx + needle.length;
  }
}

// '<'(lt 위치)에서 시작하는 태그의 닫는 '>'를 따옴표 속성값을 존중하며 찾는다.
function endOfTag(src, lt) {
  let quote = null;
  for (let i = lt + 1; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === '>') return i;
  }
  return -1;
}

// 실제 <body> 시작 태그의 본문 시작 인덱스를 반환(없으면 -1). 주석·raw 블록을 건너뛰고,
// 다른 태그는 따옴표 값을 존중해 통째로 소비하므로 속성값 안의 "<body>"는 본문이 아니다.
function findRealBodyStart(src) {
  const lower = src.toLowerCase();
  const n = src.length;
  let i = 0;
  while (i < n) {
    const lt = lower.indexOf('<', i);
    if (lt < 0) return -1;
    if (lower.startsWith('<!--', lt)) {
      const end = lower.indexOf('-->', lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    let raw = null;
    for (const t of ST1_RAW) {
      if (lower.startsWith(`<${t}`, lt) && /[\s/>]/.test(src[lt + 1 + t.length] ?? '>')) { raw = t; break; }
    }
    if (raw) {
      const openEnd = endOfTag(src, lt);
      if (openEnd < 0) { i = n; continue; }
      // 닫음 검색은 여는 raw 태그의 따옴표 경계 '이후'부터 — 여는 태그 속성값 안의
      // </script>·<body> 가 조기 닫음/가짜 본문으로 새지 않게 한다.
      const close = rawCloseIndex(lower, raw, openEnd + 1);
      if (close < 0) { i = n; continue; }
      // 닫는 태그도 따옴표 인지로 통째 소비한다 — </script foo="<body>"> 같은 위조 끝태그
      // 속성 안의 <body>/'>' 가 본문으로 새지 않도록 endOfTag로 진짜 '>'까지 건너뛴다.
      const closeEnd = endOfTag(src, close);
      i = closeEnd < 0 ? n : closeEnd + 1;
      continue;
    }
    if (lower.startsWith('<body', lt) && /[\s/>]/.test(src[lt + 5] ?? '>')) {
      const gt = endOfTag(src, lt);
      return gt < 0 ? -1 : gt + 1;
    }
    const gt = endOfTag(src, lt);
    if (gt < 0) return -1;
    i = gt + 1;
  }
  return -1;
}

function stripComments(s) {
  return s.replace(/<!--[\s\S]*?(?:-->|$)/g, ' ');
}

function hasContentBearingMedia(s) {
  if (/<img\b[^>]*\ssrc\s*=/i.test(s)) return true;
  if (/<(?:picture|video|audio|iframe|object|embed)\b/i.test(s)) return true;
  for (const t of ['svg', 'canvas']) {
    const m = new RegExp(`<${t}\\b[^>]*>([\\s\\S]*?)<\\/${t}\\s*>`, 'i').exec(s);
    if (m && stripComments(m[1]).trim()) return true;
  }
  return false;
}

function hasLabeledInteractive(s) {
  if (/<input\b[^>]*\svalue\s*=\s*("[^"]+"|'[^']+'|[^\s>]+)/i.test(s)) return true;
  if (/\saria-label\s*=\s*("[^"]+"|'[^']+'|[^\s>]+)/i.test(s)) return true;
  return false;
}

// ST1: 납품 구조 바닥선(blocking). 빈 문서·실제 <body> 없음·무의미 본문은 납품 불가.
// 의미 콘텐츠 = stripTags 비공백 텍스트 OR 콘텐츠 보유 미디어 OR 라벨 있는 인터랙티브.
function checkStructuralFloor(html) {
  const src = String(html);
  if (src.trim() === '') return { pass: false, evidence: 'empty document — 0 meaningful bytes' };
  const bodyStart = findRealBodyStart(src);
  if (bodyStart < 0) return { pass: false, evidence: 'no real <body> element' };
  let inner = src.slice(bodyStart);
  const close = inner.toLowerCase().indexOf('</body');
  if (close >= 0) inner = inner.slice(0, close);
  const cleaned = stripComments(removeRawBlocks(inner, ST1_CONTENT_RAW));
  if (stripTags(cleaned).trim()) return { pass: true };
  if (hasContentBearingMedia(cleaned) || hasLabeledInteractive(cleaned)) return { pass: true };
  return { pass: false, evidence: 'body has no meaningful content (no text/media/interactive)' };
}

// flat CSS 규칙(sel{body}, 중첩 @media는 안으로 평탄화) 추출 — 단일 전방 스캔이라
// 입력 길이에 선형. 기존 /([^{}@]+)\{([^{}]*)\}/g 정규식은 중괄호 없는 본문에서
// 모든 시작 위치를 백트래킹해 O(n²)였다(400KB <style>에서 audit 행).
function splitFlatRules(css) {
  const rules = [];
  const n = css.length;
  let i = 0;
  let selStart = 0;
  while (i < n) {
    const c = css[i];
    if (c === '{') {
      const sel = css.slice(selStart, i).trim();
      let k = i + 1;
      while (k < n && css[k] !== '{' && css[k] !== '}') k += 1;
      if (k < n && css[k] === '}' && sel && !sel.includes('@')) {
        rules.push({ selector: sel, body: css.slice(i + 1, k) });
        i = k + 1;
      } else {
        i += 1; // 중첩 컨테이너({)나 미완 — 셀렉터로 쓰지 않고 안으로 진입
      }
      selStart = i;
    } else if (c === '}' || c === '@') {
      i += 1;
      selStart = i;
    } else {
      i += 1;
    }
  }
  return rules;
}

// 주어진 태그들의 블록(여는 태그~닫는 태그, 내용 포함)을 제거하고 나머지는 보존한다.
// 단일 전방 스캔이라 선형 — 미닫힌 <code>/<pre> 등에서 lazy 정규식+역참조가 O(n²)로
// 행 걸리던 것을 막는다. 닫는 태그가 없으면 그 raw 블록은 EOF까지로 간주해 제거.
// 결과는 배열+join으로 만든 평탄 문자열이다 — `+=` ConsString을 stripTags에 먹이면
// stripTags가 flat/cons 다형으로 디옵트돼 대형 입력에서 ~1500x 느려진다(메가모픽).
function removeRawBlocks(value, tags) {
  const lower = value.toLowerCase();
  const parts = [];
  let cursor = 0;
  while (cursor < value.length) {
    const lt = lower.indexOf('<', cursor);
    if (lt < 0) { parts.push(value.slice(cursor)); break; }
    let tag = null;
    for (const t of tags) {
      if (lower.startsWith(`<${t}`, lt) && /[\s>/]/.test(lower[lt + t.length + 1] ?? '')) { tag = t; break; }
    }
    if (!tag) { parts.push(value.slice(cursor, lt + 1)); cursor = lt + 1; continue; }
    parts.push(value.slice(cursor, lt), ' ');
    const openEnd = endOfTag(value, lt); // 여는 태그도 따옴표 인지(속성 안 '>' 무시)
    if (openEnd < 0) break;
    const closeAt = rawCloseIndex(lower, tag, openEnd + 1);
    if (closeAt < 0) break; // 미닫힘 → EOF까지 raw 블록으로 제거
    const closeEnd = endOfTag(value, closeAt); // 따옴표 인지 끝태그 소비(끝태그 속성 안 '>' 무시)
    if (closeEnd < 0) break;
    cursor = closeEnd + 1;
  }
  return parts.join('');
}

function extractCss(html) {
  const blocks = [...String(html).matchAll(/<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi)].map((m) => m[1]);
  const attrs = [...String(html).matchAll(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)].map((m) => m[2] ?? m[3]);
  return [...blocks, ...attrs].join('\n');
}

function hexToHsl(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  let hue;
  if (max === r) hue = ((g - b) / d) % 6;
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return { h: hue, s, l };
}

// C1: 보라/남보라 계열 stop을 포함한 그라데이션 배경.
function checkPurpleGradient(css) {
  const gradients = css.match(/linear-gradient\([^)]*\)/gi) ?? [];
  for (const g of gradients) {
    for (const [hex] of g.matchAll(/#[0-9a-f]{3,6}\b/gi)) {
      const { h, s } = hexToHsl(hex);
      if (h >= 230 && h <= 300 && s >= 0.25) return { pass: false, evidence: g.slice(0, 80) };
    }
  }
  return { pass: true };
}

// T1: 리스트 항목 또는 버튼/제목 텍스트가 픽토그램으로 시작하거나 끝남.
function checkEmojiBullets(html) {
  const source = String(html).slice(0, HTML_SCAN_LIMIT);
  const lower = source.toLowerCase();
  const opens = source.matchAll(/<(li|button|h([1-6]))\b[^>]*>/gi);
  for (const m of opens) {
    const tag = m[1].toLowerCase();
    const bodyStart = m.index + m[0].length;
    const inner = boundedTagInner(source, lower, tag, bodyStart);
    if (inner === null) continue;
    const text = stripTags(inner).trim();
    // ASCII 빠른 경로: 경계 문자가 ASCII면 픽토그램일 수 없다 → unicode 속성 정규식을
    // 건너뛴다. \p{Extended_Pictographic} 정규식을 수만 번 돌리면 후속 문자열 연산이
    // V8에서 ~1500x 느려지는 디옵트 병리가 있어, 대량 요소 페이지에서 audit이 행 걸렸다.
    if ((text.charCodeAt(0) >= 0x80 && /^\p{Extended_Pictographic}/u.test(text))
      || (text.charCodeAt(text.length - 1) >= 0x80 && /\p{Extended_Pictographic}$/u.test(text))) {
      return { pass: false, evidence: `<${tag}> "${text.slice(0, 40)}"` };
    }
  }
  return { pass: true };
}

// T2: 하이프 어휘. 본문 텍스트만 검사한다 (속성/CSS 제외).
function checkHypeAdjectives(html) {
  const text = stripTags(html).toLowerCase();
  const hits = HYPE_LEXICON.filter((w) => text.includes(w.toLowerCase()));
  return hits.length ? { pass: false, evidence: hits.slice(0, 5).join(', ') } : { pass: true };
}

// T4: "Simple. Powerful. Seamless." — 제목의 3연속 단문 패턴.
function checkSymmetricHeadingPairs(html) {
  const source = String(html).slice(0, HTML_SCAN_LIMIT);
  const lower = source.toLowerCase();
  const opens = source.matchAll(/<h([1-6])\b[^>]*>/gi);
  for (const m of opens) {
    const tag = `h${m[1]}`;
    const bodyStart = m.index + m[0].length;
    const inner = boundedTagInner(source, lower, tag, bodyStart);
    if (inner === null) continue;
    const text = stripTags(inner).trim();
    const segs = text.split(/[.!]\s*/).filter(Boolean);
    if (segs.length >= 3 && segs.every((s) => s.trim().split(/\s+/).length <= 2)) {
      return { pass: false, evidence: `"${text.slice(0, 60)}"` };
    }
  }
  return { pass: true };
}

// S5: border-radius 선언이 3개 이상인데 0이 아닌 값이 전부 동일.
function checkUniformRadius(css) {
  const values = [...css.matchAll(/border-radius\s*:\s*([^;}"']+)/gi)]
    .map((m) => m[1].trim())
    .filter((v) => !/^0(px|rem|em)?$/.test(v));
  if (values.length >= 3 && new Set(values).size === 1) {
    return { pass: false, evidence: `${values.length}× border-radius: ${values[0]}` };
  }
  return { pass: true };
}

// ---------------------------------------------------------------------------
// 공용 CSS 규칙 파서 — TY4/CO1/DE1/DE3가 셀렉터 문맥이 필요해서 extractCss(평면
// 문자열)와 별도로 둔다. 기존 체크(C1/S5)는 extractCss를 그대로 쓴다.
// ---------------------------------------------------------------------------

// <style> 블록을 {selector, body} 규칙으로 평탄화한다. 정규식이 중괄호 한 겹만
// 매칭하므로 @media/@supports 헤더는 버려지고 안쪽 규칙이 자기 셀렉터로 잡힌다.
// @font-face류는 통째로 제거 — 안의 font-family는 폰트 정의지 사용이 아니다.
// style 속성은 해당 태그명을 셀렉터로 취급한다 (code/pre 문맥 판단에 필요).
function extractCssRules(html) {
  const rules = [];
  for (const [, css] of String(html).matchAll(/<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi)) {
    const clean = css
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/@(font-face|page|property|counter-style)[^{}]*\{[^{}]*\}/gi, ' ');
    for (const { selector, body } of splitFlatRules(clean)) {
      rules.push({ selector, body });
    }
  }
  for (const m of String(html).matchAll(/<([a-z][a-z0-9-]*)\b[^>]*?\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
    rules.push({ selector: m[1].toLowerCase(), body: m[3] ?? m[4] ?? '' });
  }
  return rules;
}

// @media/@supports 중첩을 보존하는 CSS 스캐너. extractCssRules(평탄)는 건드리지
// 않는다(TY4/CO1/DE1/DE3 소비). 각 규칙이 @media (prefers-reduced-motion:
// no-preference) 가드 안인지(guarded)를 함께 돌려준다. @keyframes/@font-face류
// 블록은 내려가지 않는다 — from/to·폰트 정의는 규칙이 아니다.
function extractRuleContexts(html) {
  const out = [];
  for (const [, css] of String(html).matchAll(/<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi)) {
    walkCss(css.replace(/\/\*[\s\S]*?\*\//g, ' '), false, out);
  }
  return out;
}

function walkCss(css, guarded, out, depth = 0) {
  if (depth > 40) return; // 깊게 중첩된 @media/@supports로 인한 스택오버플로/CPU 폭주 방지
  const n = css.length;
  let i = 0;
  while (i < n) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const prelude = css.slice(i, open).trim();
    let braceDepth = 1; // 중괄호 매칭 카운터 — 재귀 깊이 파라미터 depth를 가리면 안 된다(가드 무력화 버그)
    let j = open + 1;
    while (j < n && braceDepth > 0) {
      const c = css[j];
      if (c === '{') braceDepth += 1;
      else if (c === '}') braceDepth -= 1;
      j += 1;
    }
    const block = css.slice(open + 1, j - 1);
    i = j;
    if (!prelude) continue;
    if (prelude.startsWith('@')) {
      const at = prelude.slice(1).split(/[\s({]/)[0].toLowerCase();
      if (['keyframes', '-webkit-keyframes', '-moz-keyframes', 'font-face', 'page', 'property', 'counter-style'].includes(at)) continue;
      const childGuarded = guarded || (/^@media\b/i.test(prelude) && /prefers-reduced-motion\s*:\s*no-preference/i.test(prelude));
      walkCss(block, childGuarded, out, depth + 1);
    } else {
      out.push({ selector: prelude, body: block, guarded });
    }
  }
}

// 0이 아닌 시간값(.18s, 200ms)이 하나라도 있으면 true. 0s/0ms만이면 false.
function hasNonZeroTime(value) {
  const times = String(value).match(/(-?\d*\.?\d+)\s*(?:ms|s)\b/gi);
  return times ? times.some((t) => parseFloat(t) > 0) : false;
}

// b1 (MO2/DE3 교차) — reduced-motion 미가드 모션. transition(0 아님)·animation
// (none 아님)이 @media (prefers-reduced-motion: no-preference) 밖에 선언되면 WARN.
// 중첩 보존 스캐너로 판정하므로 exp(전 모션 가드)는 WARN0. WARN 전용 —
// findings/failed/slopScore/baseline 무영향. 빈 가드 블록 우회 불가(모션 위치로 판정).
function checkReducedMotionGuard(html) {
  for (const r of extractRuleContexts(html)) {
    if (r.guarded) continue;
    for (const d of parseDeclarations(r.body)) {
      if ((d.prop === 'transition' || d.prop === 'transition-duration') && hasNonZeroTime(d.value)) {
        return { selector: r.selector, prop: d.prop, value: d.value };
      }
      if (d.prop === 'animation' && !/^\s*none\s*$/i.test(d.value) && hasNonZeroTime(d.value)) {
        return { selector: r.selector, prop: d.prop, value: d.value };
      }
      if (d.prop === 'animation-name' && d.value.trim() && !/^\s*none\s*$/i.test(d.value)) {
        return { selector: r.selector, prop: d.prop, value: d.value };
      }
    }
  }
  return null;
}

function parseDeclarations(body) {
  return String(body).split(';').map((d) => {
    const i = d.indexOf(':');
    if (i < 0) return null;
    return {
      prop: d.slice(0, i).trim().toLowerCase(),
      value: d.slice(i + 1).replace(/!important\s*$/i, '').trim(),
    };
  }).filter((d) => d && d.prop && d.value);
}

function isRootSelector(selector) {
  return selector.split(',').some((p) => p.trim() === ':root');
}

// :root 커스텀 프로퍼티 표 — DE1/TY4의 var() 간접 참조 해석용.
function rootVarMap(rules) {
  const map = new Map();
  for (const r of rules) {
    if (!isRootSelector(r.selector)) continue;
    for (const d of parseDeclarations(r.body)) if (d.prop.startsWith('--')) map.set(d.prop, d.value);
  }
  return map;
}

// var(--x[, fallback])를 :root 정의로 치환. 토큰 체인을 따라 최대 8단계.
// fallback 안에 괄호가 있으면 해석하지 않는다 — 한정된 미해석은 해당 선언 skip으로 흡수.
function resolveVars(value, vars) {
  let v = String(value);
  for (let i = 0; i < 8 && /var\(/i.test(v); i++) {
    const next = v.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/gi,
      (_, name, fb) => vars.get(name) ?? (fb ?? '').trim());
    if (next === v) break;
    v = next;
  }
  return v;
}

// ---------------------------------------------------------------------------
// 색 해석 유틸 — CO1(예산)과 DE1(그림자 물리)이 공유한다.
// ---------------------------------------------------------------------------

// CSS 표준 named color → hex. transparent/currentColor/inherit 등은 의도적으로
// 없다 — CO1 예산에서 제외되는 키워드들이다.
const CSS_NAMED_COLORS = {
  aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4', azure: '#f0ffff',
  beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000', blanchedalmond: '#ffebcd', blue: '#0000ff',
  blueviolet: '#8a2be2', brown: '#a52a2a', burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00',
  chocolate: '#d2691e', coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
  cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b', darkgray: '#a9a9a9',
  darkgreen: '#006400', darkgrey: '#a9a9a9', darkkhaki: '#bdb76b', darkmagenta: '#8b008b', darkolivegreen: '#556b2f',
  darkorange: '#ff8c00', darkorchid: '#9932cc', darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b', darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f', darkturquoise: '#00ced1',
  darkviolet: '#9400d3', deeppink: '#ff1493', deepskyblue: '#00bfff', dimgray: '#696969', dimgrey: '#696969',
  dodgerblue: '#1e90ff', firebrick: '#b22222', floralwhite: '#fffaf0', forestgreen: '#228b22', fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc', ghostwhite: '#f8f8ff', gold: '#ffd700', goldenrod: '#daa520', gray: '#808080',
  green: '#008000', greenyellow: '#adff2f', grey: '#808080', honeydew: '#f0fff0', hotpink: '#ff69b4',
  indianred: '#cd5c5c', indigo: '#4b0082', ivory: '#fffff0', khaki: '#f0e68c', lavender: '#e6e6fa',
  lavenderblush: '#fff0f5', lawngreen: '#7cfc00', lemonchiffon: '#fffacd', lightblue: '#add8e6',
  lightcoral: '#f08080', lightcyan: '#e0ffff', lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3',
  lightgreen: '#90ee90', lightgrey: '#d3d3d3', lightpink: '#ffb6c1', lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899', lightslategrey: '#778899',
  lightsteelblue: '#b0c4de', lightyellow: '#ffffe0', lime: '#00ff00', limegreen: '#32cd32', linen: '#faf0e6',
  magenta: '#ff00ff', maroon: '#800000', mediumaquamarine: '#66cdaa', mediumblue: '#0000cd',
  mediumorchid: '#ba55d3', mediumpurple: '#9370db', mediumseagreen: '#3cb371', mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc', mediumvioletred: '#c71585', midnightblue: '#191970',
  mintcream: '#f5fffa', mistyrose: '#ffe4e1', moccasin: '#ffe4b5', navajowhite: '#ffdead', navy: '#000080',
  oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23', orange: '#ffa500', orangered: '#ff4500',
  orchid: '#da70d6', palegoldenrod: '#eee8aa', palegreen: '#98fb98', paleturquoise: '#afeeee',
  palevioletred: '#db7093', papayawhip: '#ffefd5', peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb',
  plum: '#dda0dd', powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399', red: '#ff0000',
  rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513', salmon: '#fa8072', sandybrown: '#f4a460',
  seagreen: '#2e8b57', seashell: '#fff5ee', sienna: '#a0522d', silver: '#c0c0c0', skyblue: '#87ceeb',
  slateblue: '#6a5acd', slategray: '#708090', slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f',
  steelblue: '#4682b4', tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8', tomato: '#ff6347',
  turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3', white: '#ffffff', whitesmoke: '#f5f5f5',
  yellow: '#ffff00', yellowgreen: '#9acd32',
};

const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)));

function hslToRgbTuple(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [clamp255((r + m) * 255), clamp255((g + m) * 255), clamp255((b + m) * 255)];
}

function parseAlpha(s) {
  const v = String(s).trim();
  const n = v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

// 색 토큰 하나를 {r,g,b,a}로 해석한다. 해석 불가(var, currentColor 등)는 null.
// 알파는 rgba()/hsla(), 슬래시 문법 rgb(x x x / a), 4/8자리 hex 모두에서 읽는다.
function parseColor(token) {
  const t = String(token).trim().toLowerCase();
  const hex = t.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  if (CSS_NAMED_COLORS[t]) return parseColor(CSS_NAMED_COLORS[t]);
  const fn = t.match(/^(rgba?|hsla?)\(([^()]*)\)$/);
  if (!fn) return null;
  const [chans, slashAlpha] = fn[2].split('/');
  const nums = chans.split(/[\s,]+/).filter(Boolean);
  let a = 1;
  if (slashAlpha !== undefined) a = parseAlpha(slashAlpha);
  else if (nums.length === 4) a = parseAlpha(nums.pop());
  if (a === null || nums.length !== 3) return null;
  if (fn[1].startsWith('rgb')) {
    const [r, g, b] = nums.map((n) => clamp255(n.endsWith('%') ? parseFloat(n) * 2.55 : parseFloat(n)));
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b, a };
  }
  const h = parseFloat(nums[0]);
  const s = nums[1].endsWith('%') ? parseFloat(nums[1]) / 100 : parseFloat(nums[1]);
  const l = nums[2].endsWith('%') ? parseFloat(nums[2]) / 100 : parseFloat(nums[2]);
  if ([h, s, l].some(Number.isNaN)) return null;
  const [r, g, b] = hslToRgbTuple(h, s, l);
  return { r, g, b, a };
}

// resolved 값의 정규형 — 표기가 달라도(#fff vs #ffffff vs white) 같은 키가 된다.
function colorKey({ r, g, b, a }) {
  const hex2 = (n) => n.toString(16).padStart(2, '0');
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 1 ? hex2(clamp255(a * 255)) : ''}`;
}

// ---------------------------------------------------------------------------
// TY4: type-family-discipline
// ---------------------------------------------------------------------------

const GENERIC_FAMILIES = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong',
]);
const CSS_WIDE_KEYWORDS = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

// 셀렉터 전체가 code 문맥(code/pre/kbd/samp)인가 — 콤마 그룹 모두가 해당해야 true.
function isCodeContext(selector) {
  return selector.split(',').every((p) => /\b(code|pre|kbd|samp)\b/i.test(p));
}

function isMonoStack(families) {
  return families.some((f) =>
    f === 'monospace' || f === 'ui-monospace' || /\bmono\b|courier|consolas|menlo|monaco/.test(f));
}

// font-family 전용 선언과 font: 축약형 둘 다에서 family 리스트를 모은다.
// 축약형은 size(/line-height) 토큰 뒤 전부가 family 리스트다 —
// `font: 16px/1.5 Georgia, serif`를 font-family 정규식만으로는 놓친다.
function collectFontDeclarations(rules, vars) {
  const decls = [];
  const SIZE = /(?:^|\s)(?:[\d.]+(?:px|pt|pc|em|rem|%|vw|vh|ch|ex|in|cm|mm|q)|xx?-(?:small|large)|small|medium|large|larger|smaller)(?:\s*\/\s*[\w.%]+)?\s+([^;}]+)$/i;
  for (const { selector, body } of rules) {
    for (const { prop, value } of parseDeclarations(body)) {
      const v = resolveVars(value, vars);
      let list = null;
      if (prop === 'font-family') list = v;
      else if (prop === 'font') list = v.match(SIZE)?.[1] ?? null; // size 없으면 caption 등 시스템 키워드 — skip
      if (!list) continue;
      const families = list.split(',')
        .map((f) => f.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').toLowerCase())
        .filter(Boolean);
      if (!families.length) continue;
      if (families.length === 1 && CSS_WIDE_KEYWORDS.has(families[0])) continue; // font-family:inherit 등은 사용이 아니다
      if (families.some((f) => f.includes('var('))) continue; // 미해석 var()는 판정 불가 — skip
      decls.push({ selector, families });
    }
  }
  return decls;
}

function checkTypeFamilyDiscipline(rules, vars) {
  const decls = collectFontDeclarations(rules, vars);
  // (a) 첫 자리 family 종수 > 2 — code 문맥 전용 mono 스택은 카운트에서 제외
  const firsts = new Set();
  for (const { selector, families } of decls) {
    if (isMonoStack(families) && isCodeContext(selector)) continue;
    firsts.add(families[0]);
  }
  if (firsts.size > 2) {
    return { pass: false, evidence: `${firsts.size} families: ${[...firsts].slice(0, 4).join(', ').slice(0, 60)}` };
  }
  // (b) generic fallback으로 끝나지 않는 스택 — 단독 system-ui/ui-monospace만 면제
  for (const { families } of decls) {
    const last = families[families.length - 1];
    if (GENERIC_FAMILIES.has(last)) continue;
    if (families.length === 1 && (last === 'system-ui' || last === 'ui-monospace')) continue;
    return { pass: false, evidence: `no generic fallback: "${families.join(', ').slice(0, 50)}"` };
  }
  // (c) code 밖 mono가 둘 이상의 셀렉터 역할에 등장
  const monoRoles = new Set();
  for (const { selector, families } of decls) {
    if (isMonoStack(families) && !isCodeContext(selector)) monoRoles.add(selector);
  }
  if (monoRoles.size > 1) {
    return { pass: false, evidence: `mono outside code on ${monoRoles.size} roles: ${[...monoRoles].slice(0, 3).join(' / ').slice(0, 50)}` };
  }
  return { pass: true };
}

// ---------------------------------------------------------------------------
// CO1: color-literal-budget — arm (a)만. (b) hue 클러스터링은 기각됨.
// ---------------------------------------------------------------------------

// 예산은 :root 토큰 시트 밖에 흩어진 "고유 resolved 색" 12개, 페이지 전역.
// 같은 리터럴이 두 번 나와도 1로 센다 — 흩어진 횟수가 아니라 토큰화를 거치지 않은
// 팔레트 크기가 텔이다 (#fff와 #ffffff와 white는 같은 1색). var(--x) 참조와
// :root 안의 정의는 세지 않는다. transparent/currentColor/inherit류도 제외.
// 알려진 한계(의도된 수용): extractCssRules는 <style>/style 속성만 읽으므로 SVG
// presentation attribute(fill=, stroke=)의 색은 안 잡힌다 —
// tests/redteam/svg-attr-color-smuggle.html이 이 미스를 고정한다.
function checkColorLiteralBudget(rules) {
  const seen = new Set();
  const sample = [];
  const add = (c) => {
    if (!c) return;
    const k = colorKey(c);
    if (seen.has(k)) return;
    seen.add(k);
    if (sample.length < 4) sample.push(k);
  };
  const FN = /\b(?:rgba?|hsla?)\([^()]*\)/gi;
  const HEX = /#[0-9a-f]{3,8}\b/gi;
  for (const { selector, body } of rules) {
    if (isRootSelector(selector)) continue; // 토큰 시트는 예산 밖
    for (const { prop, value } of parseDeclarations(body)) {
      if (prop === 'font' || prop === 'font-family') continue; // 폰트명 안의 red/tan 오탐 방지
      let v = value
        .replace(/(["'])(?:(?!\1).)*\1/g, ' ') // 문자열 리터럴(content 등) 제거
        .replace(/\burl\([^)]*\)/gi, ' ')
        .replace(/var\([^()]*\)/gi, ' '); // var(--x) 참조는 리터럴이 아니다 — --reddish 부분 일치도 차단
      for (const [fnTok] of v.matchAll(FN)) add(parseColor(fnTok));
      v = v.replace(FN, ' ');
      for (const [hexTok] of v.matchAll(HEX)) add(parseColor(hexTok));
      v = v.replace(HEX, ' ');
      // named color는 토큰 단위 완전 일치만 — 부분 문자열("reddish") 금지
      for (const tok of v.toLowerCase().split(/[^a-z]+/)) {
        if (CSS_NAMED_COLORS[tok]) add(parseColor(CSS_NAMED_COLORS[tok]));
      }
    }
  }
  if (seen.size > 12) {
    return { pass: false, evidence: `${seen.size} loose literals > 12 (e.g. ${sample.join(', ')})` };
  }
  return { pass: true };
}

// ---------------------------------------------------------------------------
// DE1: shadow-physics-budget
// ---------------------------------------------------------------------------

// 최상위 콤마 분할 — rgba(0,0,0,.1) 안의 콤마에서 자르면 안 된다.
function splitTopLevel(value) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(value)) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// box-shadow 조각 하나 → {inset, x, y, blur, spread, color, raw}. 파싱 불가는 null.
function parseShadowSegment(segment) {
  let s = ` ${segment} `;
  const inset = /\binset\b/i.test(s);
  s = s.replace(/\binset\b/gi, ' ');
  let color = null;
  const colorTok = s.match(/(?:rgba?|hsla?)\([^()]*\)|#[0-9a-f]{3,8}\b/i);
  if (colorTok) {
    color = parseColor(colorTok[0]);
    s = s.replace(colorTok[0], ' ');
  } else {
    for (const tok of s.toLowerCase().split(/\s+/).filter(Boolean)) {
      if (CSS_NAMED_COLORS[tok]) {
        color = parseColor(tok);
        s = s.replace(new RegExp(`\\b${tok}\\b`, 'i'), ' ');
        break;
      }
    }
    s = s.replace(/\bcurrentcolor\b/gi, ' '); // 색 미상으로 두고 길이만 판정
  }
  const lengths = s.trim().split(/\s+/).filter(Boolean);
  if (lengths.length < 2 || lengths.length > 4) return null;
  if (lengths.some((t) => !/^-?[\d.]+[a-z%]*$/i.test(t))) return null;
  const [x, y, blur = '0', spread = '0'] = lengths;
  const nums = [x, y, blur, spread].map(parseFloat);
  if (nums.some(Number.isNaN)) return null;
  return { inset, x: nums[0], y: nums[1], blur: nums[2], spread: nums[3], color, raw: segment.trim() };
}

function checkShadowPhysics(rules, vars) {
  // resolved 시그니처로 dedupe — 같은 그림자가 미디어쿼리마다 반복돼도 1개다.
  const signatures = new Map();
  for (const { selector, body } of rules) {
    // :focus류 룰의 box-shadow는 포커스 링(상호작용 어포던스)이지 고도 표면이
    // 아니다 — DE3가 outline 대체로 box-shadow를 권장하므로, 여기서 같이 세면
    // 합법 포커스 링 + 브루탈리스트 그림자 1종이 (c)에 걸리는 자가당착이 난다.
    if (/:focus(-visible|-within)?(?![\w-])/.test(selector)) continue;
    for (const { prop, value } of parseDeclarations(body)) {
      if (prop !== 'box-shadow') continue;
      const resolved = resolveVars(value, vars);
      if (/^\s*none\s*$/i.test(resolved)) continue;
      for (const seg of splitTopLevel(resolved)) {
        const sh = parseShadowSegment(seg);
        if (!sh) continue;
        const key = [sh.inset ? 'inset' : '', sh.x, sh.y, sh.blur, sh.spread,
          sh.color ? colorKey(sh.color) : 'currentcolor'].join('|');
        if (!signatures.has(key)) signatures.set(key, sh);
      }
    }
  }
  const outer = [...signatures.values()].filter((sh) => !sh.inset);
  // (a) non-inset 시그니처 종수 > 3
  if (outer.length > 3) {
    return { pass: false, evidence: `${outer.length} distinct drop shadows > 3` };
  }
  // (b) blur > 0 그림자의 물리 위반 — 빛은 위에서 오고, 그림자는 옅고 무채색이다.
  //     blur 0 하드 오프셋은 (c)에서만 본다 — 공인된 브루탈리즘 예외.
  for (const sh of outer) {
    if (sh.blur <= 0) continue;
    if (sh.y < 0) return { pass: false, evidence: `"${sh.raw.slice(0, 45)}" — y-offset ${sh.y} < 0` };
    if (!sh.color) continue; // currentColor 등 미해석 색은 알파/채도 판정 불가
    if (sh.color.a > 0.3) {
      return { pass: false, evidence: `"${sh.raw.slice(0, 45)}" — alpha ${+sh.color.a.toFixed(2)} > 0.3` };
    }
    const chSpread = Math.max(sh.color.r, sh.color.g, sh.color.b) - Math.min(sh.color.r, sh.color.g, sh.color.b);
    if (chSpread > 30) {
      return { pass: false, evidence: `"${sh.raw.slice(0, 45)}" — non-neutral (channel spread ${chSpread})` };
    }
  }
  // (c) 하드 오프셋(blur 0)은 1종까지만
  const hard = outer.filter((sh) => sh.blur === 0);
  if (hard.length > 1) {
    return { pass: false, evidence: `${hard.length} hard-offset shadows (blur 0) > 1` };
  }
  return { pass: true };
}

// ---------------------------------------------------------------------------
// DE3: quality-floor — 4개 이진 arm. WARN 채널은 collectWarnings 참조.
// ---------------------------------------------------------------------------

const OUTLINE_KILL = /^(none|0)(px)?$/i;
const VISIBLE_REPLACEMENT = /^(box-shadow|border|background)/;

function checkQualityFloor(html, rules) {
  // (a) :focus류 룰이 outline을 죽이고 같은 룰에 대체 처리가 없다.
  //     관대 판정: 페이지 어디든 :focus-visible 룰이 가시 처리를 선언하면 면제 —
  //     셀렉터를 엄밀히 짝지으면 분리 셀렉터에서 FP가 난다. 관대함은 miss만 낳는다.
  const excused = rules.some((r) => r.selector.includes(':focus-visible')
    && parseDeclarations(r.body).some((d) =>
      (d.prop === 'outline' && !OUTLINE_KILL.test(d.value)) || VISIBLE_REPLACEMENT.test(d.prop)));
  if (!excused) {
    for (const r of rules) {
      if (!/:focus(-visible)?(?![\w-])/.test(r.selector)) continue;
      const decls = parseDeclarations(r.body);
      const kill = decls.find((d) => d.prop === 'outline' && OUTLINE_KILL.test(d.value));
      if (!kill) continue;
      const replaced = decls.some((d) => VISIBLE_REPLACEMENT.test(d.prop)
        || (d.prop.startsWith('outline') && d !== kill && !OUTLINE_KILL.test(d.value)));
      if (!replaced) {
        return { pass: false, evidence: `${r.selector.slice(0, 40)} { outline: ${kill.value} } — no replacement` };
      }
    }
  }
  // (b) transition: all — transition-property로든 축약형 안에서든
  for (const r of rules) {
    for (const d of parseDeclarations(r.body)) {
      if ((d.prop === 'transition' || d.prop === 'transition-property')
        && /(^|[\s,])all($|[\s,])/i.test(d.value)) {
        return { pass: false, evidence: `${d.prop}: ${d.value.slice(0, 40)}` };
      }
    }
  }
  // (c) 줌을 막는 viewport meta
  const vp = String(html).match(/<meta\b[^>]*name\s*=\s*["']?viewport["']?[^>]*>/i);
  if (vp && (/user-scalable\s*=\s*no/i.test(vp[0]) || /maximum-scale\s*=\s*1(\.0+)?(?![\d.])/i.test(vp[0]))) {
    const content = vp[0].match(/content\s*=\s*["']([^"']*)/i)?.[1] ?? 'viewport';
    return { pass: false, evidence: content.slice(0, 60) };
  }
  // (d) width/height 속성 없는 <img> — 레이아웃 시프트의 고전
  for (const [tag] of String(html).matchAll(/<img\b[^>]*>/gi)) {
    if (!hasAttr(tag, 'width') || !hasAttr(tag, 'height')) {
      return { pass: false, evidence: `${tag.slice(0, 55)} — missing width/height` };
    }
  }
  return { pass: true };
}

// IM2: <img>에 alt 속성이 아예 없다 — 접근성/슬롭 신호(advisory). 장식용 alt=""는 허용(존재로 충분),
// alt 텍스트 품질은 판단하지 않는다. data-alt·myalt·따옴표 값 내 alt= 스머글링은 hasAttr이 배제한다.
function checkImageAltAttribute(html) {
  for (const [tag] of String(html).matchAll(/<img\b[^>]*>/gi)) {
    if (!hasAttr(tag, 'alt')) {
      return { pass: false, evidence: `${tag.slice(0, 55)} — missing alt` };
    }
  }
  return { pass: true };
}

// craft 경고 수집 — 절대 fail로 승격하지 않는다. findings/failed/exit code와
// benchmark 모두 warnings를 무시한다. code/pre/kbd/samp 안의 텍스트는 면제.
function collectWarnings(html, rules, vars) {
  const warnings = [];
  const text = stripTags(removeRawBlocks(String(html), ['code', 'pre', 'kbd', 'samp']));
  const snippet = (i) => `"${text.slice(Math.max(0, i - 10), i + 14).replace(/\s+/g, ' ').trim()}"`;
  const quote = text.match(/[\p{L}\p{N}]["']|["'][\p{L}\p{N}]/u);
  if (quote) warnings.push({ name: 'straight-quotes', lane: 'static', evidence: snippet(quote.index) });
  const dash = text.search(/--/);
  if (dash >= 0) warnings.push({ name: 'double-hyphen', lane: 'static', evidence: snippet(dash) });
  const dots = text.search(/\.\.\./);
  if (dots >= 0) warnings.push({ name: 'ascii-ellipsis', lane: 'static', evidence: snippet(dots) });

  // TY5-B/C 한글 조판 정적 경고 (WARN, 보수적 — 한글 본문이 있을 때만).
  // regex CSS 파서는 selector→요소 매칭을 못 하므로 broad selector
  // (body/html/:root/*/p/h1-6/li)와 인라인 한글 요소로만 좁혀 잡음을 억제한다.
  if (/[가-힣]/.test(text)) {
    const KOREAN_FONT = /pretendard|apple sd gothic|noto (?:sans|serif) (?:kr|cjk)|malgun|nanum|gothic a1|spoqa|gowun|kopub|ibm plex sans kr|gmarket|sunflower|sandoll/i;
    const BROAD = new Set(['body', 'html', ':root', '*', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li']);
    const isBroad = (sel) => sel.split(',').some((s) => BROAD.has(s.trim().toLowerCase()));
    let bDone = false;
    let cDone = false;
    for (const r of (rules ?? [])) {
      if (bDone && cDone) break;
      if (!isBroad(r.selector)) continue;
      for (const d of parseDeclarations(r.body)) {
        if (!bDone && (d.prop === 'font-family' || d.prop === 'font')) {
          const stack = resolveVars(d.value, vars ?? new Map());
          if (!/var\(/i.test(stack) && !/^(?:inherit|initial|unset|revert|revert-layer)$/i.test(stack.trim()) && !KOREAN_FONT.test(stack)) {
            warnings.push({ name: 'hangul-no-korean-font', lane: 'static', evidence: `한글 본문에 명시적 한글 폰트 없음 — "${stack.slice(0, 48)}" (OS별 시스템 폴백 렌더 불일치)` });
            bDone = true;
          }
        }
        if (!cDone && d.prop === 'font-style' && /\b(?:italic|oblique)\b/i.test(d.value)) {
          warnings.push({ name: 'hangul-fake-italic', lane: 'static', evidence: `한글에 font-style:${d.value} (가짜 기울임) — 강조는 웨이트/잉크로` });
          cDone = true;
        }
      }
    }
    if (!cDone) {
      for (const m of String(html).matchAll(/<([a-z][a-z0-9-]*)\b[^>]*?\sstyle\s*=\s*("([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
        const style = m[3] ?? m[4] ?? '';
        const inner = stripTags(m[5] ?? '');
        if (/font-style\s*:\s*(?:italic|oblique)/i.test(style) && /[가-힣]/.test(inner)) {
          warnings.push({ name: 'hangul-fake-italic', lane: 'static', evidence: `인라인 한글 가짜 이탤릭: "${inner.slice(0, 30)}"` });
          break;
        }
      }
    }
  }

  // webfont ① 원격 CDN 폰트 의존 (정적 WARN) — 자가호스팅/인라인이면 무경고.
  // 알려진 폰트 CDN 호스트(link/@import/preconnect) 또는 @font-face의 원격 src.
  const FONT_HOST = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|p\.typekit\.net|use\.fontawesome\.com|fonts\.bunny\.net|fonts\.cdnfonts\.com/i;
  let webfontUrl = null;
  // 'font'는 경로 세그먼트(/font, /fonts.)로만 매칭해 과매칭(임의 'font' 부분문자열)을 줄인다.
 
  const hostHit = String(html).match(new RegExp(`https?://[^"')\\s]*(?:(?:${FONT_HOST.source})|/fonts?[/.])[^"')\\s]*`, 'i'));
  if (hostHit) webfontUrl = hostHit[0];
  if (!webfontUrl) {
    const ff = String(html).match(/@font-face\s*\{[^}]*\burl\(\s*['"]?\s*(https?:\/\/[^'")\s]+)/i);
    if (ff) webfontUrl = ff[1];
  }
  if (webfontUrl) {
    warnings.push({ name: 'webfont-cdn-dependency', lane: 'static', evidence: `원격 CDN 폰트 의존: ${webfontUrl.slice(0, 56)} — 자가호스팅/인라인 권장(오프라인·차단 시 폴백)` });
  }
  // b1 — reduced-motion 미가드 모션 (WARN, MO2/DE3 교차참조).
 
  const motion = checkReducedMotionGuard(html);
 
  if (motion) {
    warnings.push({ name: 'motion-not-reduced-motion-guarded', lane: 'static', evidence: `${motion.selector} { ${motion.prop}: ${motion.value.slice(0, 32)} } — @media (prefers-reduced-motion: no-preference) 밖 모션 (MO2 가드 권장)` });
  }
  return warnings;
}

export const MACHINE_CHECKS = [
  // 구조 바닥선 = 차단(blocking) — 빈/본문 없는/무의미 납품물은 게이트를 닫는다(#35). 항상 먼저 본다.
  { id: 'ST1', name: 'structural-floor', severity: 'blocking', run: (html) => checkStructuralFloor(html) },
  // 결정론적 슬롭 지문 = 차단(blocking). 강등 불가 — exit 1.
  { id: 'C1', name: 'purple-gradient', severity: 'blocking', run: (html, css) => checkPurpleGradient(css) },
  { id: 'T1', name: 'emoji-bullets', severity: 'blocking', run: (html) => checkEmojiBullets(html) },
  { id: 'T2', name: 'hype-adjectives', severity: 'blocking', run: (html) => checkHypeAdjectives(html) },
  { id: 'T4', name: 'symmetric-heading-pairs', severity: 'blocking', run: (html) => checkSymmetricHeadingPairs(html) },
  // 억제 휴리스틱 = 권고(advisory). 컨셉 시트가 의도를 명시하면 초과 합법 — exit 무영향.
  { id: 'S5', name: 'border-radius-uniform', severity: 'advisory', run: (html, css) => checkUniformRadius(css) },
  { id: 'TY4', name: 'type-family-discipline', severity: 'advisory', run: (html, css, rules, vars) => checkTypeFamilyDiscipline(rules, vars) },
  { id: 'CO1', name: 'color-literal-budget', severity: 'advisory', run: (html, css, rules) => checkColorLiteralBudget(rules) },
  { id: 'DE1', name: 'shadow-physics-budget', severity: 'advisory', run: (html, css, rules, vars) => checkShadowPhysics(rules, vars) },
  { id: 'IM2', name: 'image-alt-attribute', severity: 'advisory', run: (html) => checkImageAltAttribute(html) },
  // 품질 바닥선 = 차단(blocking).
  { id: 'DE3', name: 'quality-floor', severity: 'blocking', run: (html, css, rules) => checkQualityFloor(html, rules) },
];

// 기계 감사 진입점. slopScore는 실행한 전체 검사 대비 실패 비율(0..1) — 분자·분모를
// 같은 findings 집합으로 잡아 --visual 모드에서도 0..1을 유지한다(이전엔 분모를
// MACHINE_CHECKS 수로 고정해 시각 실패가 더해지면 100% 초과가 찍혔다).
export function auditHtml(rawHtml) {
  // 모든 검사가 보는 입력을 한 번에 캡한다 — 과대/병리적 입력(중첩 @media 등)의
  // CPU/메모리 폭주를 막는다(검사별 내부 slice와 중복되지만 단일 진입 보호).
  const html = String(rawHtml).slice(0, HTML_SCAN_LIMIT);
  const css = extractCss(html);
  const rules = extractCssRules(html);
  const vars = rootVarMap(rules);
  const findings = MACHINE_CHECKS.map(({ id, name, severity, run }) => {
    const { pass, evidence = null } = run(html, css, rules, vars);
    return { id, name, severity, pass, evidence };
  });
  const failed = findings.filter((f) => !f.pass);
  // severity !== 'advisory' = blocking(누락 시 fail-safe blocking). pass는 blocking만 본다.
  const blockingFailed = failed.filter((f) => f.severity !== 'advisory');
  const advisoryFailed = failed.filter((f) => f.severity === 'advisory');
  return {
    findings,
    failed: failed.map((f) => f.id),
    blockingFailed: blockingFailed.map((f) => f.id),
    advisoryFailed: advisoryFailed.map((f) => f.id),
    slopScore: failed.length / findings.length,
    blockingScore: blockingFailed.length / findings.length,
    pass: blockingFailed.length === 0,
    warnings: collectWarnings(html, rules, vars),
  };
}

// 정적 감사 결과에 시각 레인(geometry.js) 결과를 합류시킨다. visual은 배열
// (legacy) 또는 { findings, warnings } 둘 다 받는다 — normalize 후 findings는
// 병합, warnings는 static+visual을 concat한다. WARN은 절대 fail로 승격되지
// 않으므로 failed/slopScore/pass는 findings만 본다(WARN↔fail 의미 분리).
//
// 같은 원칙 ID가 정적/시각 암으로 나뉘어 들어오는 경우(DE3 quality-floor의
// 대비 검사 등)는 하나의 finding으로 병합한다. 같은 원칙을 두 번 denominator에
// 넣으면 이중 채점이 되므로, pass는 AND, evidence는 순서대로 결합한다.
export function combineAudits(staticResult, visual) {
  const visualFindings = Array.isArray(visual) ? visual : (visual?.findings ?? []);
  const visualWarnings = Array.isArray(visual) ? [] : (visual?.warnings ?? []);
  const findings = staticResult.findings.map((f) => ({ ...f }));
  const indexById = new Map(findings.map((f, i) => [f.id, i]));
  for (const v of visualFindings) {
    const existingIndex = indexById.get(v.id);
    if (existingIndex === undefined) {
      indexById.set(v.id, findings.length);
      // severity 누락 시 fail-open(advisory)로 둔다. `{ severity:'blocking', ...v }`는
      // v가 severity를 안 주면 'blocking'으로 굳어, advisory 시각 텔(L1/L2/S3/TY…)을
      // 차단으로 잘못 승격(pass=false, exit 1)했다 — advisory-never-blocks 위반.
      findings.push({ ...v, severity: v.severity ?? 'advisory' });
      continue;
    }

    const existing = findings[existingIndex];
    const evidence = [existing.evidence, v.evidence].filter(Boolean).join('; ');
    // 공유 ID 병합 시 severity는 blocking 우선으로 승격한다 — 한쪽이라도 명시적 blocking이면
    // 차단으로 굳혀, advisory static ID에 blocking 시각/결정론 텔이 묻혀 게이트를 우회하는 일을 막는다.
    // (severity 누락은 advisory로 둬 fail-open 유지 — advisory-never-wrongly-blocks와 양립.)
    const mergedBlocking = (existing.severity && existing.severity !== 'advisory')
      || (v.severity && v.severity !== 'advisory');
    findings[existingIndex] = {
      ...existing,
      severity: mergedBlocking ? 'blocking' : (existing.severity ?? 'advisory'),
      pass: existing.pass && v.pass,
      evidence: evidence || null,
    };
  }
  const failedF = findings.filter((f) => !f.pass);
  const blockingFailed = failedF.filter((f) => f.severity !== 'advisory');
  const advisoryFailed = failedF.filter((f) => f.severity === 'advisory');
  return {
    findings,
    failed: failedF.map((f) => f.id),
    blockingFailed: blockingFailed.map((f) => f.id),
    advisoryFailed: advisoryFailed.map((f) => f.id),
    slopScore: findings.length ? failedF.length / findings.length : 0,
    blockingScore: findings.length ? blockingFailed.length / findings.length : 0,
    pass: blockingFailed.length === 0,
    warnings: [...(staticResult.warnings ?? []), ...visualWarnings],
  };
}

export function formatAuditReport(result, { source = '' } = {}) {
  const lines = [`design-tell audit${source ? ` — ${source}` : ''}`];
  for (const f of result.findings) {
    // pass / FAIL(차단) / advise(권고 — 납품 차단 안 함)
    const tag = f.pass ? 'pass' : (f.severity === 'advisory' ? 'advise' : 'FAIL');
    lines.push(`  ${tag}  ${f.id} ${f.name}${f.evidence ? `  ← ${f.evidence}` : ''}`);
  }
  // warnings는 craft 권고일 뿐 — pass/exit code에 영향 없음
  for (const w of result.warnings ?? []) {
    lines.push(`  WARN  ${w.name}  ← ${w.evidence}`);
  }
  const blocking = result.blockingFailed ?? result.failed;
  const advisory = result.advisoryFailed ?? [];
  lines.push(`  blocking: ${blocking.length} (${blocking.join(',') || '-'}) · advisory: ${advisory.length} (${advisory.join(',') || '-'}) · slop ${(result.slopScore * 100).toFixed(0)}%`);
  lines.push(result.pass
    ? `  납품 가능 — 차단 0건${advisory.length ? ` (권고 ${advisory.length}건은 의도 확인 후 유지 가능)` : ''}. SKILL.md Phase 5 LLM 체크리스트로 계속`
    : '  납품 불가 — 차단(품질 바닥선/슬롭 지문) 발화. Phase 3으로 돌아가 수정 후 재감사');
  return lines.join('\n');
}
