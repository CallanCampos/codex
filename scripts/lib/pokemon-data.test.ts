import {
  buildSourceUrl,
  cleanFlavorText,
  decimetersToMeters,
  hectogramsToKilograms,
  sortPokemonByHeight,
  type PokemonDatasetEntry,
} from './pokemon-data'

describe('sortPokemonByHeight', () => {
  it('sorts by height ascending and dex number for ties', () => {
    const input: PokemonDatasetEntry[] = [
      {
        dexNumber: 4,
        slug: 'delta',
        name: 'Delta',
        heightMeters: 1.2,
        weightKg: 8,
        description: 'd',
        sourceUrl: 'https://www.pokemon.com/us/pokedex/delta',
        cry: 'https://example.com/d.ogg',
        model: 'https://example.com/d.png',
      },
      {
        dexNumber: 1,
        slug: 'alpha',
        name: 'Alpha',
        heightMeters: 0.4,
        weightKg: 2,
        description: 'a',
        sourceUrl: 'https://www.pokemon.com/us/pokedex/alpha',
        cry: 'https://example.com/a.ogg',
        model: 'https://example.com/a.png',
      },
      {
        dexNumber: 2,
        slug: 'beta',
        name: 'Beta',
        heightMeters: 1.2,
        weightKg: 7,
        description: 'b',
        sourceUrl: 'https://www.pokemon.com/us/pokedex/beta',
        cry: 'https://example.com/b.ogg',
        model: 'https://example.com/b.png',
      },
    ]

    const sorted = sortPokemonByHeight(input)
    expect(sorted.map((entry) => entry.slug)).toEqual(['alpha', 'beta', 'delta'])
  })

  it('converts units from pokeapi correctly', () => {
    expect(decimetersToMeters(17)).toBe(1.7)
    expect(hectogramsToKilograms(905)).toBe(90.5)
  })

  it('cleans flavor text and builds source links', () => {
    expect(cleanFlavorText('Line one\nline\ftwo')).toBe('Line one line two')
    expect(buildSourceUrl('pikachu')).toBe('https://www.pokemon.com/us/pokedex/pikachu')
  })
})
