// M2 회귀 게이트 — baseline.json 대비 기계 감사 판정을 비교한다.
//
//   npm run benchmark
//
// 회귀 두 종류를 모두 잡는다:
//   miss: baseline이 기대한 fail을 못 잡음 (탐지력 후퇴)
//   fp:   baseline에 없는 fail이 새로 생김 (오탐 후퇴 — clean 픽스처 보호)
// 어느 쪽이든 exit 1. 의도된 변화면 baseline을 같은 커밋에서 갱신한다.

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditHtml } from '../../src/audit.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const baseline = JSON.parse(await readFile(resolve(root, 'tests/quality/baseline.json'), 'utf8'));

let regressions = 0;
const rows = [];

for (const [path, expected] of Object.entries(baseline.fixtures)) {
  const html = await readFile(resolve(root, path), 'utf8');
  const actual = auditHtml(html).failed;
  const want = new Set(expected.failed);
  const got = new Set(actual);
  const miss = expected.failed.filter((id) => !got.has(id));
  const fp = actual.filter((id) => !want.has(id));
  const ok = miss.length === 0 && fp.length === 0;
  if (!ok) regressions++;
  rows.push({ path, expected: expected.failed.join(',') || '-', actual: actual.join(',') || '-', miss, fp, ok });
}

console.log('design-interview benchmark — machine audit vs baseline\n');
for (const r of rows) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.path}`);
  console.log(`     expected: [${r.expected}]  actual: [${r.actual}]`);
  if (r.miss.length) console.log(`     miss (탐지 후퇴): ${r.miss.join(', ')}`);
  if (r.fp.length) console.log(`     fp (오탐 후퇴): ${r.fp.join(', ')}`);
}
console.log(`\n${rows.length - regressions}/${rows.length} fixtures match baseline`);

if (regressions) {
  console.error('\nregression detected — 의도된 변화라면 tests/quality/baseline.json을 갱신하라');
  process.exit(1);
}
