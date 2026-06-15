import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { repoUrl } from '../helpers/index.js';

const readRepoFile = (path) => readFile(repoUrl(path), 'utf8');

test('reference source policy defines trusted sources, use policy, and copy bans', async () => {
  const doc = await readRepoFile('core/reference-sources.md');

  assert.match(doc, /awesome-design-md/);
  assert.match(doc, /DESIGN\.md/);
  assert.match(doc, /\|\s*source type\s*\|\s*trust level\s*\|\s*use policy\s*\|\s*do not copy\s*\|/i);
  assert.match(doc, /brand-specific tokens/i);
  assert.match(doc, /proprietary fonts/i);
  assert.match(doc, /pixel layout/i);
  assert.match(doc, /복제 금지/);
});

test('concept sheet requires a reference brief with borrow, reject, token impact, and clone guard', async () => {
  const template = await readRepoFile('templates/concept-sheet.md');

  assert.match(template, /## 레퍼런스 브리프/);
  assert.match(template, /\|\s*레퍼런스\s*\|\s*빌릴 레이어\s*\|\s*버릴 레이어\s*\|\s*토큰 영향\s*\|\s*복제 금지 조건\s*\|/);
  assert.match(template, /DESIGN\.md/);
  assert.match(template, /시각 언어/);
  assert.match(template, /토큰 커밋/);
});

test('interview examples keep all dimension choices before reference scoring', async () => {
  const interview = await readRepoFile('core/interview.md');
  const examplesStart = interview.indexOf('## 차원별 선택지 예시');
  const referenceScoringStart = interview.indexOf('## reference 점수화');
  const assetRulesStart = interview.indexOf('## 에셋 must-answer 규율');

  assert.notEqual(examplesStart, -1);
  assert.notEqual(referenceScoringStart, -1);
  assert.notEqual(assetRulesStart, -1);
  assert.ok(examplesStart < referenceScoringStart);
  assert.ok(referenceScoringStart < assetRulesStart);

  const examplesSection = interview.slice(examplesStart, referenceScoringStart);
  const referenceScoringSection = interview.slice(referenceScoringStart, assetRulesStart);

  for (const dimension of ['mood', 'reference', 'audience', 'structure', 'conversion', 'brand']) {
    const dimensionBullet = new RegExp(`- \\*\\*${dimension}\\*\\*(?: [^:]+)?:`);
    assert.match(examplesSection, dimensionBullet);
    assert.doesNotMatch(referenceScoringSection, dimensionBullet);
  }
});
