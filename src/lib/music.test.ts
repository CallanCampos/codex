import {
  clampUnit,
  getLayerMixForProgress,
  getMusicBpm,
  getStepDurationSeconds,
  midiToFrequency,
} from './music'

describe('music helpers', () => {
  it('clamps progress into unit range', () => {
    expect(clampUnit(-1)).toBe(0)
    expect(clampUnit(0.25)).toBe(0.25)
    expect(clampUnit(3)).toBe(1)
    expect(clampUnit(Number.NaN)).toBe(0)
  })

  it('converts midi note numbers into frequencies', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 5)
    expect(midiToFrequency(60)).toBeCloseTo(261.6255, 3)
    expect(midiToFrequency(48)).toBeCloseTo(130.8127, 3)
  })

  it('starts with one instrument and gradually adds all layers', () => {
    const atStart = getLayerMixForProgress(0)
    const atMiddle = getLayerMixForProgress(0.5)
    const atEnd = getLayerMixForProgress(1)

    expect(atStart).toHaveLength(5)
    expect(atStart[0]).toBeGreaterThan(0)
    expect(atStart.slice(1)).toEqual([0, 0, 0, 0])

    expect(atMiddle[1]).toBeGreaterThan(0)
    expect(atMiddle[2]).toBeGreaterThan(0)
    expect(atMiddle[3]).toBe(0)
    expect(atMiddle[4]).toBe(0)

    expect(atEnd).toEqual([1, 1, 1, 1, 1])
  })

  it('keeps each layer mix monotonic as progress increases', () => {
    const checkpoints = [0, 0.1, 0.25, 0.4, 0.6, 0.8, 1].map((value) =>
      getLayerMixForProgress(value),
    )

    for (let layerIndex = 0; layerIndex < checkpoints[0].length; layerIndex += 1) {
      for (let sampleIndex = 1; sampleIndex < checkpoints.length; sampleIndex += 1) {
        expect(checkpoints[sampleIndex][layerIndex]).toBeGreaterThanOrEqual(
          checkpoints[sampleIndex - 1][layerIndex],
        )
      }
    }
  })

  it('ramps bpm and shortens step duration with progress', () => {
    const startBpm = getMusicBpm(0)
    const endBpm = getMusicBpm(1)

    expect(startBpm).toBeLessThan(endBpm)
    expect(startBpm).toBeGreaterThanOrEqual(92)
    expect(endBpm).toBeLessThanOrEqual(124)

    const stepStart = getStepDurationSeconds(startBpm)
    const stepEnd = getStepDurationSeconds(endBpm)
    expect(stepEnd).toBeLessThan(stepStart)
  })
})
