// tests/helpers/puppeteer — puppeteer 게이트 (시각 레인 테스트 전용).
//
// 이 모듈을 import하면 puppeteer 설치 여부를 한 번 탐지한다(모듈 평가 시점).
// 비시각 단위 테스트는 이 파일을 import하지 않는다 — 그래야 puppeteer 미설치/파손
// 환경에서도 그 테스트들이 puppeteer 모듈을 끌어오지 않는다(ROADMAP: 시각 외는 puppeteer 불요).
//
// skip 옵션은 test() 등록 시점(동기)에 평가돼야 하므로 hasPuppeteer는 지연시키지 않는다.

/** puppeteer 설치 여부(설치돼 있으면 true). */
export const hasPuppeteer = await import('puppeteer').then(() => true, () => false);

/** 시각 레인 테스트 옵션 — 미설치면 사유와 함께 skip. */
export const visualTest = { skip: hasPuppeteer ? false : 'puppeteer 미설치 — 시각 레인 skip' };

/** puppeteer 미설치 분기 테스트 옵션 — 설치돼 있으면 skip. */
export const noPuppeteerTest = { skip: hasPuppeteer ? 'puppeteer 설치됨 — 미설치 분기 skip' : false };
