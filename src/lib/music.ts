export const JOURNEY_LAYER_COUNT = 5

const MIN_BPM = 92
const MAX_BPM = 124

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max)
}

const ramp = (progress: number, start: number, end: number): number => {
  if (end <= start) {
    return progress >= end ? 1 : 0
  }

  return clamp((progress - start) / (end - start), 0, 1)
}

export const clampUnit = (value: number): number => {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1)
}

export const midiToFrequency = (midiNote: number): number => {
  return 440 * 2 ** ((midiNote - 69) / 12)
}

export const getLayerMixForProgress = (progressValue: number): number[] => {
  const progress = clampUnit(progressValue)

  return [
    0.68 + 0.32 * ramp(progress, 0, 0.28),
    ramp(progress, 0.14, 0.34),
    ramp(progress, 0.34, 0.56),
    ramp(progress, 0.56, 0.78),
    ramp(progress, 0.76, 0.96),
  ]
}

export const getMusicBpm = (progressValue: number): number => {
  const progress = clampUnit(progressValue)
  const eased = progress ** 0.8
  return MIN_BPM + eased * (MAX_BPM - MIN_BPM)
}

export const getStepDurationSeconds = (bpmValue: number): number => {
  const bpm = clamp(Number.isFinite(bpmValue) ? bpmValue : MIN_BPM, MIN_BPM, MAX_BPM)
  return 60 / bpm / 4
}
