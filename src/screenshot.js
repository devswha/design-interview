// M3 비주얼 레인 — Phase 4 스크린샷 자기검수의 캡처 계층.
//
// puppeteer는 선택 의존성이다 (ROADMAP 운영 원칙: 없는 환경에서도
// M0~M2 전 기능 동작). 동적 import로 로드하고, 미설치면 설치 방법을
// 담은 명확한 에러를 던진다 — 조용한 no-op 금지.

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

async function loadPuppeteer() {
  try {
    return (await import('puppeteer')).default;
  } catch {
    throw new Error(
      'puppeteer is not installed. visual lane (M3) requires it:\n' +
      '  npm install puppeteer\n' +
      'audit/preview/benchmark (M0–M2) work without it.',
    );
  }
}

// 로컬 HTML 파일을 viewport별 풀페이지 PNG로 캡처한다.
// 반환: [{ viewport, path }]
export async function captureFile(htmlPath, { outBase, viewports = ['desktop', 'mobile'] } = {}) {
  const puppeteer = await loadPuppeteer();
  const url = pathToFileURL(resolve(htmlPath)).href;
  const base = outBase ?? resolve(htmlPath).replace(/\.html?$/i, '');
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const shots = [];
    for (const name of viewports) {
      const vp = VIEWPORTS[name];
      if (!vp) throw new Error(`unknown viewport "${name}" (valid: ${Object.keys(VIEWPORTS).join(', ')})`);
      const page = await browser.newPage();
      await page.setViewport(vp);
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      const path = `${base}.${name}.png`;
      await page.screenshot({ path, fullPage: true });
      await page.close();
      shots.push({ viewport: name, path });
    }
    return shots;
  } finally {
    await browser.close();
  }
}
