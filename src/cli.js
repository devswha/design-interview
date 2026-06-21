#!/usr/bin/env node
// design-interview CLI — 검수 레인 진입점.
//
// 인터뷰/빌드는 스킬(SKILL.md)이 담당한다. CLI는 검수 산출물 생성만 한다.
// 에러 규율: 사용자 입력 문제(없는 파일 등)는 스택트레이스 없이 메시지 + exit 2,
// 감사 fail은 exit 1, 시각 레인 폴백은 puppeteer 미설치(ERR_PUPPETEER_MISSING)만.

import { readFile, writeFile, stat, readdir, open } from 'node:fs/promises';
import { constants as FS } from 'node:fs';
import { resolve } from 'node:path';
import { buildPreviewHtml } from './preview.js';
import { auditHtml, formatAuditReport, combineAudits } from './audit.js';
// 사용자가 준 경로(--out 등)에서 나오는 fs 입력 오류 → exit 2. 좁은 화이트리스트가
// ENAMETOOLONG/EPERM/EROFS/ELOOP를 놓쳐 입력오류를 실패(exit 1)로 잘못 분류하던 것을 넓힌다.
// (crawl.js의 동일 집합과 의도적으로 같은 값을 유지한다.)
const USER_FS_ERROR_CODES = new Set([
  'ENOENT', 'EISDIR', 'EACCES', 'ENOTDIR', 'ENAMETOOLONG', 'EPERM', 'EROFS', 'ELOOP',
]);

const READ_TIMEOUT_MS = 30000;
const MAX_INPUT_CHARS = 5 * 1024 * 1024;

// 예기치 못한 내부 예외는 입력 오류(exit 2)가 아니라 실패다 → exit 1. 스택트레이스는 내지 않는다.
function backstop(err) {
  console.error(err?.message ?? String(err));
  process.exit(1);
}

process.on('unhandledRejection', backstop);
process.on('uncaughtException', backstop);


function usage() {
  console.error(
    [
      'usage: design-interview <command>',
      '  intake  <file-or-url> [--json]  # 보존 클레임 추출 (URL은 SSRF 가드 통과 필수)',
      '  preview <built.html> [--against <slop.html>] [--out <file>]',
      '  audit   <page.html> [--visual]  # 결정론적 design-tell 감사 (exit 1 on fail)',
      '  shot    <page.html>            # desktop/mobile 풀페이지 캡처 (requires puppeteer)',
      '  assets  <dir> [--concept-sheet <path>] [--json]  # 에셋 advisory + prebuild readiness (입력오류만 exit 2)',
      '  crawl   <url> [--out <dir>] [--name <file>] [--json]  # consent-gated 외부 에셋 수집 (SSRF 가드; 사용자 허락 후)',
      '  board   <options.json> --out <file> [--serve [--port <n>]]  # 옵션 보드(inert HTML); --serve는 file:// 차단 호스트용 localhost 서빙',
    ].join('\n'),
  );
  process.exit(2);
}

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

// 비-일반 파일(FIFO/파이프/프로세스 치환)을 O_NONBLOCK으로 읽는다. 일반 readFile은
// FIFO open()이 libuv 스레드풀에서 writer를 기다리며 묶여 AbortSignal·process.exit로도
// 못 깨는다(무한 행). O_NONBLOCK open은 writer 없이도 즉시 반환하므로 스트림 타임아웃이
// 실제로 발동·종료할 수 있다. writer 있는 stdin/process substitution은 그대로 읽힌다.
function readNonRegular(resolvedPath) {
  return open(resolvedPath, FS.O_RDONLY | FS.O_NONBLOCK).then((fh) => new Promise((resolvePromise, reject) => {
    const stream = fh.createReadStream({ encoding: 'utf8' });
    let out = '';
    let settled = false;
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stream.destroy();
      fh.close().catch(() => {});
      fn(arg);
    };
    const timer = setTimeout(
      () => finish(reject, Object.assign(new Error('read timed out'), { code: 'ERR_READ_TIMEOUT' })),
      READ_TIMEOUT_MS,
    );
    stream.on('data', (chunk) => { out += chunk; if (out.length >= MAX_INPUT_CHARS) finish(resolvePromise, out.slice(0, MAX_INPUT_CHARS)); });
    stream.on('end', () => finish(resolvePromise, out));
    stream.on('error', (err) => finish(reject, err));
  }));
}

async function readInput(path) {
  const resolvedPath = resolve(path);
  try {
    const inputStat = await stat(resolvedPath);
    if (inputStat.isDirectory()) fail(`cannot read ${path}: is a directory`);
    // 일반 파일은 그대로 읽고, FIFO/파이프/프로세스 치환(/dev/stdin, /proc/self/fd/N)은
    // O_NONBLOCK 경로로 읽어 writer 없는 FIFO의 무한 행을 타임아웃으로 끊는다.
    const data = inputStat.isFile()
      ? await readFile(resolvedPath, 'utf8')
      : await readNonRegular(resolvedPath);
    // 처리 단계(audit/intake) 보호용 방어 캡 — 과대 입력을 자른다.
    return data.length > MAX_INPUT_CHARS ? data.slice(0, MAX_INPUT_CHARS) : data;
  } catch (err) {
    if (err.code === 'ERR_READ_TIMEOUT') fail(`cannot read ${path}: read timed out (${READ_TIMEOUT_MS}ms)`);
    if (err.code === 'ENOENT') fail(`cannot read ${path}: no such file`);
    if (err.code === 'EISDIR') fail(`cannot read ${path}: is a directory`);
    fail(`cannot read ${path}: ${err.message}`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
if (!['intake', 'preview', 'audit', 'shot', 'assets', 'crawl', 'board'].includes(cmd) || rest.length === 0) usage();

if (cmd === 'intake') {
  const json = rest.includes('--json');
  const target = rest.filter((a) => a !== '--json')[0];
  if (!target) usage();
  const { extractClaims, buildClaimTable, fetchSource, looksLikeUrl } = await import('./intake.js');
  let source;
  // scheme:// 형태는 전부 URL 가드로 — ftp:// 등이 파일 경로로 새면 안 된다.
  if (looksLikeUrl(target)) {
    try {
      source = await fetchSource(target);
    } catch (err) {
      fail(`intake failed: ${err.message}`, 1);
    }
  } else {
    source = await readInput(target);
  }
  const result = extractClaims(source);
  console.log(json ? JSON.stringify(result, null, 2) : buildClaimTable(result, { source: target }));
  process.exit(0);
}

if (cmd === 'audit') {
  const visual = rest.includes('--visual');
  const files = rest.filter((a) => a !== '--visual');
  if (!files[0]) usage();
  const file = resolve(files[0]);
  let result = auditHtml(await readInput(file));
  if (visual) {
    const { analyzeVisualTells } = await import('./geometry.js');
    try {
      result = combineAudits(result, await analyzeVisualTells(file));
    } catch (err) {
      // 폴백은 미설치 단 하나. 렌더 크래시 등 다른 시각 레인 에러를
      // 정적 전용으로 강등하면 감사 결과가 조용히 약해진다 — 즉시 실패.
      if (err.code !== 'ERR_PUPPETEER_MISSING') fail(`visual lane failed: ${err.message}`, 1);
      console.error(`visual lane skipped: ${err.message}\n`);
    }
  }
  console.log(formatAuditReport(result, { source: files[0] }));
  process.exit(result.pass ? 0 : 1);
}

if (cmd === 'shot') {
  const { captureFile } = await import('./screenshot.js');
  const files = rest.filter((a) => !a.startsWith('-'));
  if (!files[0]) usage();
  try {
    const shots = await captureFile(files[0]);
    for (const s of shots) console.log(`${s.viewport}\t${s.path}`);
    process.exit(0);
  } catch (err) {
    fail(err.message, 1);
  }
}

if (cmd === 'assets') {
  const json = rest.includes('--json');
  const positional = [];
  let conceptSheetPath;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--json') continue;
    else if (rest[i] === '--concept-sheet') {
      conceptSheetPath = rest[++i];
      if (conceptSheetPath === undefined || conceptSheetPath.startsWith('--')) fail('--concept-sheet requires a path', 2);
    }
    else positional.push(rest[i]);
  }
  const dir = positional[0];
  if (!dir) usage();
  const resolvedDir = resolve(dir);
  let dirStat;
  try {
    dirStat = await stat(resolvedDir);
  } catch (err) {
    fail(`cannot read ${dir}: ${err.message}`, 2);
  }
  if (!dirStat.isDirectory()) fail(`cannot read ${dir}: not a directory`, 2);
  // 인자 디렉터리 자체를 읽을 수 없으면(권한 등) 입력 오류로 exit 2.
  // (중첩 하위 디렉터리의 읽기 실패는 auditAssets에서 best-effort로 skip한다.)
  try {
    await readdir(resolvedDir);
  } catch (err) {
    fail(`cannot read ${dir}: ${err.message}`, 2);
  }
  const { auditAssets, formatAssetReport } = await import('./assets.js');
  const opts = {};
  if (conceptSheetPath) opts.conceptSheetPath = resolve(conceptSheetPath);
  const report = await auditAssets(resolvedDir, opts);
  console.log(json ? JSON.stringify(report, null, 2) : formatAssetReport(report));
  process.exit(0);
}

if (cmd === 'crawl') {
  const json = rest.includes('--json');
  let outDir = 'assets/images';
  let name;
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--json') continue;
    else if (rest[i] === '--out') {
      outDir = rest[++i];
      if (outDir === undefined || outDir.startsWith('--')) fail('--out requires a path', 2);
    } else if (rest[i] === '--name') {
      name = rest[++i];
      if (name === undefined || name.startsWith('--')) fail('--name requires a value', 2);
    } else positional.push(rest[i]);
  }
  const url = positional[0];
  if (!url) usage();
  // consent-gated: 실제 수집 여부는 호출 전 사용자 허락을 받는다(SKILL.md). 명령은 실행자다.
  console.error('주의: consent-gated 외부 수집 — 사용자 허락 후에만 실행. license는 sidecar에서 수동 확인.');
  const { crawlAsset } = await import('./crawl.js');
  let result;
  try {
    result = await crawlAsset(url, { outDir: resolve(outDir), name });
  } catch (err) {
    if (err.userError) fail(err.message, 2); // URL 아님·파일명 추론 불가 등 입력 오류
    fail(`crawl failed: ${err.message}`, 1); // SSRF 차단·fetch 실패·캡 초과
  }
  console.log(json ? JSON.stringify(result, null, 2) : `${result.filePath}\n${result.sidecarPath}`);
  process.exit(0);
}

if (cmd === 'board') {
  const { renderBoardFile, serveBoardFile, BoardError } = await import('./board.js');
  let outPath;
  let serve = false;
  let port = 0;
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--out') {
      outPath = rest[++i];
      if (outPath === undefined || outPath.startsWith('--')) fail('--out requires a path', 2);
    } else if (rest[i] === '--serve') {
      serve = true;
    } else if (rest[i] === '--port') {
      const v = rest[++i];
      if (v === undefined || v.startsWith('--')) fail('--port requires a number', 2);
      port = Number(v);
      if (!Number.isInteger(port) || port < 1 || port > 65535) fail('--port must be an integer 1..65535', 2);
    } else positional.push(rest[i]);
  }
  const optionsPath = positional[0];
  if (!optionsPath || positional.length !== 1 || !outPath) usage();
  try {
    const res = await renderBoardFile(optionsPath, outPath);
    if (serve) {
      // file://를 막는 호스트(Codex 데스크톱 등, #33)용: 같은 board를 localhost로 띄우고 살아있는다.
      const srv = await serveBoardFile(res.path, { port });
      console.log(srv.url); // http://127.0.0.1:<port>/ — 보드 표면. Ctrl-C로 종료.
      const shutdown = () => srv.server.close(() => process.exit(0));
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      // 서버 수명 동안 top-level await를 여기서 정지한다 — 아래 기본 preview 디스패치로
      // 빠지지 않게(non-serve board는 exit(0)로 처리). 종료는 SIGINT/SIGTERM 핸들러가 한다.
      await new Promise(() => {});
    } else {
      console.log(res.url); // file:// 링크 — file://를 여는 호스트(GJC/CC)용 보드 링크
      process.exit(0);
    }
  } catch (err) {
    // 입력·스키마·없는 asset·sidecar 누락·예산 초과·쓰기 불가 = exit 2; 렌더러 invariant = exit 1.
    if (err instanceof BoardError) fail(err.message, err.kind === 'invariant' ? 1 : 2);
    if (USER_FS_ERROR_CODES.has(err.code)) fail(err.message, 2);
    fail(`board failed: ${err.message}`, 1);
  }
}

const args = { _: [] };
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--against') {
    args.against = rest[++i];
    if (args.against === undefined || args.against.startsWith('--')) fail('--against requires a path', 2);
  } else if (rest[i] === '--out') {
    args.out = rest[++i];
    if (args.out === undefined || args.out.startsWith('--')) fail('--out requires a path', 2);
  } else args._.push(rest[i]);
}
if (args._.length !== 1) usage();

const builtPath = resolve(args._[0]);
const builtHtml = await readInput(builtPath);
const originalHtml = args.against ? await readInput(args.against) : null;
const outPath = resolve(args.out ?? builtPath.replace(/\.html?$/i, '') + '.preview.html');

try {
  const preview = buildPreviewHtml({ builtHtml, originalHtml, title: `preview — ${args._[0]}` });
  await writeFile(outPath, preview, 'utf8');
} catch (err) {
  if (USER_FS_ERROR_CODES.has(err.code)) fail(`cannot write ${outPath}: ${err.message}`, 2);
  fail(err.message, 2);
}
console.log(outPath);
