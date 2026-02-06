const INCHES_PER_METER = 39.37007874015748

export const parseHeightMeters = (value: string): number | null => {
  const parsed = Number.parseFloat(value.trim())
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

export const formatHeightMeters = (heightMeters: number): string => {
  return `${heightMeters.toFixed(2)} m`
}

export const formatHeightFeetInches = (heightMeters: number): string => {
  const totalInches = Math.round(heightMeters * INCHES_PER_METER)
  const feet = Math.floor(totalInches / 12)
  const inches = totalInches % 12
  return `${feet} ft ${inches} in`
}

export const formatHeightDualUnits = (heightMeters: number): string => {
  return `${formatHeightMeters(heightMeters)} (${formatHeightFeetInches(heightMeters)})`
}