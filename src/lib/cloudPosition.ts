export interface CloudAnchor {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

export function computeCloudAnchor(params: {
  clickX?: number;
  clickY?: number;
  viewportW: number;
  viewportH: number;
  cloudW?: number;
  cloudH?: number;
}): CloudAnchor {
  const cloudW = Math.min(params.cloudW ?? 328, Math.max(260, params.viewportW - 24));
  const cloudH = Math.min(params.cloudH ?? 470, Math.max(300, params.viewportH - 32));
  const margin = 16;

  // If opened from top bar button without pointer coordinates, place compactly on the right next to the document
  if (typeof params.clickX !== 'number' || typeof params.clickY !== 'number') {
    return {
      left: Math.max(margin, params.viewportW - cloudW - 20),
      top: Math.max(68, Math.min(108, params.viewportH - cloudH - margin)),
      width: cloudW,
      maxHeight: cloudH,
    };
  }

  // Prefer placing the cloud to the right of the click; flip left if insufficient space
  const offset = 18;
  let left = params.clickX + offset;
  if (left + cloudW + margin > params.viewportW) {
    left = params.clickX - cloudW - offset;
  }
  left = Math.max(margin, Math.min(left, params.viewportW - cloudW - margin));

  let top = params.clickY - 48;
  top = Math.max(margin, Math.min(top, params.viewportH - cloudH - margin));

  return {
    left: Math.round(left),
    top: Math.round(top),
    width: Math.round(cloudW),
    maxHeight: Math.round(cloudH),
  };
}
