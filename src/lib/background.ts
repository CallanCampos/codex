import { getLogHeightNormalized } from '../engine/scaleJourney'

export interface BackgroundScene {
  stop: number
  gradientA: string
  gradientB: string
  accent: string
}

export interface BackgroundBlend {
  from: BackgroundScene
  to: BackgroundScene
  factor: number
  normalizedScale: number
}

export const BACKGROUND_SCENES: BackgroundScene[] = [
  { stop: 0, gradientA: '#0f172a', gradientB: '#172554', accent: '#67e8f9' },
  { stop: 0.2, gradientA: '#1e293b', gradientB: '#14532d', accent: '#4ade80' },
  { stop: 0.4, gradientA: '#312e81', gradientB: '#1d4ed8', accent: '#93c5fd' },
  { stop: 0.6, gradientA: '#581c87', gradientB: '#be123c', accent: '#f9a8d4' },
  { stop: 0.8, gradientA: '#7c2d12', gradientB: '#ea580c', accent: '#fdba74' },
  { stop: 1, gradientA: '#111827', gradientB: '#0c4a6e', accent: '#fde047' },
]

const findSceneRange = (normalizedScale: number): [BackgroundScene, BackgroundScene] => {
  for (let index = 0; index < BACKGROUND_SCENES.length - 1; index += 1) {
    const current = BACKGROUND_SCENES[index]
    const next = BACKGROUND_SCENES[index + 1]

    if (normalizedScale >= current.stop && normalizedScale <= next.stop) {
      return [current, next]
    }
  }

  return [
    BACKGROUND_SCENES[BACKGROUND_SCENES.length - 2],
    BACKGROUND_SCENES[BACKGROUND_SCENES.length - 1],
  ]
}

export const getBackgroundBlend = (
  currentHeight: number,
  minHeight: number,
  maxHeight: number,
): BackgroundBlend => {
  const normalizedScale = getLogHeightNormalized(currentHeight, minHeight, maxHeight)
  const [from, to] = findSceneRange(normalizedScale)
  const segment = to.stop - from.stop || 1
  const factor = Math.max(0, Math.min((normalizedScale - from.stop) / segment, 1))

  return {
    from,
    to,
    factor,
    normalizedScale,
  }
}

export const blendHex = (start: string, end: string, factor: number): string => {
  const normalize = (value: string): string => value.replace('#', '')
  const from = normalize(start)
  const to = normalize(end)

  const channels = [0, 2, 4].map((offset) => {
    const a = Number.parseInt(from.slice(offset, offset + 2), 16)
    const b = Number.parseInt(to.slice(offset, offset + 2), 16)
    const mixed = Math.round(a + (b - a) * factor)
    return mixed.toString(16).padStart(2, '0')
  })

  return `#${channels.join('')}`
}