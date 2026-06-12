#!/usr/bin/env node
// design-interview CLI — 검수 레인 진입점.
//
// 인터뷰/빌드는 스킬(SKILL.md)이 담당한다. CLI는 검수 산출물 생성만 한다.
// 에러 규율: 사용자 입력 문제(없는 파일 등)는 스택트레이스 없이 메시지 + exit 2,
// 감사 fail은 exit 1, 시각 레인 폴백은 puppeteer 미설치(ERR_PUPPETEER_MISSING)만.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildPreviewHtml } from './preview.js';
import { auditHtml, formatAuditReport, combineAudits } from './audit.js';

function usage() {
  console.error(`usage: design-interview <command>
  intake  <file-or-url> [--json]  # 보존 클레임 추출 (URL은 SSRF 가드 통과 필수)
  preview <built.html> [--against <slop.html>] [--out <file>]
  audit   <page.html> [--visual]  # 결정론적 design-tell 감사 (exit 1 on fail)
  shot    <page.html>            # desktop/mobile 풀페이지 캡처 (requires puppeteer)`);
  process.exit(2);
}

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

async function readInput(path) {
  try {
    return await readFile(resolve(path), 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') fail(`cannot read ${path}: no such file`);
    if (err.code === 'EISDIR') fail(`cannot read ${path}: is a directory`);
    fail(`cannot read ${path}: ${err.message}`);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
if (!['intake', 'preview', 'audit', 'shot'].includes(cmd) || rest.length === 0) usage();

if (cmd === 'intake') {
  const json = rest.includes('--json');
  const target = rest.filter((a) => a !== '--json')[0];
  const { extractClaims, buildClaimTable, fetchSource } = await import('./intake.js');
  let source;
  if (/^https?:\/\//i.test(target)) {
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
  try {
    const shots = await captureFile(rest[0]);
    for (const s of shots) console.log(`${s.viewport}\t${s.path}`);
    process.exit(0);
  } catch (err) {
    fail(err.message, 1);
  }
}

const args = { _: [] };
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--against') args.against = rest[++i];
  else if (rest[i] === '--out') args.out = rest[++i];
  else args._.push(rest[i]);
}
if (args._.length !== 1) usage();

const builtPath = resolve(args._[0]);
const builtHtml = await readInput(builtPath);
const originalHtml = args.against ? await readInput(args.against) : null;

const preview = buildPreviewHtml({ builtHtml, originalHtml, title: `preview — ${args._[0]}` });
const outPath = resolve(args.out ?? builtPath.replace(/\.html?$/i, '') + '.preview.html');
await writeFile(outPath, preview, 'utf8');
console.log(outPath);
