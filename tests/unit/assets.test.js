// tests/unit/assets.test.js — assets.js 단위 + cli assets end-to-end + exit 계약(AC9)
// node:test 스타일, cli.test.js 규율 동일.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import {
  classifyKind,
  parseSidecar,
  detectFabrication,
  auditAssets,
  formatAssetReport,
} from '../../src/assets.js';
import { runCli, fixturePath, repoPath, withTempDir } from '../helpers/index.js';

// 에셋 픽스처 기준 경로.
const FIXTURES = fixturePath('assets');

// ─── classifyKind 단위 ──────────────────────────────────────────────────────

test('classifyKind: woff2/woff/ttf/otf → font', () => {
  assert.equal(classifyKind('fonts/regular.woff2'), 'font');
  assert.equal(classifyKind('fonts/bold.woff'), 'font');
  assert.equal(classifyKind('fonts/mono.ttf'), 'font');
  assert.equal(classifyKind('fonts/display.otf'), 'font');
});

test('classifyKind: textures/ 경로 → texture', () => {
  assert.equal(classifyKind('textures/paper-noise.svg'), 'texture');
  assert.equal(classifyKind('assets/textures/dot-grid.svg'), 'texture');
});

test('classifyKind: noise/grid/hatch/pattern 파일명 → texture', () => {
  assert.equal(classifyKind('bg-noise.png'), 'texture');
  assert.equal(classifyKind('grid-overlay.svg'), 'texture');
  assert.equal(classifyKind('hatch-bg.svg'), 'texture');
  assert.equal(classifyKind('pattern-tile.png'), 'texture');
});

test('classifyKind: icons/ 경로 브랜드·로고형 → logo', () => {
  assert.equal(classifyKind('icons/openai.svg'), 'logo');
  assert.equal(classifyKind('icons/anthropic.svg'), 'logo');
  assert.equal(classifyKind('icons/gemini.svg'), 'logo');
  assert.equal(classifyKind('icons/brand-mark.svg'), 'logo');
  assert.equal(classifyKind('icons/my-logo.svg'), 'logo');
  assert.equal(classifyKind('icons/company-badge.svg'), 'logo');
});

test('classifyKind: icons/ 경로 비로고형 → other', () => {
  assert.equal(classifyKind('icons/checkmark.svg'), 'other');
  assert.equal(classifyKind('icons/arrow-right.svg'), 'other');
  assert.equal(classifyKind('icons/menu.svg'), 'other');
});

test('classifyKind: images/ 경로 및 래스터 확장자 → image', () => {
  assert.equal(classifyKind('images/hero.png'), 'image');
  assert.equal(classifyKind('images/bg.jpg'), 'image');
  assert.equal(classifyKind('assets/images/photo.webp'), 'image');
  assert.equal(classifyKind('standalone.png'), 'image');
  assert.equal(classifyKind('photo.jpeg'), 'image');
});

test('classifyKind: 미분류 → other', () => {
  assert.equal(classifyKind('some-file.svg'), 'other');
  assert.equal(classifyKind('document.pdf'), 'other');
  assert.equal(classifyKind('data.json'), 'other');
});

// ─── parseSidecar 단위 ──────────────────────────────────────────────────────

test('parseSidecar: key:value 라인 파싱', () => {
  const r = parseSidecar('license: CC0\nsource: self-authored\nasset: logo.svg\n');
  assert.equal(r.license, 'CC0');
  assert.equal(r.source, 'self-authored');
  assert.equal(r.asset, 'logo.svg');
});

test('parseSidecar: 빈 텍스트 → 빈 객체', () => {
  assert.deepEqual(parseSidecar(''), {});
});

test('parseSidecar: 누락 키는 undefined', () => {
  const r = parseSidecar('source: brand.com\n');
  assert.equal(r.source, 'brand.com');
  assert.equal(r.license, undefined);
});

test('parseSidecar: 공백 라인/주석 무시', () => {
  const r = parseSidecar('\n# comment\nlicense: MIT\n\nsource: github\n');
  assert.equal(r.license, 'MIT');
  assert.equal(r.source, 'github');
});

// ─── detectFabrication 단위 ─────────────────────────────────────────────────

// Signal 1: 브랜드 로고형 파일명 + 명목적 근거 없음
test('detectFabrication: Signal 1 양성 — 브랜드 로고 + sidecar 없음', () => {
  const r = detectFabrication('icons/openai.svg', {});
  assert.ok(r !== null, 'suspect 반환 필요');
  assert.match(r.reason, /logo-as-customer/);
});

test('detectFabrication: Signal 1 양성 — -logo 접미사 파일명', () => {
  const r = detectFabrication('icons/client-logo.svg', {});
  assert.ok(r !== null, 'suspect 반환 필요');
  assert.match(r.reason, /logo-as-customer/);
});

test('detectFabrication: Signal 1 음성 — nominative 근거 있음', () => {
  const r = detectFabrication('icons/openai.svg', { license: 'nominative use', source: 'brand.com' });
  assert.equal(r, null, 'nominative 근거 → 음성');
});

test('detectFabrication: Signal 1 음성 — CC0 라이선스', () => {
  const r = detectFabrication('icons/anthropic.svg', { license: 'CC0', source: 'brand-assets' });
  assert.equal(r, null, 'CC0 근거 → 음성');
});

test('detectFabrication: Signal 1 음성 — trademark 명시', () => {
  const r = detectFabrication('icons/figma.svg', { license: 'trademark use documented', source: 'figma.com' });
  assert.equal(r, null, 'trademark 명시 → 음성');
});

test('detectFabrication: Signal 1 양성 — mit가 단어 일부이면 근거 아님', () => {
  const r = detectFabrication('icons/openai.svg', { source: 'submitted by team' });
  assert.ok(r !== null, 'submitted 안의 mit는 명목적 근거가 아님');
  assert.match(r.reason, /logo-as-customer/);
});

test('detectFabrication: Signal 1 양성 — separator token 브랜드 로고', () => {
  const underscore = detectFabrication('icons/openai_logo.svg', {});
  assert.ok(underscore !== null, 'underscore joined brand token도 suspect 반환 필요');
  assert.match(underscore.reason, /logo-as-customer/);

  const dotted = detectFabrication('icons/openai.com.svg', {});
  assert.ok(dotted !== null, 'dot joined brand token도 suspect 반환 필요');
  assert.match(dotted.reason, /logo-as-customer/);
});

// Signal 2: screenshot/dashboard/screen + AI 소스
test('detectFabrication: Signal 2 양성 — AI 생성 dashboard', () => {
  const r = detectFabrication('images/dashboard.png', { source: 'AI생성' });
  assert.ok(r !== null, 'suspect 반환 필요');
  assert.match(r.reason, /스크린샷/);
});

test('detectFabrication: Signal 2 양성 — source=generated', () => {
  const r = detectFabrication('images/screenshot-home.png', { source: 'generated' });
  assert.ok(r !== null, 'suspect 반환 필요');
  assert.match(r.reason, /스크린샷/);
});

test('detectFabrication: Signal 2 음성 — screenshot + 실제 소스', () => {
  const r = detectFabrication('images/dashboard.png', { source: 'self-captured' });
  assert.equal(r, null, '실제 소스 → 음성');
});

test('detectFabrication: Signal 2 음성 — ai 부분문자열은 소스 토큰 아님', () => {
  assert.equal(
    detectFabrication('images/dashboard.png', { source: 'screenshot from email newsletter' }),
    null,
    'email 안의 ai는 AI source가 아님',
  );
  assert.equal(
    detectFabrication('images/dashboard.png', { source: 'available under CC0' }),
    null,
    'available 안의 ai는 AI source가 아님',
  );
  const generated = detectFabrication('images/dashboard.png', { source: 'ai-generated' });
  assert.ok(generated !== null, 'ai-generated는 계속 AI source로 탐지');
  assert.match(generated.reason, /스크린샷/);
});

// Signal 3: chart/graph/data/stat + AI 소스
test('detectFabrication: Signal 3 양성 — AI 생성 chart', () => {
  const r = detectFabrication('images/chart-2024.png', { source: 'generated' });
  assert.ok(r !== null, 'suspect 반환 필요');
  assert.match(r.reason, /데이터/);
});

test('detectFabrication: Signal 3 양성 — graph + source=ai-generated', () => {
  const r = detectFabrication('images/graph-q4.png', { source: 'ai-generated' });
  assert.ok(r !== null, 'suspect 반환 필요');
  assert.match(r.reason, /데이터/);
});

test('detectFabrication: Signal 3 음성 — chart + 실제 데이터 소스', () => {
  const r = detectFabrication('images/chart-revenue.png', { source: 'actual-data.csv' });
  assert.equal(r, null, '실제 소스 → 음성');
});

test('detectFabrication: 신호 없음 — 일반 이미지 + AI 소스', () => {
  // AI 소스지만 파일명에 screenshot/chart/brand 시그널 없음
  const r = detectFabrication('images/illustration.png', { source: 'AI생성' });
  assert.equal(r, null, '시그널 미매칭 → 음성');
});

// ─── auditAssets 통합 (픽스처 dir) ─────────────────────────────────────────

test('auditAssets: mixed — counts·missingSidecar·suspect 정확', async () => {
  const dir = join(FIXTURES, 'mixed');
  const report = await auditAssets(dir);

  // 3 에셋: checkmark.svg(other) + hero.png(image) + background.png(image)
  assert.equal(report.counts.total, 3, 'total 3');
  assert.equal(report.counts.image, 2, 'image 2');
  assert.equal(report.counts.other, 1, 'other 1 (checkmark)');
  assert.equal(report.counts.logo, 0, 'logo 0');
  assert.equal(report.counts.texture, 0, 'texture 0');
  assert.equal(report.counts.font, 0, 'font 0');

  // sidecar 누락: background.png만
  assert.equal(report.missingSidecar.length, 1, '1개 sidecar 누락');
  assert.ok(
    report.missingSidecar.some((p) => p.includes('background.png')),
    'background.png sidecar 누락',
  );

  // 의심 없음
  assert.equal(report.suspectFabrication.length, 0, '의심 없음');
  assert.equal(report.skipped.length, 0, 'skipped 없음');

  // summary 일관성
  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.missingSidecar, 1);
  assert.equal(report.summary.suspect, 0);
});

test('auditAssets: mixed — files 배열 구조 검증', async () => {
  const dir = join(FIXTURES, 'mixed');
  const report = await auditAssets(dir);

  const hero = report.files.find((f) => f.path.includes('hero.png'));
  assert.ok(hero, 'hero.png 파일 존재');
  assert.equal(hero.kind, 'image');
  assert.equal(hero.hasSidecar, true);
  assert.equal(hero.source, 'self-authored');

  const bg = report.files.find((f) => f.path.includes('background.png'));
  assert.ok(bg, 'background.png 파일 존재');
  assert.equal(bg.hasSidecar, false);

  const check = report.files.find((f) => f.path.includes('checkmark.svg'));
  assert.ok(check, 'checkmark.svg 파일 존재');
  assert.equal(check.kind, 'other');
  assert.equal(check.hasSidecar, true);
});

test('auditAssets: suspect — 브랜드 로고 탐지 + counts', async () => {
  const dir = join(FIXTURES, 'suspect');
  const report = await auditAssets(dir);

  assert.equal(report.counts.total, 2, 'total 2');
  assert.equal(report.counts.logo, 1, 'openai.svg → logo');
  assert.equal(report.counts.image, 1, 'photo.png → image');

  // openai.svg: sidecar 없으므로 missingSidecar 포함
  assert.ok(
    report.missingSidecar.some((p) => p.includes('openai.svg')),
    'openai.svg sidecar 누락',
  );

  // suspectFabrication에 openai.svg 포함
  assert.ok(report.suspectFabrication.length >= 1, '의심 1개 이상');
  const suspect = report.suspectFabrication.find((s) => s.path.includes('openai'));
  assert.ok(suspect, 'openai.svg suspicious');
  assert.match(suspect.reason, /logo-as-customer/);
});

test('auditAssets: empty — 에셋 0개, exit-safe', async () => {
  const dir = join(FIXTURES, 'empty');
  const report = await auditAssets(dir);
  assert.equal(report.counts.total, 0);
  assert.equal(report.missingSidecar.length, 0);
  assert.equal(report.suspectFabrication.length, 0);
  assert.equal(report.readiness.ready, false, '0-에셋은 prebuild ready 아님');
  assert.equal(report.readiness.usableVisualAnchors, 0);
  assert.match(report.readiness.reasons.join('\n'), /시각 앵커/);
});

test('auditAssets: font-only — 시각 앵커 없으면 prebuild ready 아님', async () => {
  const { mkdir, writeFile: wf } = await import('node:fs/promises');
  await withTempDir(async (dir) => {
    await mkdir(join(dir, 'fonts'), { recursive: true });
    await wf(join(dir, 'fonts/body.woff2'), 'font-bytes');
    await wf(join(dir, 'fonts/body.woff2.license.txt'), 'license: OFL\nsource: self-hosted');
    const report = await auditAssets(dir);
    assert.equal(report.counts.font, 1);
    assert.equal(report.readiness.ready, false);
    assert.equal(report.readiness.usableVisualAnchors, 0);
    assert.match(report.readiness.reasons.join('\n'), /시각 앵커/);
  });
});

// ─── formatAssetReport 스모크 ────────────────────────────────────────────

test('formatAssetReport: 필수 섹션 헤더 포함', async () => {
  const dir = join(FIXTURES, 'mixed');
  const report = await auditAssets(dir);
  const text = formatAssetReport(report);

  assert.match(text, /^assets:/m);
  assert.match(text, /prebuild readiness:/);
  assert.match(text, /종류별 개수:/);
  assert.match(text, /sidecar 누락/);
  assert.match(text, /가짜-실재 의심/);
  assert.match(text, /advisory only/);
  assert.match(text, /CI 차단 게이트/);
  assert.match(text, /best-effort/);
});

test('formatAssetReport: concept-sheet empty → advisory 문구', async () => {
  const dir = join(FIXTURES, 'mixed');
  const conceptSheetPath = join(FIXTURES, 'concept-empty.md');
  const report = await auditAssets(dir, { conceptSheetPath });
  const text = formatAssetReport(report);
  assert.match(text, /에셋 계획 섹션 비어있음/);
  assert.equal(report.readiness.ready, false);
  assert.match(report.readiness.reasons.join('\n'), /에셋 계획/);
});

test('formatAssetReport: conceptSheet null → advisory 없음', async () => {
  const dir = join(FIXTURES, 'mixed');
  const report = await auditAssets(dir); // conceptSheetPath 없음
  const text = formatAssetReport(report);
  assert.ok(!text.includes('에셋 계획 섹션 비어있음'), 'advisory 없어야 함');
});

// ─── CLI exit 계약 (AC9, 필수) ────────────────────────────────────────────

test('AC9: suspect dir → suspect/missing 있어도 exit 0', async () => {
  const r = await runCli('assets', join(FIXTURES, 'suspect'));
  assert.equal(r.code, 0, 'exit 0 — suspect 있어도 advisory only');
  assert.match(r.stdout, /가짜-실재 의심/);
  assert.match(r.stdout, /sidecar 누락/);
});

test('AC9: mixed dir + --json → exit 0 + 유효한 JSON', async () => {
  const r = await runCli('assets', join(FIXTURES, 'mixed'), '--json');
  assert.equal(r.code, 0, 'exit 0');
  let parsed;
  assert.doesNotThrow(() => {
    parsed = JSON.parse(r.stdout);
  }, 'stdout는 파싱 가능한 JSON');
  assert.ok(parsed.counts, 'JSON에 counts 포함');
  assert.ok(Array.isArray(parsed.files), 'JSON에 files 배열 포함');
  assert.ok(parsed.summary, 'JSON에 summary 포함');
  assert.equal(typeof parsed.summary.total, 'number');
});

test('AC9: empty dir → exit 0 (에셋 0개)', async () => {
  const r = await runCli('assets', join(FIXTURES, 'empty'));
  assert.equal(r.code, 0, 'exit 0 — 0-에셋 디렉터리');
});

test('AC9: 존재하지 않는 dir → exit 2', async () => {
  const r = await runCli('assets', 'does-not-exist-xyz-99999');
  assert.equal(r.code, 2);
  assert.match(r.stderr, /cannot read/);
  assert.ok(!r.stderr.includes('node:internal'), '스택트레이스 없음');
});

test('AC9: 파일 경로(디렉터리 아님) → exit 2', async () => {
  const r = await runCli('assets', join(FIXTURES, 'concept-empty.md'));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /not a directory/);
  assert.ok(!r.stderr.includes('node:internal'), '스택트레이스 없음');
});

// AC1c: --concept-sheet 빈 섹션 → advisory 문구 출력
test('AC1c: --concept-sheet 빈 에셋 섹션 → advisory 경고', async () => {
  const r = await runCli('assets', join(FIXTURES, 'mixed'), '--concept-sheet', join(FIXTURES, 'concept-empty.md'));
  assert.equal(r.code, 0, 'exit 0');
  assert.match(r.stdout, /에셋 계획 섹션 비어있음/, 'advisory 문구 포함');
});
// NF1 회귀: 실제 concept-sheet '표-행' 형식에서 채움/빈 변별 (헤더-only 픽스처로 가려졌던 결함)
test('NF1: concept-sheet 표-행 채움 → empty:false, advisory 없음', async () => {
  const report = await auditAssets(join(FIXTURES, 'mixed'), {
    conceptSheetPath: join(FIXTURES, 'concept-filled.md'),
  });
  assert.equal(report.conceptSheet.present, true);
  assert.equal(report.conceptSheet.empty, false, '표-행 채움은 empty 아님');
  assert.ok(!formatAssetReport(report).includes('에셋 계획 섹션 비어있음'), 'advisory 없어야');
});

test('NF1: concept-sheet 표-행 placeholder → empty:true', async () => {
  const report = await auditAssets(join(FIXTURES, 'mixed'), {
    conceptSheetPath: join(FIXTURES, 'concept-empty.md'),
  });
  assert.equal(report.conceptSheet.empty, true, '표-행 placeholder는 empty');
});

test('NF1: 실제 concept-sheet 템플릿의 escaped pipe placeholder → empty:true', async () => {
  const template = repoPath('templates/concept-sheet.md');
  const report = await auditAssets(join(FIXTURES, 'mixed'), { conceptSheetPath: template });
  assert.equal(report.conceptSheet.empty, true, '템플릿 placeholder는 empty');
  assert.equal(report.readiness.ready, false, '템플릿 상태로는 prebuild ready 아님');
});

// CG-001 회귀: 인자 디렉터리 자체를 읽을 수 없으면(권한) exit 2 (best-effort skip 아님)
// root는 chmod 000을 무시하므로 uid 0이면 skip.
test('CG-001: 권한 없는 디렉터리 → exit 2', { skip: process.getuid?.() === 0 }, async () => {
  const { chmod } = await import('node:fs/promises');
  await withTempDir(async (dir) => {
    await chmod(dir, 0o000);
    const r = await runCli('assets', dir);
    assert.equal(r.code, 2, '권한 없는 dir는 입력오류 exit 2');
    assert.ok(!r.stderr.includes('node:internal'), '스택트레이스 없음');
  }, 'di-noaccess-');
});

// sidecar 네이밍 회귀: 기존 라이브러리는 strip-ext(figma.license.txt),
// 신규는 keep-ext(openai.svg.license.txt) — 검사기가 둘 다 인식해야 실제 assets/가 오탐 안 난다.
test('sidecar: strip-ext / keep-ext 두 형식 모두 인식', async () => {
  const { writeFile: wf, mkdir } = await import('node:fs/promises');
  await withTempDir(async (dir) => {
    await mkdir(join(dir, 'icons'), { recursive: true });
    const nominative = 'license: trademark\nsource: brand kit\nusage: nominative reference';
    // strip-ext (기존 라이브러리 방식)
    await wf(join(dir, 'icons/figma.svg'), '<svg/>');
    await wf(join(dir, 'icons/figma.license.txt'), nominative);
    // keep-ext (신규 방식)
    await wf(join(dir, 'icons/openai.svg'), '<svg/>');
    await wf(join(dir, 'icons/openai.svg.license.txt'), nominative);
    const r = await auditAssets(dir);
    assert.equal(r.missingSidecar.length, 0, '두 형식 모두 sidecar로 인식돼야 (누락 0)');
    assert.equal(r.suspectFabrication.length, 0, '명목적 근거 있으면 logo-as-customer 의심 음성');
  }, 'di-sidecar-');
});

test('sidecar: 대문자 LICENSE.TXT도 sidecar로 인식하고 phantom asset로 세지 않음', async () => {
  const { writeFile: wf } = await import('node:fs/promises');
  await withTempDir(async (dir) => {
    await wf(join(dir, 'hero.png'), 'image-bytes');
    await wf(join(dir, 'hero.png.LICENSE.TXT'), 'license: CC0\nsource: self-authored');
    const r = await auditAssets(dir);
    assert.equal(r.counts.total, 1, 'uppercase sidecar는 별도 asset가 아님');
    assert.deepEqual(r.missingSidecar, [], 'hero.png sidecar 누락 없음');
    const hero = r.files.find((f) => f.path === 'hero.png');
    assert.ok(hero, 'hero.png 파일 존재');
    assert.equal(hero.hasSidecar, true);
  }, 'di-uppercase-sidecar-');
});

test('auditAssets: in-root 심볼릭 링크는 따라가 계산한다', async () => {
  const { mkdir, symlink, writeFile: wf } = await import('node:fs/promises');
  await withTempDir(async (dir) => {
    const scanDir = join(dir, 'scan');
    const shared = join(scanDir, 'shared');
    const images = join(scanDir, 'images');
    await mkdir(shared, { recursive: true });
    await mkdir(images, { recursive: true });
    await wf(join(shared, 'hero.png'), 'image-bytes');
    await wf(join(shared, 'hero.png.license.txt'), 'license: CC0\nsource: self-authored');
    // 스캔 루트(scanDir) 안의 다른 하위 디렉터리를 가리키는 링크 → 따라가야 한다.
    await symlink(join(shared, 'hero.png'), join(images, 'hero.png'));
    await symlink(join(shared, 'hero.png.license.txt'), join(images, 'hero.png.license.txt'));

    const r = await auditAssets(scanDir);
    assert.ok(r.counts.total >= 1, 'in-root 심볼릭 링크 이미지는 계산돼야 함');
    assert.deepEqual(r.missingSidecar, [], 'symlinked sidecar 인식 필요');
    assert.equal(r.readiness.ready, true, 'in-root 심볼릭 링크 image+sidecar는 READY');
    assert.ok(r.readiness.usableVisualAnchors >= 1);
  }, 'di-symlink-inroot-');
});

test('auditAssets: 스캔 루트 밖을 가리키는 심볼릭 링크는 건너뛴다(R5 readiness 스푸핑 방지)', async () => {
  const { mkdir, symlink, writeFile: wf } = await import('node:fs/promises');
  await withTempDir(async (dir) => {
    const outside = join(dir, 'outside');
    const scanDir = join(dir, 'scan');
    await mkdir(outside, { recursive: true });
    await mkdir(scanDir, { recursive: true });
    await wf(join(outside, 'hero.png'), 'image-bytes');
    await wf(join(outside, 'hero.png.license.txt'), 'license: CC0\nsource: self-authored');
    await symlink(join(outside, 'hero.png'), join(scanDir, 'hero.png'));
    await symlink(join(outside, 'hero.png.license.txt'), join(scanDir, 'hero.png.license.txt'));

    const r = await auditAssets(scanDir);
    assert.equal(r.counts.total, 0, '루트 밖 심볼릭 링크는 계산되면 안 됨');
    assert.equal(r.readiness.ready, false, '루트 밖 링크로 READY 위조 안 됨');
    assert.ok(r.skipped.some((s) => /루트 밖/.test(s)), '루트 밖 링크는 skipped에 기록');
  }, 'di-symlink-escape-');
});
