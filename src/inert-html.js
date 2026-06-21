// 공유 inert HTML 보안 primitive — preview 레인과 board 레인이 동일한 sanitize/CSP 모델을 쓴다.
// (이전엔 preview.js 내부에 있었고, board CLI 레인 신설로 단일 보안 소스로 분리했다.)
//  - inert: 스크립트/인라인 핸들러/javascript: URL 제거 + CSP로 실행 차단.
//  - 원격 리소스(link/img/source/CSS url/@import)는 무력화한다.
// board와 preview는 이 모듈의 INERT_CSP·stripActiveContent를 공유하므로 보안 픽스가 갈라지지 않는다.

export const INERT_CSP = [
  "default-src 'none'",
  "img-src data:",
  "style-src 'unsafe-inline'",
  "font-src data:",
  "frame-src 'none'",
  "script-src 'none'",
].join('; ');

export function getAttr(tag, name) {
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i');
  const raw = re.exec(tag)?.[1] ?? '';
  return raw.replace(/^['"]|['"]$/g, '');
}

export function isStylesheetLink(tag) {
  return getAttr(tag, 'rel').toLowerCase().split(/\s+/).includes('stylesheet');
}

export function isRemoteHref(href) {
  return /^https?:\/\//i.test(href) || href.startsWith('//');
}

export function isRemoteUrl(url) {
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

// 원격/javascript: url(...)을 단일 전방 스캔으로 무력화한다 — 정규식 백트래킹이 없어
// 닫는 ')' 없는 url(https://… 반복(unquoted)에서도 선형이다(이전 정규식은 그 형태에서
// 여전히 O(n²)였고, 내부 공백이 있는 url은 놓쳤다). 따옴표 유무·내부 공백 모두 처리.
export function neutralizeRemoteUrls(css) {
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

export function sanitizeStyleTag(tag) {
  return tag.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/i, (_, open, css, close) => {
    const sanitized = neutralizeRemoteUrls(css.replace(/@import\b[^;]{0,4096};/gi, ''));
    return `${open}${sanitized}${close}`;
  });
}
