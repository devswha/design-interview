// consent-gated 외부 에셋 수집 — URL의 바이너리 에셋(로고·이미지)을 SSRF 가드로
// 가져와 카테고리 디렉터리에 저장하고 provenance sidecar(.license.txt)를 남긴다.
//
// 보안: fetchBinary가 src/intake.js의 SSRF 가드(assertSafeUrl·guardedLookup·5MB/30s 캡)를
// 그대로 공유한다 — private/loopback/메타데이터 대역·DNS 리바인딩·과대 응답 차단.
// consent: '실제 수집 여부'는 스킬/에이전트가 사용자에게 허락받은 뒤 이 명령을 부른다(SKILL.md).
// 라이선스: 수집물은 출처만 자동 기록되고 license는 REVIEW-REQUIRED — 사용 전 수동 확인.

import { writeFile, mkdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { fetchBinary, looksLikeUrl } from './intake.js';
const USER_FS_ERROR_CODES = new Set(['ENOENT', 'EACCES', 'ENOTDIR', 'EISDIR']);

function tagUserFsError(err) {
  if (USER_FS_ERROR_CODES.has(err.code)) Object.assign(err, { userError: true });
  return err;
}


// URL 또는 --name에서 저장 파일명을 정한다. 확장자 없으면 명시 요구(에셋 종류 판별 위해).
export function deriveFilename(url, name) {
  if (name) {
    // --name도 basename으로 강제 + 확장자 필수 — 디렉터리 분리자나 ..로 outDir를
    // 벗어나는 경로 탈출을 막고, 종류 분류에 필요한 확장자를 보장한다.
    const safe = basename(name);
    if (safe && extname(safe)) return safe;
    throw Object.assign(
      new Error(`invalid --name: ${name} (경로 분리자 없는 파일명 + 확장자 필요)`),
      { userError: true },
    );
  }
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch {
    throw Object.assign(new Error(`invalid URL: ${url}`), { userError: true });
  }
  const base = basename(pathname);
  if (base && extname(base)) return base;
  throw Object.assign(
    new Error(`cannot infer filename from URL; pass --name <file.ext>`),
    { userError: true },
  );
}

// 수집된 Buffer를 outDir에 저장하고 provenance sidecar를 작성한다(네트워크 없음 — 테스트 가능).
export async function saveCrawledAsset(buffer, { url, outDir, name } = {}) {
  const filename = deriveFilename(url, name);
  try {
    await mkdir(outDir, { recursive: true });
    const filePath = join(outDir, filename);
    await writeFile(filePath, buffer);
    const sidecarPath = `${filePath}.license.txt`;
    const sidecar = [
      `asset: ${filename}`,
      `source: crawled:${url}`,
      `license: REVIEW-REQUIRED (수집 출처 라이선스 수동 확인 필요)`,
      `collected: ${new Date().toISOString().slice(0, 10)}`,
      `usage: consent-gated 크롤 결과 — 명목적/라이선스 근거 확인 후 사용. 실재 거짓주장(S2) 금지.`,
      '',
    ].join('\n');
    await writeFile(sidecarPath, sidecar, 'utf8');
    return { filePath, sidecarPath, bytes: buffer.length };
  } catch (err) {
    throw tagUserFsError(err);
  }
}

// URL → 수집 → 저장. fetchImpl은 테스트 주입용(기본 fetchBinary, SSRF 가드 포함).
export async function crawlAsset(url, { outDir = 'assets/images', name, fetchImpl = fetchBinary } = {}) {
  if (!looksLikeUrl(url)) {
    throw Object.assign(new Error(`not a URL: ${url} (http/https만)`), { userError: true });
  }
  // 파일명 사전 검증(저장 전에 실패하도록) — 네트워크 낭비 방지.
  deriveFilename(url, name);
  const buffer = await fetchImpl(url);
  return saveCrawledAsset(buffer, { url, outDir, name });
}
