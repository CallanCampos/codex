export interface PokemonDatasetEntry {
  dexNumber: number
  slug: string
  name: string
  heightMeters: number
  weightKg: number
  description: string
  sourceUrl: string
  cry: string
  model: string
}

export const decimetersToMeters = (heightDecimeters: number): number => {
  return Number((heightDecimeters / 10).toFixed(2))
}

export const hectogramsToKilograms = (weightHectograms: number): number => {
  return Number((weightHectograms / 10).toFixed(2))
}

export const sortPokemonByHeight = (
  entries: PokemonDatasetEntry[],
): PokemonDatasetEntry[] => {
  return [...entries].sort((a, b) => {
    if (a.heightMeters === b.heightMeters) {
      return a.dexNumber - b.dexNumber
    }

    return a.heightMeters - b.heightMeters
  })
}

export const cleanFlavorText = (raw: string): string => {
  return raw.replace(/[\n\f\r]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export const buildSourceUrl = (slug: string): string => {
  return `https://www.pokemon.com/us/pokedex/${slug}`
}