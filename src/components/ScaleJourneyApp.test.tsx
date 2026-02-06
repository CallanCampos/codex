import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScaleJourneyApp } from './ScaleJourneyApp'
import type { Entry } from '../types/pokemon'

const testEntries: Entry[] = [
  {
    id: 'alpha',
    dexNumber: 1,
    name: 'Alpha',
    heightMeters: 0.2,
    weightKg: 2,
    description: 'Alpha description',
    sourceUrl: 'https://www.pokemon.com/us/pokedex/alpha',
    theme: { accent: '#fff', gradientA: '#111', gradientB: '#222', noiseOpacity: 0.1 },
    assets: {
      imageUrl: 'https://example.com/alpha.png',
      cryUrl: 'https://example.com/alpha.ogg',
      modelPlaceholder: 'https://example.com/alpha.png',
    },
  },
  {
    id: 'beta',
    dexNumber: 2,
    name: 'Beta',
    heightMeters: 1.2,
    weightKg: 8,
    description: 'Beta description',
    sourceUrl: 'https://www.pokemon.com/us/pokedex/beta',
    theme: { accent: '#fff', gradientA: '#111', gradientB: '#222', noiseOpacity: 0.1 },
    assets: {
      imageUrl: 'https://example.com/beta.png',
      cryUrl: 'https://example.com/beta.ogg',
      modelPlaceholder: 'https://example.com/beta.png',
    },
  },
  {
    id: 'gamma',
    dexNumber: 3,
    name: 'Gamma',
    heightMeters: 5,
    weightKg: 30,
    description: 'Gamma description',
    sourceUrl: 'https://www.pokemon.com/us/pokedex/gamma',
    theme: { accent: '#fff', gradientA: '#111', gradientB: '#222', noiseOpacity: 0.1 },
    assets: {
      imageUrl: 'https://example.com/gamma.png',
      cryUrl: 'https://example.com/gamma.ogg',
      modelPlaceholder: 'https://example.com/gamma.png',
    },
  },
]

const getHeightPx = (id: string): number => {
  const el = screen.getByTestId(`pokemon-figure-${id}`).querySelector('img')
  return Number.parseFloat(el?.getAttribute('data-height-px') ?? '0')
}

describe('ScaleJourneyApp', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#alpha')
  })

  it('renders intro gate and side-by-side scale stage', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    await user.click(screen.getByTestId('next-button'))

    expect(screen.getByTestId('pokemon-figure-alpha')).toBeInTheDocument()
    expect(screen.getByTestId('pokemon-figure-beta')).toBeInTheDocument()
    expect(getHeightPx('beta')).toBeGreaterThan(getHeightPx('alpha'))
  })

  it('supports keyboard navigation and updates hash', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    await user.keyboard('{ArrowRight}')

    expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Beta')
    expect(window.location.hash).toBe('#beta')
  })

  it('can jump to any pokemon by name', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    await user.type(screen.getByTestId('jump-input'), 'Gamma')
    await user.click(screen.getByTestId('jump-button'))

    await waitFor(() => {
      expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Gamma')
    })
    expect(window.location.hash).toBe('#gamma')
  })

  it('lets user adjust zoom level and updates rendered pixel heights', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    await user.click(screen.getByTestId('next-button'))

    const before = getHeightPx('beta')
    await user.click(screen.getByTestId('zoom-in'))

    await waitFor(() => {
      expect(getHeightPx('beta')).toBeGreaterThan(before)
    })
  })

  it('updates source link when active pokemon changes', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    await user.click(screen.getByTestId('next-button'))

    expect(screen.getByTestId('source-link')).toHaveAttribute(
      'href',
      'https://www.pokemon.com/us/pokedex/beta',
    )
  })
})