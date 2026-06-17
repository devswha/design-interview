// 중립 텍스트 유틸 — 인테이크(Phase 0)와 감사(Phase 5)가 함께 쓴다.
// 레인 간 의존을 피하려고 어느 쪽 모듈에도 속하지 않는다.

function findTagOpen(lower, tag, cursor) {
  let at = lower.indexOf(`<${tag}`, cursor);
  while (at >= 0 && !/[\s>/]/.test(lower[at + tag.length + 1] ?? '')) {
    at = lower.indexOf(`<${tag}`, at + 1);
  }
  return at;
}

function stripScriptStyleBlocks(value) {
  const lower = value.toLowerCase();
  let out = '';
  let cursor = 0;

  while (cursor < value.length) {
    const scriptAt = findTagOpen(lower, 'script', cursor);
    const styleAt = findTagOpen(lower, 'style', cursor);
    let openAt;
    let tag;

    if (scriptAt < 0 && styleAt < 0) {
      out += value.slice(cursor);
      break;
    } else if (styleAt < 0 || (scriptAt >= 0 && scriptAt < styleAt)) {
      openAt = scriptAt;
      tag = 'script';
    } else {
      openAt = styleAt;
      tag = 'style';
    }

    out += value.slice(cursor, openAt) + ' ';
    const openEnd = value.indexOf('>', openAt);
    if (openEnd < 0) break;

    const closeAt = lower.indexOf(`</${tag}`, openEnd + 1);
    if (closeAt < 0) break;

    const closeEnd = value.indexOf('>', closeAt);
    if (closeEnd < 0) break;
    cursor = closeEnd + 1;
  }

  return out;
}

export function stripTags(html) {
  return stripScriptStyleBlocks(String(html))
    .replace(/<[^>]+>/g, ' ');
}
