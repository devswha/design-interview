// 옵션 보드 (option board) 레인 — 결정론 inert HTML serializer.
//
// 두 레이어 규율: 이 모듈은 판단하지 않는다. 옵션 생성·추천 선정·점수·호스트 열기·
// 사용자 입력은 SKILL/host-display 레이어가 맡는다. 여기서는 검증된 options 모델을
// inert 단일 HTML(대시보드)로 직렬화하고 고정 경로에 atomic write만 한다.
//
// 보안: src/inert-html.js의 INERT_CSP를 공유한다. 모든 사용자 텍스트는 escape하고
// 안전한 태그만 emit하므로 출력은 inert(무스크립트·원격 리소스 없음)다. imageFile은
// pre-sized 실제 파일(+sidecar)만 magic-byte 검증 후 data: URI로 임베드한다(생성 금지).

import { readFile, writeFile, rename, unlink, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { parseSidecar } from './assets.js';
import { INERT_CSP } from './inert-html.js';

// 6 core 인터뷰 점수 차원만. palette/asset은 dimension이 아니라 visualRole/questionKind/asset 메타다.
export const CORE_DIMENSIONS = ['audience', 'mood', 'brand', 'structure', 'conversion', 'reference'];
export const VISUAL_TYPES = ['swatches', 'wire', 'moodChips', 'ctaSample', 'imageFile', 'plain'];

const PER_IMAGE_BYTE_CAP = 256 * 1024; // pre-sized 썸네일만 — 런타임 파생/리사이즈 없음
const TOTAL_HTML_CAP = 3 * 1024 * 1024;
const HEX_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// 확장자→MIME + magic-byte 시그니처. 확장자만으로는 절대 수용하지 않는다(불일치 → reject).
const IMAGE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

// 입력/스키마/asset 오류는 kind 'user'(CLI에서 exit 2), 렌더러 불변식 위반은 'invariant'(exit 1).
export class BoardError extends Error {
  constructor(message, kind = 'user') {
    super(message);
    this.name = 'BoardError';
    this.kind = kind === 'invariant' ? 'invariant' : 'user';
  }
}

function userError(message) { return new BoardError(message, 'user'); }

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw userError(`${field}: 비어있지 않은 문자열이어야 합니다`);
  }
  return value;
}

// ─── 시각 유니온 검증 (순수 구조) ────────────────────────────────────────────

function validateVisual(visual, optNumber) {
  if (!visual || typeof visual !== 'object' || Array.isArray(visual)) {
    throw userError(`option ${optNumber}: visual 객체가 필요합니다`);
  }
  const { type } = visual;
  if (!VISUAL_TYPES.includes(type)) {
    throw userError(`option ${optNumber}: visual.type은 ${VISUAL_TYPES.join('|')} 중 하나여야 합니다 (받음: ${type})`);
  }
  switch (type) {
    case 'swatches': {
      const colors = visual.colors;
      if (!Array.isArray(colors) || colors.length === 0) throw userError(`option ${optNumber}: swatches.colors 배열이 필요합니다`);
      for (const c of colors) {
        if (!c || !HEX_RE.test(c.hex ?? '')) throw userError(`option ${optNumber}: swatches.colors[].hex는 단색 hex여야 합니다(그라데이션 금지)`);
      }
      return { type, colors: colors.map((c) => ({ hex: c.hex, label: c.label != null ? String(c.label) : null })) };
    }
    case 'wire': {
      const blocks = visual.blocks;
      if (!Array.isArray(blocks) || blocks.length === 0) throw userError(`option ${optNumber}: wire.blocks 배열이 필요합니다`);
      // 추상 우선순위 블록만. 노드/선/화살표 도식은 표현 자체가 없다(S6 회피).
      return {
        type,
        blocks: blocks.map((b) => ({ label: requireString(b.label, `option ${optNumber}: wire.blocks[].label`), weight: clampWeight(b.weight) })),
      };
    }
    case 'moodChips': {
      const chips = visual.chips;
      if (!Array.isArray(chips) || chips.length < 2 || chips.length > 3) {
        throw userError(`option ${optNumber}: moodChips.chips는 2~3개여야 합니다`);
      }
      for (const ch of chips) {
        if (!['color', 'type', 'texture'].includes(ch?.kind)) throw userError(`option ${optNumber}: moodChips.chips[].kind은 color|type|texture`);
        requireString(ch.value, `option ${optNumber}: moodChips.chips[].value`);
        if (ch.kind === 'color' && !HEX_RE.test(ch.value)) throw userError(`option ${optNumber}: color chip value는 hex여야 합니다`);
      }
      return { type, chips: chips.map((ch) => ({ kind: ch.kind, value: ch.value, label: ch.label != null ? String(ch.label) : null })) };
    }
    case 'ctaSample': {
      // 버튼/문구 표본만. 퍼널/화살표/플로우 도식 없음(S6 회피).
      return { type, text: requireString(visual.text, `option ${optNumber}: ctaSample.text`), note: visual.note != null ? String(visual.note) : null };
    }
    case 'imageFile': {
      const path = requireString(visual.path, `option ${optNumber}: imageFile.path`);
      const kind = visual.kind != null ? visual.kind : null;
      if (kind != null && !['reference', 'asset'].includes(kind)) throw userError(`option ${optNumber}: imageFile.kind은 reference|asset 또는 생략`);
      const ext = path.toLowerCase().split('.').pop();
      if (!IMAGE_MIME[ext]) throw userError(`option ${optNumber}: imageFile 확장자는 png|jpg|jpeg|webp만 (받음: ${ext})`);
      return { type, path, alt: requireString(visual.alt, `option ${optNumber}: imageFile.alt`), kind, ext };
    }
    case 'plain':
    default:
      return { type: 'plain', text: requireString(visual.text, `option ${optNumber}: plain.text`) };
  }
}

function clampWeight(weight) {
  const n = Number(weight);
  if (!Number.isFinite(n)) return 1;
  return Math.min(3, Math.max(1, Math.round(n)));
}

// ─── 모델 검증 (순수 구조, fs 접근 없음) ─────────────────────────────────────

export function parseBoardOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw userError('options.json 루트는 객체여야 합니다');
  }
  if (options.schemaVersion !== 1) {
    throw userError(`schemaVersion은 1만 지원합니다 (받음: ${options.schemaVersion})`);
  }
  const boardId = requireString(options.boardId, 'boardId');
  const roundId = requireString(options.roundId, 'roundId');
  const dimension = options.dimension;
  if (!CORE_DIMENSIONS.includes(dimension)) {
    throw userError(`dimension은 6 core 차원(${CORE_DIMENSIONS.join('/')}) 중 하나여야 합니다. palette/asset은 dimension이 아닙니다 (받음: ${dimension})`);
  }
  const question = requireString(options.question, 'question');

  const opts = options.options;
  if (!Array.isArray(opts) || opts.length === 0) {
    throw userError('options 배열은 비어있지 않아야 합니다');
  }
  const seen = new Set();
  const normalized = opts.map((o) => {
    if (!o || typeof o !== 'object') throw userError('options[] 항목은 객체여야 합니다');
    if (!Number.isInteger(o.number) || o.number < 1) throw userError(`options[].number는 1 이상 정수여야 합니다 (받음: ${o.number})`);
    if (seen.has(o.number)) throw userError(`options[].number 중복: ${o.number}`);
    seen.add(o.number);
    return {
      number: o.number,
      label: requireString(o.label, `option ${o.number}: label`),
      rationale: requireString(o.rationale, `option ${o.number}: rationale`),
      // dimension(점수 차원)과 별개인 per-option 시각 메타. 계약상 retain만 하고 점수에는 쓰지 않는다.
      visualRole: o.visualRole != null ? String(o.visualRole) : null,
      asset: o.asset != null ? String(o.asset) : null,
      visual: validateVisual(o.visual, o.number),
    };
  });

  // 추천: recommendedNumber는 옵션 번호이거나 null. 근거는 추천이 있을 때만 필수.
  const rec = options.recommendedNumber;
  let recommendedNumber = null;
  let recommendReason = null;
  if (rec != null) {
    if (!Number.isInteger(rec) || !seen.has(rec)) throw userError(`recommendedNumber는 존재하는 option number여야 합니다 (받음: ${rec})`);
    recommendedNumber = rec;
    recommendReason = requireString(options.recommendReason, 'recommendReason(추천이 있으면 근거 필수)');
  } else if (options.recommendReason != null && String(options.recommendReason).trim() !== '') {
    throw userError('recommendedNumber가 null이면 recommendReason도 없어야 합니다');
  }

  // dimension과 무관한 시각/질문 메타(옵션). 점수 차원을 오염시키지 않는다.
  const meta = {
    questionKind: options.questionKind != null ? String(options.questionKind) : null,
    visualRole: options.visualRole != null ? String(options.visualRole) : null,
    asset: options.asset != null ? String(options.asset) : null,
  };

  return { schemaVersion: 1, boardId, roundId, dimension, question, recommendedNumber, recommendReason, options: normalized, meta };
}

// ─── 이미지 해석 (async, fs 접근) ────────────────────────────────────────────

function magicMatches(buf, ext) {
  if (ext === 'png') return buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === 'jpg' || ext === 'jpeg') return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (ext === 'webp') return buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP';
  return false;
}

async function sidecarExists(absPath) {
  // strip-ext(x.license.txt)와 keep-ext(x.png.license.txt) 두 형식 모두 인정.
  const noExt = absPath.replace(/\.[^.]+$/, '');
  for (const candidate of [`${absPath}.license.txt`, `${noExt}.license.txt`]) {
    try {
      const text = await readFile(candidate, 'utf8');
      const parsed = parseSidecar(text);
      // sidecar는 최소한 source 또는 license 근거가 있어야 한다.
      if (parsed.source || parsed.license) return true;
    } catch { /* 다음 후보 */ }
  }
  return false;
}

export async function resolveBoardImages(model, baseDir) {
  for (const opt of model.options) {
    const v = opt.visual;
    if (v.type !== 'imageFile') continue;
    const abs = resolve(baseDir, v.path);
    let st;
    try {
      st = await stat(abs);
    } catch {
      throw userError(`option ${opt.number}: imageFile 경로를 찾을 수 없습니다: ${v.path}`);
    }
    if (!st.isFile()) throw userError(`option ${opt.number}: imageFile은 일반 파일이어야 합니다: ${v.path}`);
    if (st.size > PER_IMAGE_BYTE_CAP) {
      throw userError(`option ${opt.number}: imageFile이 per-image 예산(${PER_IMAGE_BYTE_CAP}B)을 초과합니다 — pre-sized 썸네일만 허용(런타임 파생 없음): ${v.path}`);
    }
    if (!(await sidecarExists(abs))) {
      throw userError(`option ${opt.number}: imageFile에 sidecar(.license.txt, source/license)가 없습니다: ${v.path}`);
    }
    const buf = await readFile(abs);
    if (!magicMatches(buf, v.ext)) {
      throw userError(`option ${opt.number}: imageFile magic-byte가 확장자(${v.ext})와 불일치합니다(확장자-only 수용 금지): ${v.path}`);
    }
    v.dataUri = `data:${IMAGE_MIME[v.ext]};base64,${buf.toString('base64')}`;
  }
  return model;
}

// ─── inert HTML 빌더 ─────────────────────────────────────────────────────────

const BOARD_CSS = `
#dsiv-board-root{font:14px/1.5 system-ui,sans-serif;color:#1a1a1a;padding:16px;max-width:1100px;margin:0 auto}
#dsiv-board-root .dsiv-board-marker{font:11px/1.4 ui-monospace,monospace;color:#666;border:1px solid #ddd;border-radius:4px;padding:4px 8px;margin-bottom:12px;display:inline-block}
#dsiv-board-root .dsiv-board-q{font-size:16px;font-weight:600;margin:0 0 14px}
#dsiv-board-root .dsiv-board-grid{display:flex;flex-wrap:wrap;gap:12px;align-items:stretch}
#dsiv-board-root .dsiv-board-card{flex:1 1 220px;min-width:220px;max-width:280px;border:1px solid #ccc;border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px}
#dsiv-board-root .dsiv-board-num{font-weight:700}
#dsiv-board-root .dsiv-board-label{font-weight:600}
#dsiv-board-root .dsiv-board-rationale{font-size:12px;color:#555}
#dsiv-board-root .dsiv-board-badge{font-size:11px;color:#1a1a1a;border:1px solid #1a1a1a;border-radius:3px;padding:1px 5px;align-self:flex-start}
#dsiv-board-root .dsiv-board-recreason{font-size:11px;color:#555;font-style:italic}
#dsiv-board-root .dsiv-swatches{display:flex;gap:6px;flex-wrap:wrap}
#dsiv-board-root .dsiv-swatch{width:32px;height:32px;border-radius:3px;border:1px solid #0002}
#dsiv-board-root .dsiv-swatch-label{font-size:10px;color:#666;text-align:center}
#dsiv-board-root .dsiv-wire{display:flex;flex-direction:column;gap:4px}
#dsiv-board-root .dsiv-wire-block{background:#e7e7e7;border-radius:2px;height:14px}
#dsiv-board-root .dsiv-wire-label{font-size:10px;color:#666}
#dsiv-board-root .dsiv-chip{display:inline-block;font-size:11px;border:1px solid #ccc;border-radius:10px;padding:1px 8px;margin:2px 2px 0 0}
#dsiv-board-root .dsiv-chip-color{width:14px;height:14px;border-radius:50%;vertical-align:-2px;border:1px solid #0002}
#dsiv-board-root .dsiv-cta{display:inline-block;background:#1a1a1a;color:#fff;border-radius:4px;padding:6px 12px;font-size:13px}
#dsiv-board-root .dsiv-thumb{max-width:100%;height:auto;border:1px solid #ddd;border-radius:4px}
#dsiv-board-root .dsiv-plain{font-size:13px;color:#333}
#dsiv-board-root .dsiv-board-foot{font-size:12px;color:#666;margin-top:14px}
`.replace(/\n/g, '');

function renderVisual(visual) {
  switch (visual.type) {
    case 'swatches':
      return `<div class="dsiv-swatches">${visual.colors.map((c) => (
        `<div><div class="dsiv-swatch" style="background:${esc(c.hex)}"></div>${c.label ? `<div class="dsiv-swatch-label">${esc(c.label)}</div>` : ''}</div>`
      )).join('')}</div>`;
    case 'wire':
      return `<div class="dsiv-wire">${visual.blocks.map((b) => (
        `<div><div class="dsiv-wire-block" style="width:${30 + b.weight * 20}%"></div><div class="dsiv-wire-label">${esc(b.label)}</div></div>`
      )).join('')}</div>`;
    case 'moodChips':
      return `<div>${visual.chips.map((ch) => (
        ch.kind === 'color'
          ? `<span class="dsiv-chip"><span class="dsiv-chip-color" style="background:${esc(ch.value)}"></span> ${esc(ch.value)}</span>`
          : `<span class="dsiv-chip">${esc(ch.kind)}: ${esc(ch.value)}</span>`
      )).join('')}</div>`;
    case 'ctaSample':
      return `<div><span class="dsiv-cta">${esc(visual.text)}</span>${visual.note ? `<div class="dsiv-plain">${esc(visual.note)}</div>` : ''}</div>`;
    case 'imageFile':
      return `<img class="dsiv-thumb" alt="${esc(visual.alt)}" src="${visual.dataUri ?? ''}">`;
    case 'plain':
      return `<div class="dsiv-plain">${esc(visual.text)}</div>`;
    default:
      throw new BoardError(`알 수 없는 visual.type: ${visual.type}`, 'invariant');
  }
}

function renderCard(opt, isRecommended) {
  return `<div class="dsiv-board-card">
<div><span class="dsiv-board-num">${opt.number}.</span> <span class="dsiv-board-label">${esc(opt.label)}</span>${isRecommended ? ' <span class="dsiv-board-badge">추천 \u276f</span>' : ''}</div>
${renderVisual(opt.visual)}
<div class="dsiv-board-rationale">${esc(opt.rationale)}</div>
</div>`;
}

export function buildBoardHtml(model, { generatedAt = new Date().toISOString() } = {}) {
  if (!model || !Array.isArray(model.options)) throw new BoardError('buildBoardHtml: 유효한 board 모델이 필요합니다', 'invariant');
  const marker = `board:${esc(model.boardId)} \u00b7 round:${esc(model.roundId)} \u00b7 ${esc(generatedAt)} \u00b7 dim:${esc(model.dimension)}`;
  const cards = model.options.map((o) => renderCard(o, o.number === model.recommendedNumber)).join('\n');
  // 추천 근거는 카드 우위 없이 별도 한 줄로(작은 동급 배지 + 근거). preselect/크기 우위 없음.
  const recLine = model.recommendedNumber != null
    ? `<div class="dsiv-board-recreason">추천 ${model.recommendedNumber}번 — ${esc(model.recommendReason)} (의견일 뿐, 선택은 당신 몫)</div>`
    : '';
  // 직접 입력/없음 카드 — 다른 카드와 동등 가시성.
  const fallbackCard = `<div class="dsiv-board-card">
<div><span class="dsiv-board-num">\u2014</span> <span class="dsiv-board-label">직접 입력 / 없음·알아서</span></div>
<div class="dsiv-plain">보기에 없으면 채팅 질문에 자유 입력하세요. 답은 항상 채팅 질문에서 고릅니다.</div>
</div>`;

  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${INERT_CSP}">
<title>design-interview — 옵션 보드</title>
<style>${BOARD_CSS}</style>
</head><body><div id="dsiv-board-root">
<div class="dsiv-board-marker">${marker}</div>
<div class="dsiv-board-q">${esc(model.question)}</div>
<div class="dsiv-board-grid">
${cards}
${fallbackCard}
</div>
${recLine}
<div class="dsiv-board-foot">\uc774 \ubcf4\ub4dc\ub294 \ucc38\uace0\uc6a9 \uc2dc\uac01\uc785\ub2c8\ub2e4. \ub2f5\ubcc0\uc740 \ucc44\ud305 \uc9c8\ubb38(\ubc88\ud638)\uc73c\ub85c \uc120\ud0dd\ud558\uc138\uc694.</div>
</div></body></html>`;
  return html;
}

// ─── 파일 렌더(atomic write) ─────────────────────────────────────────────────

export async function renderBoardFile(optionsPath, outPath) {
  const absOptions = resolve(optionsPath);
  let raw;
  try {
    raw = await readFile(absOptions, 'utf8');
  } catch {
    throw userError(`options.json을 읽을 수 없습니다: ${optionsPath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw userError(`options.json이 유효한 JSON이 아닙니다: ${err.message}`);
  }
  const model = parseBoardOptions(parsed);
  await resolveBoardImages(model, dirname(absOptions));
  const html = buildBoardHtml(model);
  if (Buffer.byteLength(html, 'utf8') > TOTAL_HTML_CAP) {
    throw userError(`board HTML이 총 예산(${TOTAL_HTML_CAP}B)을 초과합니다 — 이미지/옵션 수를 줄이세요`);
  }
  const out = resolve(outPath);
  await atomicWrite(out, html);
  // url = 호스트(GJC/CC 등)가 브라우저로 열 'file://' 링크. 고정 경로라 라운드마다 동일.
  return { path: out, url: pathToFileURL(out).href, bytes: Buffer.byteLength(html, 'utf8') };
}

// same-dir unique temp + exclusive create(wx) + rename. 실패 시 기존 outPath 보존,
// temp는 best-effort 정리. 동시 2세션은 unique temp로 충돌을 피하고 rename은 last-writer-wins.
async function atomicWrite(outPath, content) {
  const tmp = `${outPath}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  try {
    await writeFile(tmp, content, { encoding: 'utf8', flag: 'wx' });
    await rename(tmp, outPath);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw userError(`board 파일 쓰기 실패(${outPath}): ${err.message}`);
  }
}

