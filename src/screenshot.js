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

// 공유 puppeteer 로더 — geometry.js도 사용한다. feature는 에러 안내용.
// 미설치는 ERR_PUPPETEER_MISSING typed error — 호출부가 폴백 가능한 유일한
// 케이스로 구분한다. 그 외 시각 레인 에러는 폴백 대상이 아니다.
export async function loadPuppeteer(feature = 'visual lane (M3)') {
  try {
    return (await import('puppeteer')).default;
  } catch {
    const err = new Error(
      `puppeteer is not installed. ${feature} requires it:\n` +
      '  npm install puppeteer\n' +
      'audit/preview/benchmark (M0–M2) work without it.',
    );
    err.code = 'ERR_PUPPETEER_MISSING';
    throw err;
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
      // 폰트 적용 완료까지 대기 — 전송 완료(networkidle0)와 렌더 적용은 다르다
      // (slides-grab 검증 레인에서 채용한 안정화).
      await page.evaluate(() => document.fonts?.ready);
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
