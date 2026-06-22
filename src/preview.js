// Phase 4 browser preview builder.
//
// patina의 preview 원칙을 따른다:
//  - 프리뷰 문서는 inert: 스크립트 제거 + CSP로 실행 차단. 검수 화면이
//    산출물을 오염시키거나 임의 코드를 실행하는 일이 없다.
//  - 뷰 토글은 스크립트 없는 radio-hack: built(기본) / original / both.
//  - 모든 크롬 셀렉터는 dsiv- 프리픽스 + !important — 산출물의 CSS가
//    검수 크롬을 가리지 못한다.
//
// inert sanitize/CSP primitive는 src/inert-html.js가 단일 소스로 보유한다(board 레인과 공유).
// 여기서는 호환을 위해 stripActiveContent와 INERT_CSP를 re-export한다.

import {
  INERT_CSP,
  stripActiveContent,
  neutralizeRemoteUrls,
  escapeHtml,
} from './inert-html.js';

export { INERT_CSP, stripActiveContent };

// 기존 호출부(과거 PREVIEW_CSP) 호환 별칭. CSP 본체는 INERT_CSP가 정본.
const PREVIEW_CSP = INERT_CSP;

function extractBody(html) {
  const m = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(html);
  const body = m ? m[1] : html;
  // 본문 안의 <style>는 패널에 raw로 들어가면 전역(공유 문서) 적용돼 다른 패널로 누출된다.
  // 그 CSS는 extractStyleCss(문서 전체)가 이미 수집·패널 스코프하므로 여기선 raw 태그만 제거한다.
  // 본문 내 <link rel=stylesheet>(로컬 죽은 링크/원격은 stripActiveContent가 처리)도 제거한다.
  return body
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<link\b[^>]*>/gi, (tag) => (/\brel\s*=\s*("?)stylesheet\1/i.test(tag) ? '' : tag));
}


function extractStyleCss(html) {
  // 문서 전체(head+body)의 <style>를 수집한다 — 본문 <style>도 패널로 스코프해야 누출이 없다.
  return (String(html).match(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi) ?? [])
    .map((tag) => /<style\b[^>]*>([\s\S]*?)<\/style\s*>/i.exec(tag)?.[1] ?? '');
}

function sanitizeCssChunk(css) {
  return neutralizeRemoteUrls(String(css).replace(/@import\b[^;]{0,4096};/gi, ''));
}

// 크롬 셀렉터는 위조 불가한 #dsiv-root로 스코프해 특이도를 (1,1,0)+로 올린다 —
// 산출물/슬롭 CSS의 `.dsiv-bar{display:none!important}`(0,1,0)나 `body .dsiv-bar`(0,1,1)로는
// 이길 수 없다. CHROME_CSS는 수집 스타일 뒤에 배치해 동률 !important도 순서로 크롬이 이긴다.
const CHROME_CSS = `
#dsiv-root .dsiv-bar{position:sticky!important;top:0!important;z-index:99999!important;display:flex!important;gap:16px!important;align-items:center!important;padding:10px 16px!important;background:#1a1a1a!important;color:#eee!important;font:13px/1.4 system-ui,sans-serif!important}
#dsiv-root .dsiv-bar label{cursor:pointer!important;opacity:.7!important}
#dsiv-root .dsiv-bar input:checked+span{opacity:1!important;font-weight:600!important;text-decoration:underline!important}
#dsiv-root .dsiv-pane{display:none!important}
#dsiv-root #dsiv-built:checked~.dsiv-built,#dsiv-root #dsiv-original:checked~.dsiv-original{display:block!important}
#dsiv-root #dsiv-both:checked~.dsiv-pane{display:block!important}
#dsiv-root #dsiv-both:checked~.dsiv-original{outline:3px dashed #c0392b!important;outline-offset:-3px!important}
#dsiv-root .dsiv-tag{position:sticky!important;top:42px!important;z-index:99998!important;display:block!important;padding:4px 16px!important;background:#333!important;color:#bbb!important;font:11px/1 system-ui,sans-serif!important}
#dsiv-root .dsiv-warning{display:block!important;margin:8px 16px!important;padding:8px!important;background:#fff3cd!important;color:#5f4300!important;border:1px solid #ffe08a!important;font:12px/1.4 system-ui,sans-serif!important}
`.replace(/\n/g, '');

// 빌드 산출물(필수)과 원본 slop(선택)을 받아 검수용 단일 HTML을 만든다.
export function buildPreviewHtml({
  builtHtml,
  originalHtml = null,
  title = 'design-interview preview',
  builtLocalCss = [],
  originalLocalCss = [],
  builtLinkWarnings = [],
  originalLinkWarnings = [],
}) {
  if (!builtHtml) throw new Error('builtHtml is required');
  const built = stripActiveContent(builtHtml);
  const hasOriginal = originalHtml != null;
  const original = hasOriginal ? stripActiveContent(originalHtml) : null;

  const builtStyles = buildPaneStyle(built, '.dsiv-built', builtLocalCss, builtLinkWarnings);
  const originalStyles = hasOriginal
    ? buildPaneStyle(original, '.dsiv-original', originalLocalCss, originalLinkWarnings)
    : { style: '', warnings: [] };

  const radios = [
    `<input type="radio" name="dsiv-view" id="dsiv-built" hidden checked>`,
    hasOriginal ? `<input type="radio" name="dsiv-view" id="dsiv-original" hidden>` : '',
    hasOriginal ? `<input type="radio" name="dsiv-view" id="dsiv-both" hidden>` : '',
  ].join('');

  const bar = `<div class="dsiv-bar">design-interview
    <label for="dsiv-built"><input type="radio" name="dsiv-bar" hidden checked><span>built</span></label>
    ${hasOriginal ? `<label for="dsiv-original"><input type="radio" name="dsiv-bar" hidden><span>original (slop)</span></label>
    <label for="dsiv-both"><input type="radio" name="dsiv-bar" hidden><span>both</span></label>` : ''}
  </div>`;

  const panes = [
    `<div${paneAttrs(built, 'dsiv-pane dsiv-built')}>${warningMarkers(builtStyles.warnings)}${extractBody(built)}</div>`,
    hasOriginal
      ? `<div${paneAttrs(original, 'dsiv-pane dsiv-original')}><span class="dsiv-tag">original slop source — 납품물 아님</span>${warningMarkers(originalStyles.warnings)}${extractBody(original)}</div>`
      : '',
  ].join('');

  // 산출물 스타일을 먼저, CHROME_CSS를 그 뒤에 둔다(순서로도 크롬 우선). 크롬·토글·패널은
  // #dsiv-root로 감싸 크롬 셀렉터의 #dsiv-root 스코프가 실제로 매칭되게 한다.
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">
<title>${escapeHtml(title)}</title>
${builtStyles.style}${originalStyles.style}
<style>${CHROME_CSS}</style>
</head><body><div id="dsiv-root">${radios}${bar}${panes}</div></body></html>`;
}

function buildPaneStyle(html, paneSel, localCss, linkWarnings) {
  const warnings = [...linkWarnings.map(String)];
  const scoped = [];
  for (const raw of [...extractStyleCss(html), ...localCss]) {
    const res = scopeCss(sanitizeCssChunk(raw), paneSel);
    warnings.push(...res.warnings);
    if (res.css) scoped.push(res.css);
  }
  return {
    style: scoped.length ? `<style>${scoped.join('\n')}</style>` : '',
    warnings,
  };
}

function warningMarkers(warnings) {
  return warnings.map((w) => `<span class="dsiv-warning">${escapeHtml(w)}</span>`).join('');
}

function paneAttrs(html, baseClass) {
  const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0] ?? '';
  const bodyTag = /<body\b[^>]*>/i.exec(html)?.[0] ?? '';
  const classes = [baseClass];
  const attrs = new Map();
  for (const tag of [htmlTag, bodyTag]) {
    for (const attr of parseAttrs(tag)) {
      const name = attr.name.toLowerCase();
      if (name === 'class') classes.push(attr.value.split(/\s+/).filter((t) => t && !/^dsiv-/i.test(t)).join(' '));
      else if ((name === 'lang' || name === 'dir' || name.startsWith('data-')) && !/^on/i.test(name)) attrs.set(name, attr.value);
    }
  }
  const rendered = [`class="${escapeHtml(classes.filter(Boolean).join(' ').trim())}"`];
  for (const [name, value] of attrs) rendered.push(`${name}="${escapeHtml(value)}"`);
  return ` ${rendered.join(' ')}`;
}

function parseAttrs(tag) {
  const out = [];
  tag.replace(/\s([:\w-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g, (_, name, raw) => {
    out.push({ name, value: raw.replace(/^['"]|['"]$/g, '') });
    return '';
  });
  return out;
}

function stripCssComments(css) {
  let out = '';
  let quote = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (quote) {
      out += c;
      if (c === '\\') out += css[++i] ?? '';
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") {
      quote = c;
      out += c;
    } else if (c === '/' && css[i + 1] === '*') {
      i = css.indexOf('*/', i + 2);
      if (i < 0) break;
      i++;
    } else {
      out += c;
    }
  }
  return out;
}

// Small bounded top-level rule walker: it tracks strings/comments/braces only, never tries to parse declarations.
function scopeCss(css, paneSel) {
  css = stripCssComments(String(css));
  const warnings = [];
  const rules = [];
  let i = 0;
  while (i < css.length) {
    while (/\s/.test(css[i] ?? '')) i++;
    if (i >= css.length) break;
    const open = findTopLevel(css, '{', i);
    if (open < 0) {
      if (css.slice(i).trim()) return { css: '', warnings: ['malformed CSS stripped'] };
      break;
    }
    const close = findMatchingBrace(css, open);
    if (close < 0) return { css: '', warnings: ['malformed CSS stripped'] };
    const prelude = css.slice(i, open).trim();
    const body = css.slice(open + 1, close);
    if (prelude.startsWith('@')) {
      if (/^@(media|supports|container|layer|starting-style)\b/i.test(prelude)) {
        // 그룹 at-rule: 내부 룰을 패널로 재귀 스코프(루트 prelude가 없어 누출 없음).
        const inner = scopeCss(body, paneSel);
        warnings.push(...inner.warnings);
        rules.push(`${prelude} { ${inner.css} }`);
      } else if (/^@(font-face|keyframes|-webkit-keyframes|property|page|counter-style|font-feature-values|charset|namespace)\b/i.test(prelude)) {
        // 선언/리소스 at-rule: 전역 유지(스코프 대상 아님; @keyframes 내부 from/to/% 보존).
        rules.push(`${prelude}{${body}}`);
      } else {
        // 알 수 없는/스코프 불가 at-rule(@scope 등 — prelude 루트가 패널 밖을 가리켜 누출 위험) → fail-closed drop.
        warnings.push(`at-rule dropped: ${prelude.slice(0, 40)}`);
      }
    } else {
      const selectors = splitTopLevelCommas(prelude);
      const kept = [];
      for (const selector of selectors) {
        const scoped = scopeSelector(selector.trim(), paneSel);
        if (scoped) kept.push(scoped);
        else warnings.push(`selector skipped: ${selector.trim()}`);
      }
      if (kept.length) rules.push(`${kept.join(',')} { ${body} }`);
    }
    i = close + 1;
  }
  return { css: rules.join(''), warnings };
}

function findTopLevel(s, needle, start) {
  let quote = '';
  let paren = 0;
  let bracket = 0;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') paren++;
    else if (c === ')') paren = Math.max(0, paren - 1);
    else if (c === '[') bracket++;
    else if (c === ']') bracket = Math.max(0, bracket - 1);
    else if (c === needle && paren === 0 && bracket === 0) return i;
  }
  return -1;
}

function findMatchingBrace(s, open) {
  let quote = '';
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

function splitTopLevelCommas(s) {
  const parts = [];
  let quote = '';
  let paren = 0;
  let bracket = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') paren++;
    else if (c === ')') paren = Math.max(0, paren - 1);
    else if (c === '[') bracket++;
    else if (c === ']') bracket = Math.max(0, bracket - 1);
    else if (c === ',' && paren === 0 && bracket === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

function scopeSelector(sel, paneSel) {
  const parts = selectorParts(sel);
  if (!parts.length) return null;
  // 함수형 가상클래스(:is/:where/:has/:not) 안의 root 토큰(:root/html/body)은 패널 루트로
  // 안전 변환 불가 → drop+warn(호출부가 'selector skipped' 기록). 조용한 스타일 손실 방지.
  if (/:(?:is|where|has|not|matches)\([^)]*(?::root\b|(?<![\w.#:=\-\[])(?:html|body)(?![\w-]))/i.test(sel)) return null;
  const first = parts.findIndex((p) => p.kind === 'compound');
  const root = rootReplacement(parts[first].text);
  if (!root) return `${paneSel} ${sel}`;

  parts[first].text = root.replaceWith(paneSel);
  let removeTo = first;
  while (
    parts[removeTo + 1]?.kind === 'combinator'
    && /^\s+$/.test(parts[removeTo + 1].text)
    && rootReplacement(parts[removeTo + 2]?.text ?? '')
  ) {
    removeTo += 2;
  }
  for (let i = removeTo + 1; i < parts.length; i++) {
    if (parts[i].kind === 'compound' && rootReplacement(parts[i].text)) return null;
  }
  const kept = removeTo === first ? parts : [parts[first], ...parts.slice(removeTo + 1)];
  return kept.map((p) => p.text).join('');
}

function selectorParts(sel) {
  const parts = [];
  let start = 0;
  let quote = '';
  let paren = 0;
  let bracket = 0;
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '(') paren++;
    else if (c === ')') paren = Math.max(0, paren - 1);
    else if (c === '[') bracket++;
    else if (c === ']') bracket = Math.max(0, bracket - 1);
    else if (paren === 0 && bracket === 0 && (c === '>' || c === '+' || c === '~' || /\s/.test(c))) {
      if (start < i) parts.push({ kind: 'compound', text: sel.slice(start, i) });
      const j = /\s/.test(c) ? readSpaces(sel, i) : i + 1;
      parts.push({ kind: 'combinator', text: sel.slice(i, j) });
      i = j - 1;
      start = j;
    }
  }
  if (start < sel.length) parts.push({ kind: 'compound', text: sel.slice(start) });
  return parts;
}

function readSpaces(s, i) {
  while (i < s.length && /\s/.test(s[i])) i++;
  return i;
}

function rootReplacement(compound) {
  if (/^:root(?![-\w])/i.test(compound)) {
    return { replaceWith: (paneSel) => compound.replace(/^:root/i, paneSel) };
  }
  const m = /^(html|body)(?![-\w])/i.exec(compound);
  if (!m) return null;
  return { replaceWith: (paneSel) => paneSel + compound.slice(m[0].length) };
}
