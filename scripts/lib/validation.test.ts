import schema from '../../data/pokemon.schema.json'
import { validatePokemonDataset } from './validation'

describe('validatePokemonDataset', () => {
  it('returns actionable messages when schema validation fails', () => {
    const invalidDataset = [
      {
        dexNumber: 25,
        slug: 'pikachu',
        name: 'Pikachu',
        heightMeters: '0.4',
        weightKg: 6,
        description: 'Electric mouse Pokemon',
        sourceUrl: 'not-a-url',
        cry: 'https://example.com/25.ogg',
        model: 'https://example.com/25.png',
      },
    ]

    const errors = validatePokemonDataset(schema, invalidDataset)

    expect(errors.length).toBeGreaterThan(0)
    expect(errors.join('\n')).toContain('/0/heightMeters')
    expect(errors.join('\n')).toContain('/0/sourceUrl')
    expect(errors.join('\n')).toContain('value=')
  })

  it('reports missing required fields with path context', () => {
    const missingFieldDataset = [
      {
        dexNumber: 1,
        slug: 'bulbasaur',
        name: 'Bulbasaur',
        heightMeters: 0.7,
        weightKg: 6.9,
        description: 'A strange seed was planted on its back at birth.',
        sourceUrl: 'https://www.pokemon.com/us/pokedex/bulbasaur',
        cry: 'https://example.com/1.ogg',
      },
    ]

    const errors = validatePokemonDataset(schema, missingFieldDataset)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.join('\n')).toContain("must have required property 'model'")
    expect(errors[0]).toContain('/')
  })
})
