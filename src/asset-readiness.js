const VISUAL_ANCHOR_KINDS = new Set(['logo', 'image', 'texture']);

export function assessAssetReadiness({ files = [], conceptSheet = null } = {}) {
  const usableVisualAnchors = files.filter(
    (file) => file.hasSidecar && VISUAL_ANCHOR_KINDS.has(file.kind),
  ).length;

  const reasons = [];
  if (usableVisualAnchors === 0) {
    reasons.push('사용 가능한 시각 앵커 없음: sidecar 있는 logo/image/texture 파일 0개');
  }
  if (conceptSheet?.empty) {
    reasons.push('concept-sheet 에셋 계획 섹션 비어있음');
  }

  return {
    ready: reasons.length === 0,
    usableVisualAnchors,
    reasons,
  };
}
