#!/usr/bin/env node
// design-interview CLI — Phase 4 프리뷰 진입점.
//
//   design-interview preview <built.html> [--against <slop.html>] [--out <file>]
//
// 인터뷰/빌드는 스킬(SKILL.md)이 담당한다. CLI는 검수 산출물 생성만 한다.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildPreviewHtml } from './preview.js';
import { auditHtml, formatAuditReport, combineAudits } from './audit.js';

function usage() {
  console.error(`usage: design-interview <command>
  preview <built.html> [--against <slop.html>] [--out <file>]
  audit   <page.html> [--visual]  # 결정론적 design-tell 감사 (exit 1 on fail)
  shot    <page.html>            # desktop/mobile 풀페이지 캡처 (requires puppeteer)`);
  process.exit(2);
}

const [cmd, ...rest] = process.argv.slice(2);
if (!['preview', 'audit', 'shot'].includes(cmd) || rest.length === 0) usage();

if (cmd === 'audit') {
  const visual = rest.includes('--visual');
  const files = rest.filter((a) => a !== '--visual');
  const file = resolve(files[0]);
  let result = auditHtml(await readFile(file, 'utf8'));
  if (visual) {
    const { analyzeVisualTells } = await import('./geometry.js');
    try {
      result = combineAudits(result, await analyzeVisualTells(file));
    } catch (err) {
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
    console.error(err.message);
    process.exit(1);
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
const builtHtml = await readFile(builtPath, 'utf8');
const originalHtml = args.against ? await readFile(resolve(args.against), 'utf8') : null;

const preview = buildPreviewHtml({ builtHtml, originalHtml, title: `preview — ${args._[0]}` });
const outPath = resolve(args.out ?? builtPath.replace(/\.html?$/i, '') + '.preview.html');
await writeFile(outPath, preview, 'utf8');
console.log(outPath);
