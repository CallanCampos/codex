import {
  formatHeightDualUnits,
  formatHeightFeetInches,
  formatHeightMeters,
  parseHeightMeters,
} from './height'

describe('height parsing and formatting', () => {
  it('parses valid meter values', () => {
    expect(parseHeightMeters('1.7')).toBe(1.7)
    expect(parseHeightMeters(' 0.25 ')).toBe(0.25)
  })

  it('rejects invalid meter values', () => {
    expect(parseHeightMeters('0')).toBeNull()
    expect(parseHeightMeters('-2')).toBeNull()
    expect(parseHeightMeters('abc')).toBeNull()
  })

  it('formats metric and imperial heights', () => {
    expect(formatHeightMeters(1.7)).toBe('1.70 m')
    expect(formatHeightFeetInches(1.7)).toBe('5 ft 7 in')
    expect(formatHeightDualUnits(1.7)).toBe('1.70 m (5 ft 7 in)')
  })
})