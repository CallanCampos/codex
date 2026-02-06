import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('centers exactly one active pokemon and updates via wheel', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    fireEvent.wheel(window, { deltaY: 220 })

    await waitFor(() => {
      expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Beta')
    })

    const activeFigures = document.querySelectorAll('[data-active="true"]')
    expect(activeFigures).toHaveLength(1)
    expect(screen.getByTestId('pokemon-figure-alpha')).toBeInTheDocument()
    expect(screen.getByTestId('pokemon-figure-beta')).toBeInTheDocument()
    expect(getHeightPx('beta')).toBeGreaterThan(getHeightPx('alpha'))
  })

  it('shows active description panel and source link', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    expect(screen.getByTestId('active-description')).toHaveTextContent('Alpha description')
    expect(screen.getByTestId('source-link')).toHaveAttribute(
      'href',
      'https://www.pokemon.com/us/pokedex/alpha',
    )

    fireEvent.wheel(window, { deltaY: 220 })
    await waitFor(() => {
      expect(screen.getByTestId('active-description')).toHaveTextContent('Beta description')
    })
  })

  it('orders jump list by dataset order and can jump by name', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))

    const options = screen
      .getByTestId('jump-datalist')
      .querySelectorAll('option')
    expect(Array.from(options).map((option) => option.getAttribute('value'))).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ])

    await user.type(screen.getByTestId('jump-input'), 'Gamma')
    await user.click(screen.getByTestId('jump-button'))

    await waitFor(() => {
      expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Gamma')
    })
    expect(window.location.hash).toBe('#gamma')
  })

  it('uses keyboard navigation and keeps baseline labels below the line', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    await user.keyboard('{ArrowRight}')

    expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Beta')
    expect(window.location.hash).toBe('#beta')
    expect(screen.getByTestId('baseline-line')).toBeInTheDocument()
    expect(screen.getByTestId('pokemon-label-beta')).toBeInTheDocument()
  })

  it('does not render manual zoom controls', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    expect(screen.queryByTestId('zoom-in')).not.toBeInTheDocument()
    expect(screen.queryByTestId('zoom-slider')).not.toBeInTheDocument()
  })
})