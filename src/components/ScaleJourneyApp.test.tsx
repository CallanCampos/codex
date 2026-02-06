import { render, screen } from '@testing-library/react'
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
]

describe('ScaleJourneyApp', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#alpha')
  })

  it('shows intro gate and enters experience', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Alpha')
  })

  it('supports next/prev and keyboard navigation', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    await user.click(screen.getByTestId('next-button'))
    expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Beta')

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Alpha')
  })

  it('loads from deep-link hash', async () => {
    const user = userEvent.setup()
    window.history.replaceState(null, '', '#beta')

    render(<ScaleJourneyApp entries={testEntries} />)
    await user.click(screen.getByTestId('enter-button'))

    expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Beta')
  })

  it('renders source link and compare mode details', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))

    const sourceLink = screen.getByTestId('source-link')
    expect(sourceLink).toHaveAttribute('href', 'https://www.pokemon.com/us/pokedex/alpha')

    await user.click(screen.getByTestId('compare-toggle'))
    await user.selectOptions(screen.getByTestId('compare-select'), 'beta')

    expect(screen.getByTestId('compare-ratio').textContent).toContain('Alpha')
  })
})
