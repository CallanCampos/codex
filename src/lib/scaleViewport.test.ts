import { computeAutoZoom, heightToPixels } from './scaleViewport'

describe('scale viewport math', () => {
  it('zooms out as tallest height grows', () => {
    const small = computeAutoZoom(0.2, 800, 180)
    const large = computeAutoZoom(20, 800, 180)

    expect(large).toBeLessThan(small)
  })

  it('converts meters to pixels using zoom and base scale', () => {
    const px = heightToPixels(2, 100, 0.5)
    expect(px).toBe(100)
  })

  it('handles invalid inputs safely', () => {
    expect(computeAutoZoom(0, 800, 180)).toBe(1)
    expect(computeAutoZoom(2, 0, 180)).toBe(1)
    expect(computeAutoZoom(2, 800, 0)).toBe(1)
  })
})