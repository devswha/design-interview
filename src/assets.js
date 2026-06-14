// design-interview 에셋 advisory 검사 모듈 — Pure ESM, best-effort.
//
// 반환값은 항상 advisory only. 빌드를 차단하지 않는다(always exit 0).
// S2 가짜-실재 최종 판정 권위는 LLM 레인 단일; 여기서는 sidecar 근거 의심 표시만.

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, basename, extname } from 'node:path';

// 알려진 브랜드명 목록 (Signal 1 logo-as-customer 의심에 사용)
const BRAND_NAMES = [
  'openai', 'anthropic', 'claude', 'gemini', 'notion', 'figma', 'vercel',
  'perplexity', 'google', 'apple', 'microsoft', 'amazon', 'meta', 'stripe',
  'slack', 'github', 'twitter', 'instagram', 'facebook', 'linkedin',
  'spotify', 'netflix', 'uber', 'airbnb', 'shopify', 'salesforce', 'hubspot',
  'adobe', 'dropbox', 'zoom', 'discord', 'twitch', 'reddit', 'pinterest',
];

// sidecar에서 명목적 사용 근거로 인정되는 토큰
const NOMINATIVE_TOKENS = [
  'nominative', 'trademark', '명목적', '주체', 'cc0', 'mit',
];

// AI 생성 소스 표시 토큰 (Signal 2·3 판단)
const AI_SOURCE_TOKENS = ['ai', '생성', 'generated', 'ai생성', 'ai-generated'];

// ─── 종류 분류 ─────────────────────────────────────────────────────────────

/**
 * classifyKind(relPath) → 'logo'|'image'|'texture'|'font'|'other'
 *
 * 규칙:
 *   - woff2/woff/ttf/otf → font
 *   - textures/ 경로 또는 noise/grid/hatch/pattern 파일명 → texture
 *   - icons/ 경로 + .svg → 브랜드·로고형 파일명이면 logo, 아니면 other
 *   - images/ 경로 또는 .png/.jpg/.jpeg/.webp → image
 *   - 그 외 → other
 */
export function classifyKind(relPath) {
  const lower = relPath.toLowerCase().replace(/\\/g, '/');
  const ext = extname(lower);
  const file = basename(lower);
  const noExt = file.replace(/\.[^.]+$/, '');

  // 폰트 확장자
  if (['.woff2', '.woff', '.ttf', '.otf'].includes(ext)) return 'font';

  // 텍스처 경로 또는 파일명 패턴
  if (lower.includes('textures/') || lower.includes('texture/')) return 'texture';
  if (/\b(noise|grid|hatch|pattern)\b/.test(noExt)) return 'texture';

  // icons/ 경로의 SVG
  if ((lower.includes('icons/') || lower.includes('icon/')) && ext === '.svg') {
    if (isLogoLike(noExt)) return 'logo';
    return 'other';
  }

  // images/ 경로 또는 래스터 확장자
  if (lower.includes('images/') || lower.includes('image/')) return 'image';
  if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return 'image';

  return 'other';
}

/** 파일 basename(확장자 제외)이 로고형인지 판단 */
function isLogoLike(noExt) {
  // -logo/-mark/-badge/-icon 접미사
  if (/(-logo|-mark|-badge|-icon)$/.test(noExt)) return true;
  // 알려진 브랜드명과 정확 일치 또는 브랜드명 + 접미사/접두사
  return BRAND_NAMES.some(
    (b) => noExt === b || noExt.startsWith(b + '-') || noExt.endsWith('-' + b),
  );
}

// ─── Sidecar 파싱 ──────────────────────────────────────────────────────────

/**
 * parseSidecar(text) → { license?, source?, ... }
 *
 * .license.txt의 'key: value' 라인에서 필드 파싱. 누락 키는 undefined.
 */
export function parseSidecar(text) {
  const result = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([a-zA-Z가-힣_\-]+)\s*:\s*(.+)$/);
    if (m) {
      result[m[1].toLowerCase().trim()] = m[2].trim();
    }
  }
  return result;
}

// ─── 가짜-실재 의심 탐지 ──────────────────────────────────────────────────

/**
 * detectFabrication(relPath, sidecar) → null | { reason }
 *
 * 3 신호(advisory 표시만 — 판정 아님. 최종 판정은 LLM 레인 단일 권위):
 *   1. 브랜드 로고형 파일명 + sidecar 명목적 참조 근거 없음
 *   2. screenshot/dashboard/screen 파일명 + source=AI생성
 *   3. chart/graph/data/stat 파일명 + source=AI생성
 *
 * sidecar에 명목적 근거가 있으면 Signal 1은 음성(null).
 */
export function detectFabrication(relPath, sidecar) {
  const lower = relPath.toLowerCase().replace(/\\/g, '/');
  const noExt = basename(lower).replace(/\.[^.]+$/, '');

  // sidecar 전체 값을 소문자 문자열로 합산 (근거 탐색용)
  const sidecarValues = Object.values(sidecar || {})
    .filter((v) => typeof v === 'string')
    .join(' ')
    .toLowerCase();

  // Signal 1: 브랜드 로고형 파일명 + 명목적 근거 없음
  if (isLogoLike(noExt)) {
    const hasNominativeBasis = NOMINATIVE_TOKENS.some((t) =>
      sidecarValues.includes(t),
    );
    if (!hasNominativeBasis) {
      return { reason: 'logo-as-customer 의심: 상표 마크, sidecar 명목적 참조 근거 없음' };
    }
  }

  // sidecar.source에 AI 생성 표시 여부
  const sourceValue = (sidecar?.source ?? '').toLowerCase();
  const hasAiSource = AI_SOURCE_TOKENS.some((t) => sourceValue.includes(t));

  // Signal 2: screenshot/dashboard/screen + AI source
  if (/\b(screenshot|dashboard|screen)\b/.test(noExt) && hasAiSource) {
    return { reason: 'AI 생성 스크린샷 의심(가짜 실재)' };
  }

  // Signal 3: chart/graph/data/stat + AI source
  if (/\b(chart|graph|data|stat)\b/.test(noExt) && hasAiSource) {
    return { reason: 'AI 생성 데이터/차트 의심' };
  }

  return null;
}

// ─── 디렉터리 감사 ─────────────────────────────────────────────────────────

/**
 * auditAssets(dir, { conceptSheetPath? }) → Promise<AssetReport>
 *
 * dir을 재귀 스캔해 에셋을 분류하고 sidecar 누락·가짜-실재 의심을 탐지.
 * 파싱 실패 파일은 throw 대신 skipped에 추가(best-effort).
 *
 * 반환:
 *   { dir, counts, files, missingSidecar, suspectFabrication,
 *     skipped, conceptSheet, summary }
 */
export async function auditAssets(dir, { conceptSheetPath } = {}) {
  const files = [];
  const missingSidecar = [];
  const suspectFabrication = [];
  const skipped = [];
  const counts = { logo: 0, image: 0, texture: 0, font: 0, other: 0, total: 0 };

  async function scan(currentDir) {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      // readdir 실패 → 디렉터리 전체를 skipped 처리
      skipped.push(relative(dir, currentDir) || '.');
      return;
    }

    // 현재 디렉터리의 sidecar 파일명 집합 (에셋명 → sidecar 있음)
    // sidecar: 'openai.svg.license.txt' → 에셋명 'openai.svg'
    const sidecarSet = new Set(
      entries
        .filter((e) => e.isFile() && e.name.endsWith('.license.txt'))
        .map((e) => e.name.slice(0, -'.license.txt'.length)),
    );

    for (const entry of entries) {
      // .gitkeep 등 메타 파일 건너뜀
      if (entry.name === '.gitkeep') continue;

      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;

      // sidecar 파일 자체는 에셋이 아님 — 건너뜀
      if (entry.name.endsWith('.license.txt')) continue;

      const relPath = relative(dir, fullPath);
      let kind;
      try {
        kind = classifyKind(relPath);
      } catch {
        skipped.push(relPath);
        continue;
      }

      const hasSidecar = sidecarSet.has(entry.name);

      let sidecar = {};
      let source;

      if (hasSidecar) {
        try {
          const sidecarText = await readFile(
            join(currentDir, entry.name + '.license.txt'),
            'utf8',
          );
          sidecar = parseSidecar(sidecarText);
          source = sidecar.source;
        } catch {
          // sidecar 읽기 실패 → skipped(best-effort)
          skipped.push(relPath + '.license.txt');
        }
      } else {
        missingSidecar.push(relPath);
      }

      // 가짜-실재 의심 탐지 (오류 시 skipped)
      try {
        const fab = detectFabrication(relPath, sidecar);
        if (fab) suspectFabrication.push({ path: relPath, reason: fab.reason });
      } catch {
        skipped.push(relPath + ' [detectFabrication]');
      }

      files.push({ path: relPath, kind, hasSidecar, source });
      counts[kind] = (counts[kind] ?? 0) + 1;
      counts.total++;
    }
  }

  await scan(dir);

  // concept-sheet 에셋 계획 섹션 검사
  let conceptSheet = null;
  if (conceptSheetPath) {
    conceptSheet = await checkConceptSheet(conceptSheetPath, skipped);
  }

  return {
    dir,
    counts,
    files,
    missingSidecar,
    suspectFabrication,
    skipped,
    conceptSheet,
    summary: {
      total: counts.total,
      missingSidecar: missingSidecar.length,
      suspect: suspectFabrication.length,
    },
  };
}

/**
 * concept-sheet 파일에서 에셋 계획 섹션이 비어있는지 판정.
 * 파일 없음 → { present: false, empty: true }
 * 섹션 없음/placeholder만 → { present: true, empty: true }
 * 실제 내용 있음 → { present: true, empty: false }
 */
async function checkConceptSheet(conceptSheetPath, skipped) {
  let text;
  try {
    text = await readFile(conceptSheetPath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { present: false, empty: true };
    skipped.push(conceptSheetPath + ' [conceptSheet]');
    return { present: false, empty: true };
  }

  // '에셋 계획(Sourcing Plan)' 또는 '에셋 선택' 섹션 탐색
  const sectionRe = /(?:에셋\s*계획|에셋\s*선택|Sourcing\s*Plan)/i;
  if (!sectionRe.test(text)) return { present: true, empty: true };

  const isPlaceholderCell = (s) => {
    const t = String(s ?? '').trim();
    return t.length === 0 || /^\{[^}]*\}$/.test(t) || /^[-–—|*>\s.]+$/.test(t);
  };

  // 1) 표-행 형식: | …에셋 계획… | <내용> | <근거 원칙> |
  //    실제 concept-sheet 템플릿은 Sourcing Plan을 토큰 커밋 표의 한 '행'으로 둔다.
  //    라벨 셀 바로 다음 셀이 내용 — placeholder({…})·빈 셀이면 empty.
  for (const line of text.split('\n')) {
    if (!line.includes('|') || !sectionRe.test(line)) continue;
    const cells = line.split('|').map((c) => c.trim());
    const labelIdx = cells.findIndex((c) => sectionRe.test(c));
    if (labelIdx < 0) continue;
    return { present: true, empty: isPlaceholderCell(cells[labelIdx + 1]) };
  }

  // 2) ## 헤더 섹션 형식: 헤더 다음 줄부터 다음 ## 전까지의 내용
  const headerIdx = text.search(/##[^\n]*(?:에셋\s*계획|에셋\s*선택|Sourcing\s*Plan)/i);
  if (headerIdx < 0) return { present: true, empty: true };
  const afterHeader = text.slice(text.indexOf('\n', headerIdx) + 1);
  const nextSectionIdx = afterHeader.search(/^##/m);
  const content = nextSectionIdx >= 0 ? afterHeader.slice(0, nextSectionIdx) : afterHeader;
  const nonBlankLines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const empty = nonBlankLines.length === 0 || nonBlankLines.every((l) => isPlaceholderCell(l));
  return { present: true, empty };
}

// ─── 리포트 포매터 ─────────────────────────────────────────────────────────

/**
 * formatAssetReport(report) → string
 *
 * 헤더 + 종류별 개수 + sidecar 누락 목록 + 가짜-실재 의심 목록
 * + concept-sheet advisory + 면책 푸터.
 * always exit 0 / advisory only / CI 차단 게이트 금지.
 */
export function formatAssetReport(report) {
  const { dir, counts, missingSidecar, suspectFabrication, conceptSheet } = report;
  const lines = [];

  lines.push(`assets: ${dir}`);
  lines.push(
    `종류별 개수: logo ${counts.logo} · image ${counts.image} · texture ${counts.texture} · font ${counts.font} · other ${counts.other} (total ${counts.total})`,
  );

  lines.push(`sidecar 누락 (${missingSidecar.length}):`);
  for (const p of missingSidecar) lines.push(`  - ${p}`);

  lines.push(
    `가짜-실재 의심 (${suspectFabrication.length}, advisory; 최종 판정은 LLM 레인):`,
  );
  for (const s of suspectFabrication) lines.push(`  - ${s.path} — ${s.reason}`);

  if (conceptSheet && conceptSheet.empty) {
    lines.push('⚠ concept-sheet 에셋 계획 섹션 비어있음(advisory)');
  }

  lines.push(
    '(best-effort 검사 — advisory only · always exit 0 · CI 차단 게이트로 쓰지 말 것)',
  );

  return lines.join('\n');
}
