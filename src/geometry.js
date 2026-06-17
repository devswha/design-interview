// M3 기하 판정 — 렌더된 박스 좌표로 레이아웃 텔을 기계 레인으로 승격.
//
// 정적 파서(src/audit.js)는 CSS 선언만 보지만, L1(균일 카드 그리드)·
// S3(완전 대칭)·L2(전 섹션 가운데 단일 컬럼)·TY1(타입 스케일 부재)·
// TY2(행길이 규율)는 *렌더 결과*의 기하에서만 확정할 수 있다. puppeteer로
// 페이지를 띄우고 박스 좌표·계산된 스타일을 수집해 판정한다.
//
// puppeteer는 선택 의존성 — 미설치면 screenshot.js와 같은 안내 에러.

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { VIEWPORTS, loadPuppeteer } from './screenshot.js';


// 브라우저 안에서 실행된다 — 외부 스코프 참조 금지.
function pageAnalyzer() {
  // 문서 전체 범위 — 오프스크린 탈출(left:-9999px, transform 등) 판정 기준.
  const docW = Math.max(document.documentElement.scrollWidth, document.documentElement.clientWidth);
  const docH = Math.max(document.documentElement.scrollHeight, document.documentElement.clientHeight);

  // 가시성 판정 — 모든 시각 체크(L1/L2/S3/TY1/TY2/DE3 contrast)가 공유한다. 거부 조건:
  // display/visibility 숨김, 1px 이하 박스(sr-only 패턴 — 기존 `< 1`을 `<= 1`로 조임),
  // 문서 영역 밖 배치, clip: rect(0,0,0,0)·clip-path: inset(100%) 트릭,
  // opacity < 0.05 — opacity는 합성 그룹이라 자손의 computed 값에 전파되지 않으므로
  // 요소뿐 아니라 조상 체인까지 거슬러 올라가 검사한다.
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= docW || r.top >= docH) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    if ((s.position === 'absolute' || s.position === 'fixed') && s.clip === 'rect(0px, 0px, 0px, 0px)') return false;
    if (s.clipPath.replace(/\s+/g, '') === 'inset(100%)') return false;
    for (let n = el; n; n = n.parentElement) {
      if (parseFloat(getComputedStyle(n).opacity) < 0.05) return false;
    }
    return true;
  };

  // 텍스트 블록 셀렉터 — S3와 L2가 공유.
  const ownText = (el) => [...el.childNodes]
    .filter((n) => n.nodeType === Node.TEXT_NODE)
    .map((n) => n.textContent)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  const TEXT_SEL = 'h1,h2,h3,h4,h5,h6,p,li,button,figcaption';

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
  const textEls = [...document.querySelectorAll(TEXT_SEL)]
    .filter((el) => isVisible(el) && el.textContent.trim().length > 0);
  if (textEls.length >= 4) {
    const centered = textEls.filter((el) => getComputedStyle(el).textAlign === 'center').length;
    if (centered / textEls.length >= 0.8) {
      s3 = { pass: false, evidence: `${centered}/${textEls.length} text blocks render center-aligned` };
    }
  }

  // L2 center-everything (ROADMAP M3 승격): 본문 최상위 섹션 — body/main의 직계
  // 자식 중 렌더 높이 160px+ (header/nav/footer 제외) — 이 3개 이상이고 그 *전부*가
  // '가운데 단일 컬럼'이면 fail. 2개 이하면 증거 부족으로 pass.
  //
  // '가운데 단일 컬럼' = (a) AND ((b) OR (c)):
  //   (a) 240px+ 폭의 보이는 형제 박스 둘이 한 행을 공유하지 않음 (단일 컬럼 기하)
  //   (b) 가장 큰 텍스트 블록의 중심 x가 섹션 중심 ±12px이고 좌측 오프셋이
  //       섹션 폭의 15% 이상 (좁은 가운데 컬럼)
  //   (c) 보이는 텍스트 블록 과반(> 50%)이 text-align: center로 계산됨
  // (b)/(c)를 OR로 묶는 이유: L2의 정의(core/design-tells.md)는 *기하적* 센터링이라
  // text-align:left인 좁은 가운데 컬럼도 잡아야 하고, 그래야 S3(텍스트 정렬 ≥ 80%)와
  // 발화 입력이 분리된다 — 승격 불변식.
  let l2 = { pass: true };
  const sections = [];
  for (const root of [document.body, ...document.querySelectorAll('main')].filter(Boolean)) {
    for (const kid of root.children) {
      const tag = kid.tagName.toLowerCase();
      if (tag === 'main' || tag === 'header' || tag === 'nav' || tag === 'footer') continue;
      if (!isVisible(kid) || kid.getBoundingClientRect().height < 160) continue;
      sections.push(kid);
    }
  }
  // 두 박스가 좌우로 나란히 한 행을 이루는가 — 세로 겹침이 있고 가로 겹침은 절반 미만.
  const sideBySide = (r1, r2) => {
    const v = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
    if (v <= 0) return false;
    const h = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left);
    return h < Math.min(r1.width, r2.width) * 0.5;
  };
  const isCenteredSingleColumn = (sec) => {
    const secRect = sec.getBoundingClientRect();
    for (const parent of [sec, ...sec.querySelectorAll('*')]) {
      const wide = [...parent.children]
        .filter((k) => isVisible(k) && k.getBoundingClientRect().width >= 240)
        .map((k) => k.getBoundingClientRect());
      for (let i = 0; i < wide.length; i++) {
        for (let j = i + 1; j < wide.length; j++) {
          if (sideBySide(wide[i], wide[j])) return false; // (a) 위반 — 다단
        }
      }
    }
    const blocks = [...sec.querySelectorAll(TEXT_SEL)]
      .filter((el) => isVisible(el) && el.textContent.trim().length > 0);
    let geomCentered = false; // (b)
    if (blocks.length > 0) {
      const largest = blocks.reduce((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        return rb.width * rb.height > ra.width * ra.height ? b : a;
      });
      const r = largest.getBoundingClientRect();
      const dx = Math.abs((r.left + r.width / 2) - (secRect.left + secRect.width / 2));
      geomCentered = dx <= 12 && r.left - secRect.left >= secRect.width * 0.15;
    }
    const centeredBlocks = blocks.filter((el) => getComputedStyle(el).textAlign === 'center').length; // (c)
    return geomCentered || (blocks.length > 0 && centeredBlocks / blocks.length > 0.5);
  };
  if (sections.length >= 3) {
    const hits = sections.filter(isCenteredSingleColumn).length;
    if (hits === sections.length) {
      l2 = { pass: false, evidence: `${hits}/${sections.length} top-level sections are centered single columns` };
    }
  }

  // TY1 type-scale-chaos: 자기 텍스트 3자+를 가진 보이는 요소의 계산된 font-size를
  // 1px 버킷(0.5px 아님)으로 집계. sub/sup/small은 본래 작게 쓰는 요소라 면제.
  // 8종 이상(> 7)이면 타입 스케일 부재로 fail. 숨김 텍스트는 isVisible이 걸러서
  // 크기 수를 부풀리지 못한다.
  let ty1 = { pass: true };
  const sizes = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'sub' || tag === 'sup' || tag === 'small') continue;
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join('')
      .trim();
    if (own.length < 3) continue;
    if (!isVisible(el)) continue;
    sizes.add(Math.round(parseFloat(getComputedStyle(el).fontSize)));
  }
  if (sizes.size > 7) {
    const list = [...sizes].sort((a, b) => a - b).join('/');
    ty1 = { pass: false, evidence: `${sizes.size} distinct font sizes: ${list}px` };
  }

  // TY2 measure-discipline: <p>만 검사 — li는 의도적 보류(마커·중첩 리스트의 폭
  // 계산이 불안정해 오탐 위험; 별도 승격 때 다룬다).
  //   (a) 렌더 텍스트 120자 초과 <p>는 clientWidth / font-size(≈em 단위 행길이) ≤ 40
  //   (b) 본문 영역 80자 초과 <p>는 font-size ≥ 15.5px. 본문 영역 = <main>이 있으면
  //       그 안; 없으면 <body> 루트의 지배 본문 블록(footer/nav/aside/small/figcaption/
  //       [aria-hidden]·숨김 제외, 80자+ <p> 중 글자수 최대) — <main> 부재 구멍을 닫는다.
  let ty2 = { pass: true };
  const mainEl = document.querySelector('main');
  // <main> 없으면 지배 본문 블록 하나를 (b) 대상으로 삼는다. 비본문 랜드마크/롤과
  // 작은 글씨를 제외하고, **글자수 가중 최빈 font-size**(지배 본문 크기)를 쓰는
  // 가장 긴 <p>를 고른다 — 소수 fine-print/약관이 본문으로 오선택되어 fail나는 것을 막는다.
  const EXCLUDE_SEL = 'footer,nav,aside,small,figcaption,header,[aria-hidden="true"],[role="contentinfo"],[role="navigation"],[role="complementary"],[role="banner"]';
  let bodyDominant = null;
  if (!mainEl) {
    const cands = [...document.querySelectorAll('p')].filter((p) =>
      isVisible(p)
      && !p.closest(EXCLUDE_SEL)
      && p.textContent.replace(/\s+/g, ' ').trim().length > 80);
    const sizeWeight = new Map();
    for (const p of cands) {
      const fs = Math.round(parseFloat(getComputedStyle(p).fontSize));
      sizeWeight.set(fs, (sizeWeight.get(fs) ?? 0) + p.textContent.replace(/\s+/g, ' ').trim().length);
    }
    let domSize = null;
    let domW = -1;
    for (const [fs, w] of sizeWeight) if (w > domW) { domW = w; domSize = fs; }
    if (domSize !== null) {
      for (const p of cands) {
        if (Math.round(parseFloat(getComputedStyle(p).fontSize)) !== domSize) continue;
        if (!bodyDominant || p.textContent.trim().length > bodyDominant.textContent.trim().length) bodyDominant = p;
      }
    }
  }
  for (const p of document.querySelectorAll('p')) {
    if (!isVisible(p)) continue;
    const text = p.textContent.replace(/\s+/g, ' ').trim();
    const fontSize = parseFloat(getComputedStyle(p).fontSize);
    if (text.length > 120) {
      const ems = p.clientWidth / fontSize;
      if (ems > 40) {
        ty2 = { pass: false, evidence: `"${text.slice(0, 40)}…" runs ${ems.toFixed(1)}em wide (limit 40)` };
        break;
      }
    }
    const inScope = mainEl ? mainEl.contains(p) : p === bodyDominant;
    if (inScope && text.length > 80 && fontSize < 15.5) {
      ty2 = { pass: false, evidence: `"${text.slice(0, 40)}…" set at ${fontSize}px (min 15.5px)` };
      break;
    }
  }

  // TY5-A 한글 어절 중간 줄바꿈 (시각 fail). word-break:keep-all 미적용 시
  // 브라우저가 한글 음절 사이 아무 데서나 끊는다. 공백·구두점 없이 인접한
  // 한글 완성형 음절 쌍이 실제로 서로 다른 줄에 렌더되면 fail. 보수적:
  // 텍스트 노드 단위로만 보므로 <br>/inline 경계는 노드가 갈려 자연 제외되고,
  // 세로쓰기(writing-mode: vertical-*)와 transform 적용 요소는 rect top이 신뢰
  // 불가라 건너뛴다(회전·스큐가 같은 줄 글자에 top 차이를 만들어 오탐 방지).
  let ty5a = { pass: true };
  const isSyllable = (ch) => ch >= '가' && ch <= '힣';
  const breakRange = document.createRange();
  for (const el of document.querySelectorAll(TEXT_SEL)) {
    if (!ty5a.pass) break;
    if (!isVisible(el)) continue;
    const csb = getComputedStyle(el);
    if (csb.writingMode && csb.writingMode.indexOf('vertical') === 0) continue;
    let transformed = false;
    for (let n = el; n; n = n.parentElement) {
      if (getComputedStyle(n).transform !== 'none') { transformed = true; break; }
    }
    if (transformed) continue;
    const fsb = parseFloat(csb.fontSize) || 16;
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const raw = node.textContent;
      let hit = false;
      for (let i = 0; i < raw.length - 1; i++) {
        if (!isSyllable(raw[i]) || !isSyllable(raw[i + 1])) continue;
        breakRange.setStart(node, i);
        breakRange.setEnd(node, i + 2);
        const rects = breakRange.getClientRects();
        if (rects.length < 2) continue; // 같은 줄 — 정상
        const tops = [...rects].map((r) => r.top);
        if (Math.max(...tops) - Math.min(...tops) > fsb / 2) {
          const ctx = raw.slice(Math.max(0, i - 6), i + 8).replace(/\s+/g, ' ').trim();
          ty5a = { pass: false, evidence: `"${ctx}" 어절 중간 줄바꿈 (word-break:keep-all 누락)` };
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
  }

  // DE3 contrast: 첫 승격 범위는 "단색 배경 위 텍스트"로 제한한다.
  // 이미지·그라데이션·반투명 배경/잉크는 오판정하지 않고 skip 카운트에 명시한다.
  const parseRgb = (value) => {
    const raw = String(value).trim();
    if (!/^rgba?\(/i.test(raw)) return null;
    const parts = raw.match(/[\d.]+%?/g);
    if (!parts || parts.length < 3) return null;
    const channel = (token) => {
      const n = parseFloat(token);
      return token.endsWith('%') ? (n * 255) / 100 : n;
    };
    return {
      r: channel(parts[0]),
      g: channel(parts[1]),
      b: channel(parts[2]),
      a: parts[3] === undefined ? 1 : parseFloat(parts[3]),
    };
  };
  const relLuminance = ({ r, g, b }) => {
    const linear = (v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  };
  const contrastRatio = (fg, bg) => {
    const l1 = relLuminance(fg);
    const l2 = relLuminance(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const solidBackgroundFor = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        return { skip: style.backgroundImage.includes('gradient(') ? 'gradient' : 'image' };
      }
      const bg = parseRgb(style.backgroundColor);
      if (!bg) {
        if (style.backgroundColor && style.backgroundColor !== 'transparent') return { skip: 'unsupported-color' };
        continue;
      }
      if (bg.a === 0) continue;
      if (bg.a < 0.98) return { skip: 'non-solid' };
      return { color: bg };
    }
    return { color: { r: 255, g: 255, b: 255, a: 1 } }; // 브라우저 캔버스
  };
  const hex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const fontWeightNumber = (value) => {
    if (value === 'bold') return 700;
    if (value === 'normal') return 400;
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 400;
  };

  let de3Contrast = { pass: true };
  let checkedContrast = 0;
  const skippedContrast = { gradient: 0, image: 0, 'non-solid': 0, 'unsupported-color': 0 };
  const skipEvidence = () => Object.entries(skippedContrast)
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${reason}:${count}`)
    .join(', ');
  const contrastSummary = () => {
    const skipped = Object.values(skippedContrast).reduce((sum, n) => sum + n, 0);
    return `contrast ${checkedContrast} checked, ${skipped} skipped${skipped ? ` (${skipEvidence()})` : ''}`;
  };

  for (const el of document.querySelectorAll('body *')) {
    const tag = el.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'svg', 'path'].includes(tag)) continue;
    const text = ownText(el);
    if (text.length < 2) continue;
    if (!isVisible(el)) continue;

    const fg = parseRgb(getComputedStyle(el).color);
    if (!fg || fg.a < 0.98) {
      skippedContrast['unsupported-color'] += 1;
      continue;
    }
    const bg = solidBackgroundFor(el);
    if (bg.skip) {
      skippedContrast[bg.skip] += 1;
      continue;
    }

    checkedContrast += 1;
    const style = getComputedStyle(el);
    const fontSize = parseFloat(style.fontSize);
    const weight = fontWeightNumber(style.fontWeight);
    const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && weight >= 600);
    const isUiText = el.matches('button,input,select,textarea,[role="button"]');
    const limit = isLargeText || isUiText ? 3 : 4.5;
    const ratio = contrastRatio(fg, bg.color);
    if (ratio + 0.005 < limit) {
      de3Contrast = {
        pass: false,
        evidence: `"${text.slice(0, 40)}…" contrast ${ratio.toFixed(2)}:1 on ${hex(bg.color)} (limit ${limit}:1); ${contrastSummary()}`,
      };
      break;
    }
  }
  if (de3Contrast.pass) de3Contrast.evidence = contrastSummary();

  // webfont ② 선언 폰트 미적용(확정 fallback) — 시각 WARN, 보수적.
  // @font-face로 선언된 family인데 document.fonts.check가 false면 미로드 →
  // 그 요소는 fallback으로 렌더·측정된다. 시스템 폰트(미선언 family)는 제외.
  const warnings = [];
  try {
    const declared = new Set();
    try {
      document.fonts.forEach((ff) => declared.add(ff.family.replace(/^["']|["']$/g, '')));
    } catch {
      // 요청 차단으로 FontFaceSet callback이 runnable하지 않은 경우 CSSOM 선언을 사용한다.
    }
    for (const sheet of document.styleSheets) {
      let rules = [];
      try {
        rules = Array.from(sheet.cssRules ?? []);
      } catch {
        rules = [];
      }
      for (const rule of rules) {
        if (rule.type === CSSRule.FONT_FACE_RULE) {
          const family = rule.style.getPropertyValue('font-family').trim().replace(/^["']|["']$/g, '');
          if (family) declared.add(family);
        }
      }
    }
    if (declared.size > 0) {
      const seen = new Set();
      for (const el of document.querySelectorAll('body, body *')) {
        if (!isVisible(el)) continue;
        const fam = getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
        if (!fam || seen.has(fam)) continue;
        seen.add(fam);
        if (declared.has(fam) && !document.fonts.check(`16px "${fam}"`)) {
          warnings.push({ name: 'webfont-not-applied', lane: 'visual', evidence: `선언 폰트 "${fam}" 미로드 — fallback으로 렌더·측정됨` });
          break;
        }
      }
      if (warnings.length === 0) {
        const [fam] = declared;
        warnings.push({ name: 'webfont-not-applied', lane: 'visual', evidence: `선언 폰트 "${fam}" 미로드 — fallback으로 렌더·측정됨` });
      }
    }
  } catch (e) { /* FontFaceSet 미지원/접근 불가 — 조용히 skip */ }

  return { l1, s3, l2, ty1, ty2, de3Contrast, ty5a, warnings };
}

// 로컬 HTML을 데스크탑 viewport로 렌더해 시각 레인 결과를 돌려준다.
// 반환 형식: { findings: [{ id, name, pass, evidence }], warnings: [{ name, lane, evidence }] }.
// warnings는 fail로 승격되지 않는 시각 경고 채널(audit.js combineAudits가 static과 concat).
export async function analyzeVisualTells(htmlPath) {
  const puppeteer = await loadPuppeteer('visual checks (L1/L2/S3/TY1/TY2/DE3 contrast)');
  const browser = await puppeteer.launch({ headless: 'new' });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (url.startsWith('file:') || url.startsWith('data:')) req.continue();
      else req.abort();
    });
    await page.setViewport(VIEWPORTS.desktop);
    await page.goto(pathToFileURL(resolve(htmlPath)).href, { waitUntil: 'networkidle0', timeout: 30000 });
    // networkidle0은 폰트 *전송*까지만 보장한다 — 적용 후 리플로우 전에 재면
    // fontSize/clientWidth 판정(TY1/TY2)이 흔들린다 (slides-grab 검증 레인에서 채용).
    await page.evaluate(() => document.fonts?.ready);
    const { l1, s3, l2, ty1, ty2, de3Contrast, ty5a, warnings = [] } = await page.evaluate(pageAnalyzer);
    return {
      findings: [
        // 억제 휴리스틱 = advisory (납품 차단 안 함, 의도 초과 가능)
        { id: 'L1', name: 'uniform-card-grid', severity: 'advisory', pass: l1.pass, evidence: l1.evidence ?? null },
        { id: 'L2', name: 'center-everything', severity: 'advisory', pass: l2.pass, evidence: l2.evidence ?? null },
        { id: 'S3', name: 'perfect-symmetry', severity: 'advisory', pass: s3.pass, evidence: s3.evidence ?? null },
        { id: 'TY1', name: 'type-scale-chaos', severity: 'advisory', pass: ty1.pass, evidence: ty1.evidence ?? null },
        { id: 'TY2', name: 'measure-discipline', severity: 'advisory', pass: ty2.pass, evidence: ty2.evidence ?? null },
        // 품질 바닥선 = blocking
        { id: 'DE3', name: 'quality-floor', severity: 'blocking', pass: de3Contrast.pass, evidence: de3Contrast.evidence ?? null },
        { id: 'TY5', name: 'hangul-word-break', severity: 'blocking', pass: ty5a.pass, evidence: ty5a.evidence ?? null },
      ],
      warnings,
    };
  } finally {
    await browser.close();
  }
}
