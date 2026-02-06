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
})