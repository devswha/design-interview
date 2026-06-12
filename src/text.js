// 중립 텍스트 유틸 — 인테이크(Phase 0)와 감사(Phase 5)가 함께 쓴다.
// 레인 간 의존을 피하려고 어느 쪽 모듈에도 속하지 않는다.

export function stripTags(html) {
  return String(html)
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}
