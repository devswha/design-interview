// M3 기하 판정 — 렌더된 박스 좌표로 레이아웃 텔을 기계 레인으로 승격.
//
// 정적 파서(src/audit.js)는 CSS 선언만 보지만, L1(균일 카드 그리드)과
// S3(완전 대칭)는 *렌더 결과*의 기하에서만 확정할 수 있다. puppeteer로
// 페이지를 띄우고 박스 좌표·계산된 스타일을 수집해 판정한다.
//
// puppeteer는 선택 의존성 — 미설치면 screenshot.js와 같은 안내 에러.

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { VIEWPORTS } from './screenshot.js';

async function loadPuppeteer() {
  try {
    return (await import('puppeteer')).default;
  } catch {
    throw new Error(
      'puppeteer is not installed. visual checks (L1/S3) require it:\n' +
      '  npm install puppeteer\n' +
      'static audit (C1/T1/T2/T4/S5) works without it.',
    );
  }
}

// 브라우저 안에서 실행된다 — 외부 스코프 참조 금지.
function pageAnalyzer() {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden';
  };

  // L1 균일 카드 그리드: 한 부모 아래 보이는 자식 3개+가 동일 크기(±2px),
  // 같은 행, 등간격(±3px)으로 배열.
  let l1 = { pass: true };
  for (const parent of [document.body, ...document.querySelectorAll('body *')]) {
    const kids = [...parent.children].filter(isVisible);
    if (kids.length < 3) continue;
    const rects = kids.map((k) => k.getBoundingClientRect());
    const { width: w0, height: h0 } = rects[0];
    if (w0 < 60 || h0 < 60) continue;
    if (!rects.every((r) => Math.abs(r.width - w0) <= 2 && Math.abs(r.height - h0) <= 2)) continue;
    if (!rects.every((r) => Math.abs(r.top - rects[0].top) <= 2)) continue;
    const xs = rects.map((r) => r.left).sort((a, b) => a - b);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]);
    if (gaps.every((g) => Math.abs(g - gaps[0]) <= 3)) {
      l1 = {
        pass: false,
        evidence: `${kids.length}× identical ${Math.round(w0)}×${Math.round(h0)} cards, uniform ${Math.round(gaps[0])}px pitch in <${parent.tagName.toLowerCase()}>`,
      };
      break;
    }
  }

  // S3 완전 대칭: 텍스트 블록 4개+ 중 80% 이상이 center 정렬로 렌더됨.
  let s3 = { pass: true };
  const textEls = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,button,figcaption')]
    .filter((el) => isVisible(el) && el.textContent.trim().length > 0);
  if (textEls.length >= 4) {
    const centered = textEls.filter((el) => getComputedStyle(el).textAlign === 'center').length;
    if (centered / textEls.length >= 0.8) {
      s3 = { pass: false, evidence: `${centered}/${textEls.length} text blocks render center-aligned` };
    }
  }

  return { l1, s3 };
}

// 로컬 HTML을 데스크탑 viewport로 렌더해 시각 텔 findings를 돌려준다.
// 반환 형식은 audit.js findings와 동일: [{ id, name, pass, evidence }]
export async function analyzeVisualTells(htmlPath) {
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORTS.desktop);
    await page.goto(pathToFileURL(resolve(htmlPath)).href, { waitUntil: 'networkidle0', timeout: 30000 });
    const { l1, s3 } = await page.evaluate(pageAnalyzer);
    return [
      { id: 'L1', name: 'uniform-card-grid', pass: l1.pass, evidence: l1.evidence ?? null },
      { id: 'S3', name: 'perfect-symmetry', pass: s3.pass, evidence: s3.evidence ?? null },
    ];
  } finally {
    await browser.close();
  }
}
