import { mapPokemonToEntries } from './entries'
import type { PokemonDatasetEntry } from '../types/pokemon'

const dataset: PokemonDatasetEntry[] = [
  {
    dexNumber: 1,
    slug: 'alpha',
    name: 'Alpha',
    heightMeters: 0.2,
    weightKg: 5,
    description: 'alpha desc',
    sourceUrl: 'https://www.pokemon.com/us/pokedex/alpha',
    cry: 'https://example.com/alpha.ogg',
    model: 'https://example.com/alpha.png',
  },
  {
    dexNumber: 2,
    slug: 'beta',
    name: 'Beta',
    heightMeters: 2,
    weightKg: 20,
    description: 'beta desc',
    sourceUrl: 'https://www.pokemon.com/us/pokedex/beta',
    cry: 'https://example.com/beta.ogg',
    model: 'https://example.com/beta.png',
  },
]

describe('mapPokemonToEntries', () => {
  it('maps dataset rows to journey entries with theme and assets', () => {
    const entries = mapPokemonToEntries(dataset)

    expect(entries).toHaveLength(2)
    expect(entries[0].id).toBe('alpha')
    expect(entries[0].assets.imageUrl).toBe(dataset[0].model)
    expect(entries[1].sourceUrl).toBe(dataset[1].sourceUrl)
    expect(entries[0].theme.gradientA).toMatch(/^#/)
    expect(entries[0].assets.model3dUrl).toBeUndefined()
  })

  it('includes local model url when available in the model map', () => {
    const entries = mapPokemonToEntries(dataset, {
      beta: '/models/xy/beta/Beta/Beta_OpenCollada.DAE',
    })

    expect(entries[0].assets.model3dUrl).toBeUndefined()
    expect(entries[1].assets.model3dUrl).toBe('/models/xy/beta/Beta/Beta_OpenCollada.DAE')
  })
})
