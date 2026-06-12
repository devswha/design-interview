#!/usr/bin/env node
// design-interview CLI — Phase 4 프리뷰 진입점.
//
//   design-interview preview <built.html> [--against <slop.html>] [--out <file>]
//
// 인터뷰/빌드는 스킬(SKILL.md)이 담당한다. CLI는 검수 산출물 생성만 한다.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildPreviewHtml } from './preview.js';

function usage() {
  console.error('usage: design-interview preview <built.html> [--against <slop.html>] [--out <file>]');
  process.exit(2);
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd !== 'preview' || rest.length === 0) usage();

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
