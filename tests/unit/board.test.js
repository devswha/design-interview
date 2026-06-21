import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseBoardOptions,
  resolveBoardImages,
  buildBoardHtml,
  renderBoardFile,
  CORE_DIMENSIONS,
  VISUAL_TYPES,
  BoardError,
} from '../../src/board.js';
import { fixturePath } from '../helpers/index.js';

// ── 유효 기본 모델 ───────────────────────────────────────────────────────────
function baseOptions(overrides = {}) {
  return {
    schemaVersion: 1,
    boardId: 'sess-1',
    roundId: 'r3',
    dimension: 'mood',
    question: '어떤 분위기로 갈까요?',
    recommendedNumber: 1,
    recommendReason: '소스의 절제된 톤 때문에',
    options: [
      { number: 1, label: '일본 문구점', rationale: '절제·격자', visual: { type: 'moodChips', chips: [{ kind: 'color', value: '#e8e2d0' }, { kind: 'type', value: 'serif' }] } },
      { number: 2, label: '개발자 터미널', rationale: '다크·모노', visual: { type: 'swatches', colors: [{ hex: '#111', label: 'bg' }, { hex: '#3fb950' }] } },
      { number: 3, label: '첫 화면 구조', rationale: '우선순위', visual: { type: 'wire', blocks: [{ label: '헤드라인', weight: 3 }, { label: 'CTA', weight: 1 }] } },
      { number: 4, label: 'CTA 문구', rationale: '단일 전환', visual: { type: 'ctaSample', text: '무료로 시작' } },
    ],
    ...overrides,
  };
}

// ── 스키마 reject 매트릭스 ───────────────────────────────────────────────────
const rejects = [
  ['루트 비객체', () => parseBoardOptions(null)],
  ['schemaVersion 누락', () => parseBoardOptions(baseOptions({ schemaVersion: undefined }))],
  ['schemaVersion 미지원', () => parseBoardOptions(baseOptions({ schemaVersion: 2 }))],
  ['boardId 누락', () => parseBoardOptions(baseOptions({ boardId: '' }))],
  ['roundId 누락', () => parseBoardOptions(baseOptions({ roundId: undefined }))],
  ['dimension 비-core(palette)', () => parseBoardOptions(baseOptions({ dimension: 'palette' }))],
  ['dimension 비-core(asset)', () => parseBoardOptions(baseOptions({ dimension: 'asset' }))],
  ['question 빈 문자열', () => parseBoardOptions(baseOptions({ question: '  ' }))],
  ['options 빈 배열', () => parseBoardOptions(baseOptions({ options: [] }))],
  ['options number 중복', () => parseBoardOptions(baseOptions({ options: [
    { number: 1, label: 'a', rationale: 'x', visual: { type: 'plain', text: 't' } },
    { number: 1, label: 'b', rationale: 'y', visual: { type: 'plain', text: 'u' } },
  ] }))],
  ['recommendedNumber 미존재 옵션', () => parseBoardOptions(baseOptions({ recommendedNumber: 99 }))],
  ['추천 있는데 근거 없음', () => parseBoardOptions(baseOptions({ recommendReason: '' }))],
  ['추천 null인데 근거 있음', () => parseBoardOptions(baseOptions({ recommendedNumber: null, recommendReason: '근거' }))],
  ['visual.type 미지원', () => parseBoardOptions(baseOptions({ options: [{ number: 1, label: 'a', rationale: 'x', visual: { type: 'chart' } }] }))],
  ['swatches 비-hex(그라데이션)', () => parseBoardOptions(baseOptions({ options: [{ number: 1, label: 'a', rationale: 'x', visual: { type: 'swatches', colors: [{ hex: 'linear-gradient(#a,#b)' }] } }] }))],
  ['moodChips 개수 위반(1개)', () => parseBoardOptions(baseOptions({ options: [{ number: 1, label: 'a', rationale: 'x', visual: { type: 'moodChips', chips: [{ kind: 'type', value: 'serif' }] } }] }))],
  ['imageFile 잘못된 확장자', () => parseBoardOptions(baseOptions({ options: [{ number: 1, label: 'a', rationale: 'x', visual: { type: 'imageFile', path: 'x.gif', alt: 'a', kind: 'reference' } }] }))],
];

for (const [name, fn] of rejects) {
  test(`parseBoardOptions reject: ${name}`, () => {
    assert.throws(fn, (e) => e instanceof BoardError && e.kind === 'user', name);
  });
}

test('parseBoardOptions accepts a valid model and normalizes meta', () => {
  const m = parseBoardOptions(baseOptions({ questionKind: 'choice', visualRole: 'mood', asset: null }));
  assert.equal(m.schemaVersion, 1);
  assert.equal(m.dimension, 'mood');
  assert.equal(m.recommendedNumber, 1);
  assert.equal(m.options.length, 4);
  assert.equal(m.meta.questionKind, 'choice');
  assert.ok(CORE_DIMENSIONS.includes(m.dimension));
});

test('parseBoardOptions allows recommendedNumber null with no reason', () => {
  const m = parseBoardOptions(baseOptions({ recommendedNumber: null, recommendReason: null }));
  assert.equal(m.recommendedNumber, null);
  assert.equal(m.recommendReason, null);
});

// ── 이미지 정책 (magic-byte / sidecar / 예산) ────────────────────────────────
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]);

async function imgFixture() {
  const dir = await mkdtemp(join(tmpdir(), 'board-img-'));
  await writeFile(join(dir, 'real.png'), PNG);
  await writeFile(join(dir, 'real.png.license.txt'), 'source: 자작\nlicense: CC0\n');
  await writeFile(join(dir, 'nosidecar.png'), PNG);
  await writeFile(join(dir, 'fake.png'), Buffer.from('not a png at all')); // 확장자 png, 시그니처 불일치
  await writeFile(join(dir, 'fake.png.license.txt'), 'source: 자작\n');
  await writeFile(join(dir, 'big.png'), Buffer.concat([PNG, Buffer.alloc(300 * 1024)])); // > per-image cap
  await writeFile(join(dir, 'big.png.license.txt'), 'source: 자작\n');
  return dir;
}

function imgModel(dir, file) {
  return parseBoardOptions(baseOptions({
    recommendedNumber: null, recommendReason: null,
    options: [{ number: 1, label: '참고 화면', rationale: '레이아웃', visual: { type: 'imageFile', path: file, alt: '참고', kind: 'reference' } }],
  }));
}

test('resolveBoardImages embeds a valid pre-sized file with sidecar', async () => {
  const dir = await imgFixture();
  const m = await resolveBoardImages(imgModel(dir, 'real.png'), dir);
  assert.match(m.options[0].visual.dataUri, /^data:image\/png;base64,/);
});

test('resolveBoardImages rejects missing sidecar', async () => {
  const dir = await imgFixture();
  await assert.rejects(resolveBoardImages(imgModel(dir, 'nosidecar.png'), dir), (e) => e instanceof BoardError && /sidecar/.test(e.message));
});

test('resolveBoardImages rejects magic-byte mismatch (extension-only forbidden)', async () => {
  const dir = await imgFixture();
  await assert.rejects(resolveBoardImages(imgModel(dir, 'fake.png'), dir), (e) => e instanceof BoardError && /magic-byte/.test(e.message));
});

test('resolveBoardImages rejects over per-image byte budget (no runtime thumbnail derivation)', async () => {
  const dir = await imgFixture();
  await assert.rejects(resolveBoardImages(imgModel(dir, 'big.png'), dir), (e) => e instanceof BoardError && /예산/.test(e.message));
});

test('resolveBoardImages rejects a missing file', async () => {
  const dir = await imgFixture();
  await assert.rejects(resolveBoardImages(imgModel(dir, 'ghost.png'), dir), (e) => e instanceof BoardError && /찾을 수 없/.test(e.message));
});

test('resolveBoardImages accepts jpeg and webp by magic bytes', async () => {
  const dir = await imgFixture();
  await writeFile(join(dir, 'p.jpg'), JPEG);
  await writeFile(join(dir, 'p.jpg.license.txt'), 'source: 자작\n');
  await writeFile(join(dir, 'p.webp'), WEBP);
  await writeFile(join(dir, 'p.webp.license.txt'), 'source: 자작\n');
  const mj = await resolveBoardImages(imgModel(dir, 'p.jpg'), dir);
  assert.match(mj.options[0].visual.dataUri, /^data:image\/jpeg;base64,/);
  const mw = await resolveBoardImages(imgModel(dir, 'p.webp'), dir);
  assert.match(mw.options[0].visual.dataUri, /^data:image\/webp;base64,/);
});

// ── HTML 빌더 ────────────────────────────────────────────────────────────────
test('buildBoardHtml renders every visual.type and is inert', () => {
  const m = parseBoardOptions(baseOptions());
  const html = buildBoardHtml(m, { generatedAt: '2026-06-19T00:00:00.000Z' });
  // inert 단언
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /<iframe/i);
  assert.doesNotMatch(html, /https?:\/\//i); // 원격 리소스 없음
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /script-src 'none'/);
  assert.match(html, /img-src data:/);
  // visual.type별 마크업
  assert.match(html, /dsiv-chip/);     // moodChips
  assert.match(html, /dsiv-swatch/);   // swatches
  assert.match(html, /dsiv-wire/);     // wire
  assert.match(html, /dsiv-cta/);      // ctaSample
});

test('buildBoardHtml shows a visible stale marker (boardId/roundId/generatedAt)', () => {
  const html = buildBoardHtml(parseBoardOptions(baseOptions()), { generatedAt: '2026-06-19T00:00:00.000Z' });
  assert.match(html, /board:sess-1/);
  assert.match(html, /round:r3/);
  assert.match(html, /2026-06-19T00:00:00\.000Z/);
});

test('buildBoardHtml card numbers match option numbers and include direct-input card', () => {
  const html = buildBoardHtml(parseBoardOptions(baseOptions()));
  assert.match(html, />1\.</);
  assert.match(html, />4\.</);
  assert.match(html, /직접 입력 \/ 없음/);
});

test('recommend badge marks only the recommended card with no preselect or size advantage', () => {
  const html = buildBoardHtml(parseBoardOptions(baseOptions({ recommendedNumber: 2 })));
  const badges = html.match(/<span class="dsiv-board-badge">/g) ?? [];
  assert.equal(badges.length, 1, '추천 배지 span은 정확히 하나');
  // 카드 스타일/순서 우위 없음: 추천 카드도 동일한 dsiv-board-card 클래스, preselect/checked 없음
  assert.doesNotMatch(html, /checked|selected|aria-selected/i);
  assert.match(html, /의견일 뿐/); // 근거 라인이 수렴 금지 문구 포함
});

test('buildBoardHtml escapes user text (no markup injection)', () => {
  const m = parseBoardOptions(baseOptions({ question: '<img src=x onerror=alert(1)>', options: [
    { number: 1, label: '<script>evil()</script>', rationale: '"quote" & <b>', visual: { type: 'plain', text: 'ok' } },
  ], recommendedNumber: null, recommendReason: null }));
  const html = buildBoardHtml(m);
  assert.doesNotMatch(html, /<script>evil/i);
  assert.doesNotMatch(html, /<img[^>]*onerror/i); // 실제 img 태그+onerror 주입 없음(escape됨)
  assert.match(html, /&lt;script&gt;/);
});

// ── anti-tell 레드팀 ─────────────────────────────────────────────────────────
test('anti-tell: wire renders abstract blocks only — no node/line/arrow (S6) markup', () => {
  const html = buildBoardHtml(parseBoardOptions(baseOptions()));
  assert.doesNotMatch(html, /<svg|<path|<line|<polyline|<marker|→|↦|⟶/);
});

test('anti-tell: swatches reject gradient values at parse (C1 avoidance)', () => {
  assert.throws(() => parseBoardOptions(baseOptions({ options: [
    { number: 1, label: 'g', rationale: 'x', visual: { type: 'swatches', colors: [{ hex: 'linear-gradient(90deg,#a0f,#40f)' }] } },
  ] })), (e) => e instanceof BoardError);
});

test('anti-tell: imageFile without sidecar is rejected (S2 fake reality)', async () => {
  const dir = await imgFixture();
  await assert.rejects(resolveBoardImages(imgModel(dir, 'nosidecar.png'), dir), (e) => e instanceof BoardError);
});

// ── renderBoardFile atomic write ─────────────────────────────────────────────
test('renderBoardFile writes inert HTML to out path', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'board-render-'));
  const optionsPath = join(dir, 'opts.json');
  const outPath = join(dir, 'board.html');
  await writeFile(optionsPath, JSON.stringify(baseOptions()));
  const res = await renderBoardFile(optionsPath, outPath);
  assert.equal(res.path, outPath);
  const html = await readFile(outPath, 'utf8');
  assert.match(html, /dsiv-board-root/);
  assert.doesNotMatch(html, /<script/i);
});

test('renderBoardFile preserves the existing out file when validation fails', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'board-atomic-'));
  const optionsPath = join(dir, 'opts.json');
  const outPath = join(dir, 'board.html');
  await writeFile(outPath, '<!-- SENTINEL PRIOR BOARD -->');
  await writeFile(optionsPath, JSON.stringify(baseOptions({ dimension: 'palette' }))); // invalid → reject
  await assert.rejects(renderBoardFile(optionsPath, outPath), (e) => e instanceof BoardError);
  const kept = await readFile(outPath, 'utf8');
  assert.equal(kept, '<!-- SENTINEL PRIOR BOARD -->', '검증 실패 시 기존 파일 보존');
});

test('renderBoardFile rejects malformed JSON cleanly', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'board-json-'));
  const optionsPath = join(dir, 'opts.json');
  await writeFile(optionsPath, '{ not json');
  await assert.rejects(renderBoardFile(optionsPath, join(dir, 'b.html')), (e) => e instanceof BoardError && /JSON/.test(e.message));
});

test('VISUAL_TYPES is the locked discriminated union', () => {
  assert.deepEqual(VISUAL_TYPES, ['swatches', 'wire', 'moodChips', 'ctaSample', 'imageFile', 'plain']);
});

// ── per-option 메타 retain / 선택 필드 (architect gate blocker 1) ──────────────
test('parseBoardOptions retains per-option visualRole and asset (not scoring dimension)', () => {
  const m = parseBoardOptions(baseOptions({ options: [
    { number: 1, label: 'a', rationale: 'x', visualRole: 'mood-anchor', asset: 'logo.png', visual: { type: 'plain', text: 't' } },
  ], recommendedNumber: null, recommendReason: null }));
  assert.equal(m.options[0].visualRole, 'mood-anchor');
  assert.equal(m.options[0].asset, 'logo.png');
  // dimension은 여전히 6 core만
  assert.ok(CORE_DIMENSIONS.includes(m.dimension));
});

test('moodChips chips may carry an optional label', () => {
  const m = parseBoardOptions(baseOptions({ options: [
    { number: 1, label: 'a', rationale: 'x', visual: { type: 'moodChips', chips: [{ kind: 'type', value: 'serif', label: '본문' }, { kind: 'texture', value: 'paper' }] } },
  ], recommendedNumber: null, recommendReason: null }));
  assert.equal(m.options[0].visual.chips[0].label, '본문');
});

test('imageFile.kind is optional (omitted accepted)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'board-kindopt-'));
  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  await writeFile(join(dir, 'k.png'), PNG);
  await writeFile(join(dir, 'k.png.license.txt'), 'source: 자작\n');
  const m = parseBoardOptions(baseOptions({
    recommendedNumber: null, recommendReason: null,
    options: [{ number: 1, label: '참고', rationale: 'x', visual: { type: 'imageFile', path: 'k.png', alt: 'a' } }],
  }));
  assert.equal(m.options[0].visual.kind, null);
  const resolved = await resolveBoardImages(m, dir);
  assert.match(resolved.options[0].visual.dataUri, /^data:image\/png;base64,/);
});

// ── 커밋된 fixture로 end-to-end 렌더 (architect gate blocker 2: tests/fixtures/board) ──
test('renderBoardFile renders the committed tests/fixtures/board fixture', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'board-fixture-'));
  const out = join(dir, 'board.html');
  const res = await renderBoardFile(fixturePath('board/options.valid.json'), out);
  assert.equal(res.path, out);
  const html = await readFile(out, 'utf8');
  assert.match(html, /id="dsiv-board-root"/);
  assert.match(html, /data:image\/png;base64,/); // imageFile 임베드
  assert.match(html, /dsiv-wire/); // wire 렌더
  assert.match(html, /board:fix-sess/);
  assert.doesNotMatch(html, /<script/i);
});

test('renderBoardFile returns a file:// url for the host (GJC/CC) to open', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'board-url-'));
  const out = join(dir, 'board.html');
  await writeFile(join(dir, 'o.json'), JSON.stringify(baseOptions({ recommendedNumber: null, recommendReason: null })));
  const res = await renderBoardFile(join(dir, 'o.json'), out);
  assert.match(res.url, /^file:\/\//);
  assert.ok(res.url.endsWith('board.html'), res.url);
  assert.equal(res.path, out);
});
