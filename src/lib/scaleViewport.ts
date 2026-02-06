export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(value, max))
}

export const computeAutoZoom = (
  tallestHeightMeters: number,
  viewportHeightPx: number,
  basePixelsPerMeter: number,
): number => {
  if (tallestHeightMeters <= 0 || viewportHeightPx <= 0 || basePixelsPerMeter <= 0) {
    return 1
  }

  const usableHeight = viewportHeightPx * 0.72
  const requiredHeight = tallestHeightMeters * basePixelsPerMeter
  const zoom = usableHeight / requiredHeight

  return clamp(zoom, 0.015, 8)
}

export const heightToPixels = (
  heightMeters: number,
  basePixelsPerMeter: number,
  effectiveZoom: number,
): number => {
  return heightMeters * basePixelsPerMeter * effectiveZoom
}