// Phase 4 browser preview builder.
//
// patina의 preview 원칙을 따른다:
//  - 프리뷰 문서는 inert: 스크립트 제거 + CSP로 실행 차단. 검수 화면이
//    산출물을 오염시키거나 임의 코드를 실행하는 일이 없다.
//  - 뷰 토글은 스크립트 없는 radio-hack: built(기본) / original / both.
//  - 모든 크롬 셀렉터는 dsiv- 프리픽스 + !important — 산출물의 CSS가
//    검수 크롬을 가리지 못한다.

const PREVIEW_CSP = [
  "default-src 'none'",
  "img-src data:",
  "style-src 'unsafe-inline'",
  "font-src data:",
  "frame-src 'none'",
  "script-src 'none'",
].join('; ');

// 스크립트/인라인 핸들러/javascript: URL 제거. 산출물은 우리가 만든
// 단일 HTML이라 patina의 tag-aware walk까지는 필요 없지만, --against로
// 들어오는 외부 slop 소스도 같은 경로를 지나므로 보수적으로 처리한다.
export function stripActiveContent(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    // iframe srcdoc는 인라인 문서를 통째로 실어 CSP 우회 표면을 만든다 → 속성 제거.
    .replace(/<iframe\b[^>]*>/gi, (tag) => tag.replace(/[\s/]srcdoc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ''))
    // meta http-equiv=refresh (자동 이동/지연 실행) 제거.
    .replace(/<meta\b[^>]*\bhttp-equiv\s*=\s*(["']?)refresh\1[^>]*>/gi, '')
    .replace(/<link\b[^>]*>/gi, (tag) => (isRemoteHref(getAttr(tag, 'href')) ? '' : tag))
    .replace(/<(img|source)\b[^>]*>/gi, (tag) => sanitizeMediaTag(tag))
    // 인라인 핸들러는 공백 구분만 제거한다. [\s/]로 넓히면 URL 경로/텍스트의 `/on…=`
    // (예: href="/online=1")를 잘못 잘라먹어 정상 콘텐츠를 망가뜨린다(런타임은 CSP가
    // script-src 'none'으로 슬래시 구분 핸들러까지 막으므로 정규식 확장의 이득이 없다).
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ' ')
    .replace(/\b(href|src|action|formaction|data)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '$1=$2#$2');
}

function extractBody(html) {
  const m = /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(html);
  return m ? m[1] : html;
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
`.replace(/\n/g, '');

// 빌드 산출물(필수)과 원본 slop(선택)을 받아 검수용 단일 HTML을 만든다.
export function buildPreviewHtml({ builtHtml, originalHtml = null, title = 'design-interview preview' }) {
  if (!builtHtml) throw new Error('builtHtml is required');
  const built = stripActiveContent(builtHtml);
  const hasOriginal = originalHtml != null;
  const original = hasOriginal ? stripActiveContent(originalHtml) : null;

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
    `<div class="dsiv-pane dsiv-built">${extractBody(built)}</div>`,
    hasOriginal
      ? `<div class="dsiv-pane dsiv-original"><span class="dsiv-tag">original slop source — 납품물 아님</span>${extractBody(original)}</div>`
      : '',
  ].join('');

  // 산출물 스타일을 먼저, CHROME_CSS를 그 뒤에 둔다(순서로도 크롬 우선). 크롬·토글·패널은
  // #dsiv-root로 감싸 크롬 셀렉터의 #dsiv-root 스코프가 실제로 매칭되게 한다.
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">
<title>${title}</title>
${collectHeadStyles(built)}${hasOriginal ? collectHeadStyles(original) : ''}
<style>${CHROME_CSS}</style>
</head><body><div id="dsiv-root">${radios}${bar}${panes}</div></body></html>`;
}

function getAttr(tag, name) {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  const raw = re.exec(tag)?.[1] ?? '';
  return raw.replace(/^['"]|['"]$/g, '');
}

function isStylesheetLink(tag) {
  return getAttr(tag, 'rel').toLowerCase().split(/\s+/).includes('stylesheet');
}

function isRemoteHref(href) {
  return /^https?:\/\//i.test(href) || href.startsWith('//');
}

function isRemoteUrl(url) {
  return /^https?:\/\//i.test(url) || url.startsWith('//');
}

function sanitizeMediaTag(tag) {
  return tag.replace(/\s(src|srcset)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (attr, name, raw) => {
    const quote = raw.startsWith('"') || raw.startsWith("'") ? raw[0] : '';
    const value = quote ? raw.slice(1, -1) : raw;
    const sanitized = name.toLowerCase() === 'srcset'
      ? value.replace(/(^|[\s,])(https?:\/\/|\/\/)[^\s,]+/gi, '$1#')
      : (isRemoteUrl(value.trim()) ? '#' : value);
    return ` ${name}=${quote}${sanitized}${quote}`;
  });
}

// 원격/javascript: url(...)을 단일 전방 스캔으로 무력화한다 — 정규식 백트래킹이 없어
// 닫는 ')' 없는 url(https://… 반복(unquoted)에서도 선형이다(이전 정규식은 그 형태에서
// 여전히 O(n²)였고, 내부 공백이 있는 url은 놓쳤다). 따옴표 유무·내부 공백 모두 처리.
function neutralizeRemoteUrls(css) {
  const lower = css.toLowerCase();
  let out = '';
  let i = 0;
  while (i < css.length) {
    const at = lower.indexOf('url(', i);
    if (at < 0) { out += css.slice(i); break; }
    out += css.slice(i, at);
    const close = css.indexOf(')', at + 4);
    if (close < 0) { out += css.slice(at); break; } // 미완 url( — 그대로 둠(CSP가 차단)
    const inner = css.slice(at + 4, close).trim().replace(/^['"]|['"]$/g, '').trim();
    out += /^(?:https?:)?\/\//i.test(inner) || /^javascript:/i.test(inner) ? 'url("#")' : css.slice(at, close + 1);
    i = close + 1;
  }
  return out;
}

function sanitizeStyleTag(tag) {
  return tag.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/i, (_, open, css, close) => {
    const sanitized = neutralizeRemoteUrls(css.replace(/@import\b[^;]{0,4096};/gi, ''));
    return `${open}${sanitized}${close}`;
  });
}

// 산출물 <head>의 <style>/<link rel=stylesheet>를 프리뷰로 가져온다.
// (산출물은 단일 파일 원칙이라 보통 <style> 하나다.)
function collectHeadStyles(html) {
  const head = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(html)?.[1] ?? '';
  const styles = (head.match(/<style\b[\s\S]*?<\/style\s*>/gi) ?? []).map((style) => sanitizeStyleTag(style));
  const links = (head.match(/<link\b[^>]*>/gi) ?? [])
    .filter((link) => isStylesheetLink(link) && !isRemoteHref(getAttr(link, 'href')));
  return [...styles, ...links].join('\n');
}
