import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clampIndex,
  findEntryIndexBySlug,
  getNextIndex,
  getPreviousIndex,
  getProgressPercent,
  getSizeRatio,
} from '../engine/scaleJourney'
import { formatHeightDualUnits } from '../lib/height'
import { useWebAudioScaffold } from '../hooks/useWebAudioScaffold'
import type { Entry } from '../types/pokemon'
import { BackgroundSystem } from './BackgroundSystem'

interface ScaleJourneyAppProps {
  entries: Entry[]
}

const getSlugFromHash = (): string => {
  const hash = window.location.hash.replace(/^#/, '')
  return decodeURIComponent(hash)
}

const readInitialIndex = (entries: Entry[]): number => {
  if (entries.length === 0) {
    return 0
  }

  const slug = getSlugFromHash()
  if (!slug) {
    return 0
  }

  const index = findEntryIndexBySlug(entries, slug)
  return index >= 0 ? index : 0
}

export const ScaleJourneyApp = ({ entries }: ScaleJourneyAppProps) => {
  const [hasEntered, setHasEntered] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => readInitialIndex(entries))
  const [compareEnabled, setCompareEnabled] = useState(false)
  const [compareSlug, setCompareSlug] = useState(() => entries[0]?.id ?? '')

  const { resume, isSupported: isAudioSupported } = useWebAudioScaffold()

  const safeActiveIndex = clampIndex(activeIndex, entries.length)
  const activeEntry = entries[safeActiveIndex]
  const minHeight = entries[0]?.heightMeters ?? 0.01
  const maxHeight = entries[entries.length - 1]?.heightMeters ?? 1

  const compareEntry = useMemo(() => {
    if (!compareSlug) {
      return undefined
    }

    return entries.find((entry) => entry.id === compareSlug)
  }, [compareSlug, entries])

  const progress = useMemo(() => {
    return getProgressPercent(safeActiveIndex, entries.length)
  }, [safeActiveIndex, entries.length])

  const moveTo = useCallback(
    (index: number) => {
      setActiveIndex(clampIndex(index, entries.length))
    },
    [entries.length],
  )

  const moveNext = useCallback(() => {
    setActiveIndex((current) => getNextIndex(current, entries.length))
  }, [entries.length])

  const movePrevious = useCallback(() => {
    setActiveIndex((current) => getPreviousIndex(current, entries.length))
  }, [entries.length])

  useEffect(() => {
    if (!activeEntry) {
      return
    }

    const newHash = `#${encodeURIComponent(activeEntry.id)}`
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', newHash)
    }
  }, [activeEntry])

  useEffect(() => {
    const onHashChange = () => {
      const slug = getSlugFromHash()
      const index = findEntryIndexBySlug(entries, slug)
      if (index >= 0) {
        moveTo(index)
      }
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [entries, moveTo])

  useEffect(() => {
    if (!hasEntered) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        moveNext()
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        movePrevious()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasEntered, moveNext, movePrevious])

  useEffect(() => {
    if (!activeEntry) {
      return
    }

    const preloadTargets = [safeActiveIndex - 1, safeActiveIndex + 1]
      .map((index) => entries[index])
      .filter((entry): entry is Entry => Boolean(entry))

    for (const target of preloadTargets) {
      const image = new Image()
      image.src = target.assets.imageUrl
    }
  }, [activeEntry, entries, safeActiveIndex])

  const ratioText = useMemo(() => {
    if (!compareEntry || !activeEntry) {
      return 'Pick a Pokemon to compare sizes.'
    }

    const ratio = getSizeRatio(activeEntry.heightMeters, compareEntry.heightMeters)
    if (ratio >= 1) {
      return `${activeEntry.name} is ${ratio.toFixed(2)}x taller than ${compareEntry.name}.`
    }

    return `${compareEntry.name} is ${(1 / ratio).toFixed(2)}x taller than ${activeEntry.name}.`
  }, [activeEntry, compareEntry])

  if (!activeEntry) {
    return (
      <main className="flex min-h-screen items-center justify-center text-white">
        <p>No Pokemon data loaded.</p>
      </main>
    )
  }

  const compareScale = compareEntry
    ? Math.max(0.2, Math.min(1.8, getSizeRatio(compareEntry.heightMeters, activeEntry.heightMeters)))
    : 1

  return (
    <main className="relative min-h-screen overflow-hidden text-slate-100">
      <BackgroundSystem
        currentHeight={activeEntry.heightMeters}
        maxHeight={maxHeight}
        minHeight={minHeight}
      />

      {!hasEntered ? (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/80 backdrop-blur">
          <div className="max-w-xl rounded-3xl border border-white/15 bg-slate-900/80 p-8 text-center shadow-2xl">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-cyan-200/80">Pokemon Scale</p>
            <h1 className="mb-4 text-4xl font-semibold text-white">A Journey Through Size</h1>
            <p className="mb-8 text-slate-300">
              Move from the tiniest to the tallest Pokemon with Neal-style step controls and
              comparison mode.
            </p>
            <button
              className="rounded-full border border-cyan-200/60 bg-cyan-300/20 px-8 py-3 text-lg font-medium text-cyan-100 transition hover:bg-cyan-300/30"
              data-testid="enter-button"
              onClick={async () => {
                setHasEntered(true)
                if (isAudioSupported) {
                  await resume()
                }
              }}
              type="button"
            >
              Enter
            </button>
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/90">Current Pokemon</p>
            <h2 className="text-2xl font-semibold" data-testid="current-entry-title">
              {activeEntry.name}
            </h2>
          </div>

          <div className="min-w-[220px]">
            <div className="mb-1 flex justify-between text-xs text-slate-200/80">
              <span>
                #{activeEntry.dexNumber} of {entries.length}
              </span>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/20">
              <motion.div
                animate={{ width: `${progress}%` }}
                className="h-2 rounded-full bg-cyan-300"
                transition={{ duration: 0.35 }}
              />
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-80px)] max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1.5fr_1fr]">
        <div className="relative flex items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-slate-900/30 p-6">
          <div className="absolute left-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200">
            Height: {formatHeightDualUnits(activeEntry.heightMeters)}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeEntry.id}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="text-center"
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              initial={{ opacity: 0, y: -24, scale: 1.02 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <img
                alt={activeEntry.name}
                className="mx-auto h-[44vh] max-h-[420px] w-auto object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.45)]"
                loading="eager"
                src={activeEntry.assets.imageUrl}
              />
              <p className="mt-4 text-sm uppercase tracking-[0.2em] text-cyan-100/90">
                #{activeEntry.dexNumber}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-3">
            <button
              className="rounded-full border border-white/20 bg-black/35 px-5 py-2 text-sm transition hover:bg-black/50"
              data-testid="prev-button"
              disabled={safeActiveIndex === 0}
              onClick={movePrevious}
              type="button"
            >
              Prev
            </button>
            <button
              className="rounded-full border border-white/20 bg-black/35 px-5 py-2 text-sm transition hover:bg-black/50"
              data-testid="next-button"
              disabled={safeActiveIndex >= entries.length - 1}
              onClick={moveNext}
              type="button"
            >
              Next
            </button>
          </div>
        </div>

        <aside className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-900/45 p-6">
          <div>
            <h3 className="text-sm uppercase tracking-[0.2em] text-cyan-200/90">Profile</h3>
            <p className="mt-2 text-2xl font-semibold">{activeEntry.name}</p>
            <p className="mt-2 text-slate-200">{formatHeightDualUnits(activeEntry.heightMeters)}</p>
            <p className="mt-4 leading-relaxed text-slate-300">{activeEntry.description}</p>
          </div>

          <a
            className="inline-flex w-fit items-center rounded-full border border-cyan-200/50 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-300/20"
            data-testid="source-link"
            href={activeEntry.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Source
          </a>

          <div className="mt-2 border-t border-white/10 pt-4">
            <button
              className="rounded-full border border-white/20 px-4 py-2 text-sm hover:bg-white/10"
              data-testid="compare-toggle"
              onClick={() => setCompareEnabled((value) => !value)}
              type="button"
            >
              {compareEnabled ? 'Hide Compare' : 'Compare To'}
            </button>

            {compareEnabled ? (
              <div className="mt-4 space-y-3">
                <label className="text-xs uppercase tracking-[0.2em] text-slate-300" htmlFor="compare-select">
                  Compare Target
                </label>
                <select
                  className="w-full rounded-xl border border-white/20 bg-slate-950/40 p-2 text-sm"
                  data-testid="compare-select"
                  id="compare-select"
                  onChange={(event) => setCompareSlug(event.target.value)}
                  value={compareSlug}
                >
                  {entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-sm text-slate-200" data-testid="compare-ratio">
                    {ratioText}
                  </p>
                  {compareEntry ? (
                    <div className="mt-3 flex items-end gap-4">
                      <div className="text-center">
                        <img
                          alt={activeEntry.name}
                          className="h-28 w-auto object-contain"
                          src={activeEntry.assets.imageUrl}
                        />
                        <p className="mt-1 text-xs text-slate-300">{activeEntry.name}</p>
                      </div>
                      <div className="text-center">
                        <img
                          alt={compareEntry.name}
                          className="w-auto object-contain"
                          src={compareEntry.assets.imageUrl}
                          style={{ height: `${Math.round(112 * compareScale)}px` }}
                        />
                        <p className="mt-1 text-xs text-slate-300">{compareEntry.name}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  )
}