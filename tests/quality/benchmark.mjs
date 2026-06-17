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
  let html;
  try {
    html = await readFile(resolve(root, path), 'utf8');
  } catch (err) {
    regressions++;
    const message = err?.code === 'ENOENT'
      ? 'fixture missing; update baseline.json'
      : `fixture unreadable (${err?.code ?? err?.message ?? 'unknown error'}); update baseline.json`;
    rows.push({ path, expected: '-', actual: '-', miss: [], fp: [], ok: false, message });
    continue;
  }
  const actual = auditHtml(html).failed; // 전체 failed(blocking∪advisory) — 탐지기 정확도 게이트
  // baseline은 {expectedBlocking, expectedAdvisory}로 분할 표기하되 비교는 합집합(레거시 .failed도 수용).
  const expectedFailed = expected.failed ?? [...(expected.expectedBlocking ?? []), ...(expected.expectedAdvisory ?? [])];
  const want = new Set(expectedFailed);
  const got = new Set(actual);
  const miss = expectedFailed.filter((id) => !got.has(id));
  const fp = actual.filter((id) => !want.has(id));
  const ok = miss.length === 0 && fp.length === 0;
  if (!ok) regressions++;
  rows.push({ path, expected: expectedFailed.join(',') || '-', actual: actual.join(',') || '-', miss, fp, ok });
}

console.log('design-interview benchmark — machine audit vs baseline\n');
for (const r of rows) {
  console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.path}${r.message ? ` — ${r.message}` : ''}`);
  console.log(`     expected: [${r.expected}]  actual: [${r.actual}]`);
  if (r.miss.length) console.log(`     miss (탐지 후퇴): ${r.miss.join(', ')}`);
  if (r.fp.length) console.log(`     fp (오탐 후퇴): ${r.fp.join(', ')}`);
}
console.log(`\n${rows.length - regressions}/${rows.length} fixtures match baseline`);

if (regressions) {
  console.error('\nregression detected — 의도된 변화라면 tests/quality/baseline.json을 갱신하라');
  process.exit(1);
}
