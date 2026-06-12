// Phase 5 결정론적 design-tell 감사기.
//
// LLM 자기 채점에 의존하지 않고 HTML/CSS를 직접 파싱해 design-tells의
// 기계 판정 가능한 부분집합을 검사한다. patina의 패턴 엔진과 같은 역할:
// 스킬(프롬프트)은 오케스트레이션, 숫자는 코드가 만든다.
//
// 여기서 다루는 텔: C1, T1, T2, T4, S5.
// 나머지(L1~L4, S1~S4 등 의미 판단이 필요한 항목)는 SKILL.md Phase 5의
// LLM 체크리스트로 남는다. 감사기는 통과해도 LLM 감사를 대체하지 않는다.

const HYPE_LEXICON = [
  // ko — patina lexicon/ai-ko.md 계열
  '혁신적인', '완벽한', '강력한', '손쉽게', '경험하세요', '극대화', '새로운 패러다임', '최적화된',
  // en
  'seamless', 'effortless', 'revolutionary', 'game-changing', 'supercharge',
  'unleash', 'elevate your', 'transform your', 'innovative solution',
];

function extractCss(html) {
  const blocks = [...String(html).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]);
  const attrs = [...String(html).matchAll(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)].map((m) => m[2] ?? m[3]);
  return [...blocks, ...attrs].join('\n');
}

function stripTags(html) {
  return String(html)
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
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
  const targets = [...String(html).matchAll(/<(li|h[1-6]|button)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)];
  for (const [, tag, inner] of targets) {
    const text = stripTags(inner).trim();
    if (/^\p{Extended_Pictographic}/u.test(text) || /\p{Extended_Pictographic}$/u.test(text)) {
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
  const headings = [...String(html).matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]\s*>/gi)];
  for (const [, inner] of headings) {
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

export const MACHINE_CHECKS = [
  { id: 'C1', name: 'purple-gradient', run: (html, css) => checkPurpleGradient(css) },
  { id: 'T1', name: 'emoji-bullets', run: (html) => checkEmojiBullets(html) },
  { id: 'T2', name: 'hype-adjectives', run: (html) => checkHypeAdjectives(html) },
  { id: 'T4', name: 'symmetric-heading-pairs', run: (html) => checkSymmetricHeadingPairs(html) },
  { id: 'S5', name: 'border-radius-uniform', run: (html, css) => checkUniformRadius(css) },
];

// 기계 감사 진입점. score는 통과율(0..1) — patina --score와 반대 방향이
// 아니라 같은 "낮을수록 slop" 의미를 유지하려고 slopScore도 함께 준다.
export function auditHtml(html) {
  const css = extractCss(html);
  const findings = MACHINE_CHECKS.map(({ id, name, run }) => {
    const { pass, evidence = null } = run(html, css);
    return { id, name, pass, evidence };
  });
  const failed = findings.filter((f) => !f.pass);
  return {
    findings,
    failed: failed.map((f) => f.id),
    slopScore: failed.length / findings.length,
    pass: failed.length === 0,
  };
}

export function formatAuditReport(result, { source = '' } = {}) {
  const lines = [`design-tell audit${source ? ` — ${source}` : ''}`];
  for (const f of result.findings) {
    lines.push(`  ${f.pass ? 'pass' : 'FAIL'}  ${f.id} ${f.name}${f.evidence ? `  ← ${f.evidence}` : ''}`);
  }
  lines.push(`  slop score: ${(result.slopScore * 100).toFixed(0)}% (${result.failed.length}/${result.findings.length} tells)`);
  lines.push(result.pass
    ? '  machine checks clean — SKILL.md Phase 5 LLM 체크리스트(L1~L4, S1~S4)로 계속'
    : '  납품 불가 — Phase 3으로 돌아가 수정 후 재감사');
  return lines.join('\n');
}
