import { getBackgroundBlend } from './background'
import type { Entry, PokemonDatasetEntry } from '../types/pokemon'

export const mapPokemonToEntries = (
  dataset: PokemonDatasetEntry[],
): Entry[] => {
  const minHeight = dataset[0]?.heightMeters ?? 0.1
  const maxHeight = dataset[dataset.length - 1]?.heightMeters ?? 100

  return dataset.map((pokemon) => {
    const blend = getBackgroundBlend(pokemon.heightMeters, minHeight, maxHeight)

    return {
      id: pokemon.slug,
      dexNumber: pokemon.dexNumber,
      name: pokemon.name,
      heightMeters: pokemon.heightMeters,
      weightKg: pokemon.weightKg,
      description: pokemon.description,
      sourceUrl: pokemon.sourceUrl,
      theme: {
        accent: blend.to.accent,
        gradientA: blend.from.gradientA,
        gradientB: blend.to.gradientB,
        noiseOpacity: 0.18,
      },
      assets: {
        imageUrl: pokemon.model,
        cryUrl: pokemon.cry,
        modelPlaceholder: pokemon.model,
      },
    }
  })
}