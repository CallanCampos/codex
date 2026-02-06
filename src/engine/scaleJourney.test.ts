import {
  clampIndex,
  findEntryIndexBySlug,
  getLogHeightNormalized,
  getNextIndex,
  getPreviousIndex,
  getProgressPercent,
  getSizeRatio,
} from './scaleJourney'
import type { Entry } from '../types/pokemon'

const entries = [
  { id: 'a' },
  { id: 'b' },
  { id: 'c' },
] as Entry[]

describe('scaleJourney engine helpers', () => {
  it('clamps indexes at bounds', () => {
    expect(clampIndex(-2, 3)).toBe(0)
    expect(clampIndex(2, 3)).toBe(2)
    expect(clampIndex(9, 3)).toBe(2)
    expect(clampIndex(1, 0)).toBe(0)
  })

  it('moves next and previous within bounds', () => {
    expect(getNextIndex(0, 3)).toBe(1)
    expect(getNextIndex(2, 3)).toBe(2)
    expect(getPreviousIndex(2, 3)).toBe(1)
    expect(getPreviousIndex(0, 3)).toBe(0)
  })

  it('finds entry index by slug', () => {
    expect(findEntryIndexBySlug(entries, 'b')).toBe(1)
    expect(findEntryIndexBySlug(entries, 'missing')).toBe(-1)
  })

  it('computes deterministic progress percentages', () => {
    expect(getProgressPercent(0, 3)).toBe(0)
    expect(getProgressPercent(1, 3)).toBe(50)
    expect(getProgressPercent(2, 3)).toBe(100)
    expect(getProgressPercent(0, 1)).toBe(100)
  })

  it('normalizes height in log space and clamps range', () => {
    expect(getLogHeightNormalized(0.1, 0.1, 10)).toBe(0)
    expect(getLogHeightNormalized(10, 0.1, 10)).toBe(1)

    const midpoint = getLogHeightNormalized(1, 0.1, 10)
    expect(midpoint).toBeCloseTo(0.5, 5)

    expect(getLogHeightNormalized(0.001, 0.1, 10)).toBe(0)
    expect(getLogHeightNormalized(100, 0.1, 10)).toBe(1)
  })

  it('computes size ratios safely', () => {
    expect(getSizeRatio(10, 2)).toBe(5)
    expect(getSizeRatio(10, 0)).toBe(1)
  })
})