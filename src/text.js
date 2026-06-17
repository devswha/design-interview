// 중립 텍스트 유틸 — 인테이크(Phase 0)와 감사(Phase 5)가 함께 쓴다.
// 레인 간 의존을 피하려고 어느 쪽 모듈에도 속하지 않는다.

// 여는 위치가 진짜 <script>/<style> 태그인지 판별한다(<scriptish> 같은 오탐 배제).
// 일치하면 태그명을, 아니면 null을 돌려준다.
function rawTextTagAt(lower, lt) {
  for (const tag of ['script', 'style']) {
    if (lower.startsWith(`<${tag}`, lt)) {
      const after = lower[lt + tag.length + 1] ?? '';
      if (after === '' || /[\s>/]/.test(after)) return tag;
    }
  }
  return null;
}

// 태그를 제거해 보이는 텍스트만 남긴다. 단일 전방 스캔이라 입력 길이에 선형이다
// (정규식 백트래킹 없음 — 미닫힌 태그·연속 '<'에서 O(n²)로 행이 걸리던 문제를 없앤다).
//  - <script>/<style>: 브라우저 RAWTEXT 의미대로 닫는 태그까지(없으면 EOF까지)
//    통째로 제거한다 → JS/CSS 코드가 텍스트로 새어 hype 오탐을 내지 않는다.
//  - 그 밖의 태그: 여는 '<'부터 다음 '>'까지 제거한다.
//  - 닫는 '>'가 더는 없는 일반 '<'(예: "가격 < $50")는 태그가 아니므로 텍스트로 보존한다.
export function stripTags(html) {
  const value = String(html);
  const lower = value.toLowerCase();
  let out = '';
  let cursor = 0;

  while (cursor < value.length) {
    const lt = value.indexOf('<', cursor);
    if (lt < 0) {
      out += value.slice(cursor);
      break;
    }
    out += value.slice(cursor, lt) + ' ';

    const rawTag = rawTextTagAt(lower, lt);
    if (rawTag) {
      const openEnd = value.indexOf('>', lt);
      if (openEnd < 0) break; // 미완 여는 태그 → 나머지는 raw 콘텐츠 → EOF까지 제거
      const closeAt = lower.indexOf(`</${rawTag}`, openEnd + 1);
      if (closeAt < 0) break; // 닫는 태그 없음 → EOF까지 raw로 간주(코드 누출 방지)
      const closeEnd = value.indexOf('>', closeAt);
      if (closeEnd < 0) break;
      cursor = closeEnd + 1;
    } else {
      const gt = value.indexOf('>', lt);
      if (gt < 0) {
        // 더는 닫는 '>'가 없음 → 이 '<'와 그 뒤는 태그가 아니라 텍스트 → 보존.
        out += value.slice(lt);
        break;
      }
      cursor = gt + 1;
    }
  }

  return out;
}
