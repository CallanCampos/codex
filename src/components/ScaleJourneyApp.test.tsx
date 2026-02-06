import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScaleJourneyApp } from './ScaleJourneyApp'
import type { Entry } from '../types/pokemon'

const testEntries: Entry[] = [
  {
    id: 'alpha',
    dexNumber: 25,
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
    dexNumber: 493,
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
    dexNumber: 7,
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

const makeTouch = (clientX: number, clientY: number): Touch => {
  return { clientX, clientY } as Touch
}

describe('ScaleJourneyApp', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#alpha')
  })

  it('centers exactly one active pokemon and updates via wheel', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    fireEvent.wheel(window, { deltaY: -220 })

    await waitFor(() => {
      expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Beta')
    })

    const activeFigures = document.querySelectorAll('[data-active="true"]')
    expect(activeFigures).toHaveLength(1)
    expect(screen.getByTestId('pokemon-figure-alpha')).toBeInTheDocument()
    expect(screen.getByTestId('pokemon-figure-beta')).toBeInTheDocument()
    expect(screen.getByTestId('pokemon-figure-gamma')).toBeInTheDocument()
    expect(getHeightPx('beta')).toBeGreaterThan(getHeightPx('alpha'))
  })

  it('moves on a single small wheel input', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    fireEvent.wheel(window, { deltaY: -1 })

    await waitFor(() => {
      expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Beta')
    })
  })

  it('navigates on a single vertical swipe for mobile browsers', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    fireEvent.touchStart(window, { touches: [makeTouch(120, 320)] })
    fireEvent.touchMove(window, { touches: [makeTouch(120, 236)] })
    fireEvent.touchEnd(window, { changedTouches: [makeTouch(120, 224)] })

    await waitFor(() => {
      expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Beta')
    })

    await new Promise((resolve) => {
      setTimeout(resolve, 240)
    })

    fireEvent.touchStart(window, { touches: [makeTouch(120, 212)] })
    fireEvent.touchMove(window, { touches: [makeTouch(120, 294)] })
    fireEvent.touchEnd(window, { changedTouches: [makeTouch(120, 308)] })

    await waitFor(() => {
      expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Alpha')
    })
  })

  it('shows active description panel and source link', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    expect(screen.getByTestId('active-focus-name')).toHaveTextContent('Alpha')
    expect(screen.getByTestId('active-description')).toHaveTextContent('Alpha description')
    expect(screen.getByTestId('source-link')).toHaveAttribute(
      'href',
      'https://www.pokemon.com/us/pokedex/alpha',
    )

    fireEvent.wheel(window, { deltaY: -220 })
    await waitFor(() => {
      expect(screen.getByTestId('active-focus-name')).toHaveTextContent('Beta')
      expect(screen.getByTestId('active-description')).toHaveTextContent('Beta description')
    })
  })

  it('opens jump picker and jumps to selected pokemon', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    await user.click(screen.getByTestId('jump-fab'))
    expect(screen.getByTestId('jump-menu')).toBeInTheDocument()

    await user.selectOptions(screen.getByTestId('jump-select'), 'gamma')
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
    const baselineLine = screen.getByTestId('baseline-line')
    const label = screen.getByTestId('pokemon-label-beta').parentElement
    expect(baselineLine).toBeInTheDocument()
    expect(label).toBeTruthy()
    const baselineBottom = Number.parseFloat((baselineLine as HTMLElement).style.bottom ?? '0')
    const labelBottom = Number.parseFloat((label as HTMLElement).style.bottom ?? '0')
    expect(labelBottom).toBeGreaterThan(0)
    expect(labelBottom).toBeLessThan(baselineBottom)
  })

  it('does not render manual zoom controls', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    expect(screen.queryByTestId('zoom-in')).not.toBeInTheDocument()
    expect(screen.queryByTestId('zoom-slider')).not.toBeInTheDocument()
  })

  it('amplifies perceived scale as taller pokemon become active', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    const alphaFocusedHeight = getHeightPx('alpha')

    fireEvent.wheel(window, { deltaY: -220 })
    await waitFor(() => {
      expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Beta')
    })

    await new Promise((resolve) => {
      setTimeout(resolve, 220)
    })

    fireEvent.wheel(window, { deltaY: -220 })
    await waitFor(() => {
      expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Gamma')
    })

    const alphaWhenGammaFocused = getHeightPx('alpha')
    expect(alphaWhenGammaFocused).toBeLessThanOrEqual(alphaFocusedHeight / 2)
    expect(getHeightPx('gamma')).toBeGreaterThan(alphaWhenGammaFocused)
  })

  it('uses list position counter instead of dex number', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    expect(screen.getByTestId('list-counter')).toHaveTextContent('1 of 3')

    fireEvent.wheel(window, { deltaY: -220 })
    await waitFor(() => {
      expect(screen.getByTestId('current-entry-title')).toHaveTextContent('Beta')
    })
    expect(screen.getByTestId('list-counter')).toHaveTextContent('2 of 3')
  })

  it('toggles the music mute button label', async () => {
    const user = userEvent.setup()
    render(<ScaleJourneyApp entries={testEntries} />)

    await user.click(screen.getByTestId('enter-button'))
    const muteButton = screen.getByTestId('music-mute-button')
    expect(muteButton).toHaveTextContent('Mute Music')

    await user.click(muteButton)
    expect(muteButton).toHaveTextContent('Unmute Music')
  })

  it('plays cry audio when a pokemon is clicked', async () => {
    const user = userEvent.setup()
    const playSpy = vi.fn().mockResolvedValue(undefined)
    const pauseSpy = vi.fn()
    class AudioMockClass {
      public src = ''
      public currentTime = 0
      public volume = 1
      public preload = 'none'

      public play = playSpy

      public pause = pauseSpy
    }
    const AudioMock = vi.fn(AudioMockClass)
    const previousAudio = window.Audio
    Object.defineProperty(window, 'Audio', {
      configurable: true,
      writable: true,
      value: AudioMock,
    })

    try {
      render(<ScaleJourneyApp entries={testEntries} />)
      await user.click(screen.getByTestId('enter-button'))
      await user.click(screen.getByTestId('pokemon-figure-alpha'))

      expect(AudioMock).toHaveBeenCalledTimes(1)
      expect(pauseSpy).toHaveBeenCalled()
      expect(playSpy).toHaveBeenCalled()
    } finally {
      Object.defineProperty(window, 'Audio', {
        configurable: true,
        writable: true,
        value: previousAudio,
      })
    }
  })
})
