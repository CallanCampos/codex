import { selectRepresentativePokemonByHeight } from './representative'
import type { PokemonDatasetEntry } from '../types/pokemon'

const base = (partial: Partial<PokemonDatasetEntry>): PokemonDatasetEntry => ({
  dexNumber: 1,
  slug: 'alpha',
  name: 'Alpha',
  heightMeters: 1,
  weightKg: 10,
  description: 'desc',
  sourceUrl: 'https://www.pokemon.com/us/pokedex/alpha',
  cry: 'https://example.com/alpha.ogg',
  model: 'https://example.com/alpha.png',
  ...partial,
})

describe('selectRepresentativePokemonByHeight', () => {
  it('keeps one representative per unique height', () => {
    const input: PokemonDatasetEntry[] = [
      base({ dexNumber: 10, slug: 'caterpie', name: 'Caterpie', heightMeters: 0.3 }),
      base({ dexNumber: 133, slug: 'eevee', name: 'Eevee', heightMeters: 0.3 }),
      base({ dexNumber: 25, slug: 'pikachu', name: 'Pikachu', heightMeters: 0.4 }),
      base({ dexNumber: 96, slug: 'drowzee', name: 'Drowzee', heightMeters: 1 }),
      base({ dexNumber: 6, slug: 'charizard', name: 'Charizard', heightMeters: 1.7 }),
      base({ dexNumber: 149, slug: 'dragonite', name: 'Dragonite', heightMeters: 2.2 }),
      base({ dexNumber: 248, slug: 'tyranitar', name: 'Tyranitar', heightMeters: 2 }),
    ]

    const result = selectRepresentativePokemonByHeight(input)

    expect(result.map((entry) => entry.heightMeters)).toEqual([0.3, 0.4, 1, 1.7, 2, 2.2])
    expect(result.map((entry) => entry.slug)).toContain('eevee')
    expect(result.map((entry) => entry.slug)).not.toContain('caterpie')
  })

  it('preserves ascending height order', () => {
    const input: PokemonDatasetEntry[] = [
      base({ dexNumber: 6, slug: 'charizard', name: 'Charizard', heightMeters: 1.7 }),
      base({ dexNumber: 25, slug: 'pikachu', name: 'Pikachu', heightMeters: 0.4 }),
      base({ dexNumber: 149, slug: 'dragonite', name: 'Dragonite', heightMeters: 2.2 }),
    ]

    const result = selectRepresentativePokemonByHeight(input)
    expect(result.map((entry) => entry.heightMeters)).toEqual([0.4, 1.7, 2.2])
  })
})