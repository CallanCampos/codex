import type { Entry } from '../types/pokemon'

export interface TransitionState {
  currentIndex: number
  nextIndex: number
  progress: number
}

export const clampIndex = (index: number, total: number): number => {
  if (total <= 0) {
    return 0
  }

  return Math.max(0, Math.min(index, total - 1))
}

export const getNextIndex = (index: number, total: number): number => {
  return clampIndex(index + 1, total)
}

export const getPreviousIndex = (index: number, total: number): number => {
  return clampIndex(index - 1, total)
}

export const findEntryIndexBySlug = (entries: Entry[], slug: string): number => {
  return entries.findIndex((entry) => entry.id === slug)
}

export const getProgressPercent = (index: number, total: number): number => {
  if (total <= 1) {
    return 100
  }

  return (index / (total - 1)) * 100
}

export const getLogHeightNormalized = (
  heightMeters: number,
  minHeight: number,
  maxHeight: number,
): number => {
  const safeHeight = Math.max(heightMeters, 0.01)
  const minLog = Math.log10(Math.max(minHeight, 0.01))
  const maxLog = Math.log10(Math.max(maxHeight, 0.01))
  const currentLog = Math.log10(safeHeight)

  if (maxLog === minLog) {
    return 0
  }

  return Math.max(0, Math.min((currentLog - minLog) / (maxLog - minLog), 1))
}

export const getSizeRatio = (primaryHeight: number, compareHeight: number): number => {
  if (compareHeight <= 0) {
    return 1
  }

  return primaryHeight / compareHeight
}