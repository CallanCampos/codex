import { blendHex, getBackgroundBlend } from './background'

describe('background blending', () => {
  it('returns first scene at minimum height and last scene at max height', () => {
    const min = getBackgroundBlend(0.1, 0.1, 20)
    expect(min.normalizedScale).toBe(0)
    expect(min.from.stop).toBe(0)

    const max = getBackgroundBlend(20, 0.1, 20)
    expect(max.normalizedScale).toBe(1)
    expect(max.to.stop).toBe(1)
  })

  it('interpolates scene factor in the middle', () => {
    const mid = getBackgroundBlend(1, 0.1, 20)
    expect(mid.factor).toBeGreaterThanOrEqual(0)
    expect(mid.factor).toBeLessThanOrEqual(1)
  })

  it('blends hex colors deterministically', () => {
    expect(blendHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(blendHex('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(blendHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})