import type { PokemonDatasetEntry } from '../types/pokemon'

export const sortByHeightThenDex = (
  entries: PokemonDatasetEntry[],
): PokemonDatasetEntry[] => {
  return [...entries].sort((a, b) => {
    if (a.heightMeters === b.heightMeters) {
      return a.dexNumber - b.dexNumber
    }

    return a.heightMeters - b.heightMeters
  })
}