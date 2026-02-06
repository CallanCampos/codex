import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clampIndex,
  findEntryIndexBySlug,
  getNextIndex,
  getPreviousIndex,
  getProgressPercent,
} from '../engine/scaleJourney'
import { formatHeightDualUnits } from '../lib/height'
import { clamp, computeAutoZoom, heightToPixels } from '../lib/scaleViewport'
import { useWebAudioScaffold } from '../hooks/useWebAudioScaffold'
import type { Entry } from '../types/pokemon'
import { BackgroundSystem } from './BackgroundSystem'

interface ScaleJourneyAppProps {
  entries: Entry[]
}

const BASE_PIXELS_PER_METER = 180
const VISIBLE_WINDOW = 10
const MIN_MANUAL_ZOOM = 0.35
const MAX_MANUAL_ZOOM = 3.5

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

const normalizeQuery = (value: string): string => {
  return value.trim().toLowerCase()
}

const findEntryByQuery = (entries: Entry[], query: string): Entry | undefined => {
  const normalized = normalizeQuery(query)
  if (!normalized) {
    return undefined
  }

  return (
    entries.find((entry) => entry.id === normalized) ??
    entries.find((entry) => entry.name.toLowerCase() === normalized) ??
    entries.find((entry) => entry.name.toLowerCase().includes(normalized))
  )
}

export const ScaleJourneyApp = ({ entries }: ScaleJourneyAppProps) => {
  const [hasEntered, setHasEntered] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => readInitialIndex(entries))
  const [manualZoom, setManualZoom] = useState(1)
  const [jumpQuery, setJumpQuery] = useState('')
  const [stageHeight, setStageHeight] = useState(640)
  const stageRef = useRef<HTMLDivElement | null>(null)

  const { resume, isSupported: isAudioSupported } = useWebAudioScaffold()

  const safeActiveIndex = clampIndex(activeIndex, entries.length)
  const activeEntry = entries[safeActiveIndex]
  const minHeight = entries[0]?.heightMeters ?? 0.01
  const maxHeight = entries[entries.length - 1]?.heightMeters ?? 1

  const visibleStart = Math.max(0, safeActiveIndex - VISIBLE_WINDOW + 1)
  const visibleEntries = useMemo(() => {
    return entries.slice(visibleStart, safeActiveIndex + 1)
  }, [entries, safeActiveIndex, visibleStart])

  const tallestVisibleHeight =
    visibleEntries[visibleEntries.length - 1]?.heightMeters ?? activeEntry?.heightMeters ?? 1

  const autoZoom = useMemo(() => {
    return computeAutoZoom(tallestVisibleHeight, stageHeight, BASE_PIXELS_PER_METER)
  }, [stageHeight, tallestVisibleHeight])

  const effectiveZoom = clamp(autoZoom * manualZoom, 0.015, 12)

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

  const jumpToQuery = useCallback(() => {
    const match = findEntryByQuery(entries, jumpQuery)
    if (!match) {
      return
    }

    const index = findEntryIndexBySlug(entries, match.id)
    if (index >= 0) {
      moveTo(index)
    }
  }, [entries, jumpQuery, moveTo])

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

  useEffect(() => {
    const element = stageRef.current
    if (!element) {
      return
    }

    const applySize = () => {
      const height = element.clientHeight
      if (height > 100) {
        setStageHeight(height)
      }
    }

    applySize()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const observer = new ResizeObserver(() => {
      applySize()
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  if (!activeEntry) {
    return (
      <main className="flex min-h-screen items-center justify-center text-white">
        <p>No Pokemon data loaded.</p>
      </main>
    )
  }

  const activeHeightPx = Math.max(
    1,
    heightToPixels(activeEntry.heightMeters, BASE_PIXELS_PER_METER, effectiveZoom),
  )

  return (
    <main className="relative min-h-screen overflow-hidden text-slate-100">
      <BackgroundSystem
        currentHeight={activeEntry.heightMeters}
        maxHeight={maxHeight}
        minHeight={minHeight}
      />

      {!hasEntered ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/85 backdrop-blur">
          <div className="max-w-2xl rounded-3xl border border-white/15 bg-slate-900/85 p-8 text-center shadow-2xl">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-cyan-200/80">Pokemon Scale</p>
            <h1 className="mb-4 text-4xl font-semibold text-white">True Size Journey</h1>
            <p className="mb-8 text-slate-300">
              Every Pokemon is drawn side-by-side on a shared baseline at the same scale. Move
              forward to zoom farther out as heights increase.
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

      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/45 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-[200px]">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/90">Current Pokemon</p>
            <h2 className="text-2xl font-semibold" data-testid="current-entry-title">
              {activeEntry.name}
            </h2>
            <p className="text-sm text-slate-300">{formatHeightDualUnits(activeEntry.heightMeters)}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-full border border-white/20 bg-black/35 px-4 py-2 text-sm transition hover:bg-black/50 disabled:opacity-40"
              data-testid="prev-button"
              disabled={safeActiveIndex === 0}
              onClick={movePrevious}
              type="button"
            >
              Prev
            </button>
            <button
              className="rounded-full border border-white/20 bg-black/35 px-4 py-2 text-sm transition hover:bg-black/50 disabled:opacity-40"
              data-testid="next-button"
              disabled={safeActiveIndex >= entries.length - 1}
              onClick={moveNext}
              type="button"
            >
              Next
            </button>
          </div>

          <div className="flex min-w-[260px] flex-1 items-center gap-2">
            <input
              className="w-full rounded-full border border-white/20 bg-slate-950/55 px-4 py-2 text-sm"
              data-testid="jump-input"
              list="pokemon-jump-list"
              onChange={(event) => setJumpQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  jumpToQuery()
                }
              }}
              placeholder="Jump to any Pokemon (name or slug)..."
              value={jumpQuery}
            />
            <datalist id="pokemon-jump-list">
              {entries.map((entry) => (
                <option key={entry.id} value={entry.name} />
              ))}
            </datalist>
            <button
              className="rounded-full border border-cyan-200/40 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-300/20"
              data-testid="jump-button"
              onClick={jumpToQuery}
              type="button"
            >
              Jump
            </button>
          </div>

          <div className="min-w-[240px]">
            <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
              <span>View Zoom</span>
              <span data-testid="zoom-value">x{manualZoom.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
                data-testid="zoom-out"
                onClick={() => setManualZoom((value) => clamp(value / 1.2, MIN_MANUAL_ZOOM, MAX_MANUAL_ZOOM))}
                type="button"
              >
                -
              </button>
              <input
                className="w-full"
                data-testid="zoom-slider"
                max={MAX_MANUAL_ZOOM}
                min={MIN_MANUAL_ZOOM}
                onChange={(event) => setManualZoom(Number(event.target.value))}
                step={0.01}
                type="range"
                value={manualZoom}
              />
              <button
                className="rounded-full border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
                data-testid="zoom-in"
                onClick={() => setManualZoom((value) => clamp(value * 1.2, MIN_MANUAL_ZOOM, MAX_MANUAL_ZOOM))}
                type="button"
              >
                +
              </button>
              <button
                className="rounded-full border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
                data-testid="zoom-reset"
                onClick={() => setManualZoom(1)}
                type="button"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="min-w-[200px]">
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

          <a
            className="rounded-full border border-cyan-200/45 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-300/20"
            data-testid="source-link"
            href={activeEntry.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Source
          </a>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-94px)] w-full max-w-[1500px] flex-col px-4 py-4">
        <div className="relative flex-1 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/35" ref={stageRef}>
          <div className="absolute inset-x-0 bottom-12 h-px bg-white/35" />

          <motion.div
            animate={{ height: activeHeightPx }}
            className="absolute bottom-12 left-4 w-px bg-cyan-200/70"
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
          <div className="absolute bottom-[calc(3rem+1px)] left-5 text-xs text-cyan-100/90">
            {formatHeightDualUnits(activeEntry.heightMeters)}
          </div>

          <div className="absolute inset-x-0 bottom-12 top-8 overflow-x-auto">
            <div className="mx-auto flex h-full min-w-max items-end justify-center gap-6 px-14">
              <AnimatePresence initial={false} mode="popLayout">
                {visibleEntries.map((entry) => {
                  const heightPx = Math.max(
                    1,
                    heightToPixels(entry.heightMeters, BASE_PIXELS_PER_METER, effectiveZoom),
                  )
                  const isActive = entry.id === activeEntry.id

                  return (
                    <motion.figure
                      key={entry.id}
                      animate={{ opacity: isActive ? 1 : 0.72, y: isActive ? 0 : 4 }}
                      className="flex flex-col items-center"
                      data-testid={`pokemon-figure-${entry.id}`}
                      exit={{ opacity: 0, y: 8 }}
                      initial={{ opacity: 0, y: 10 }}
                      layout
                      transition={{ duration: 0.35 }}
                    >
                      <motion.img
                        alt={entry.name}
                        animate={{ height: heightPx }}
                        className={`w-auto object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.45)] ${
                          isActive ? 'brightness-110' : 'brightness-90'
                        }`}
                        data-height-px={heightPx.toFixed(2)}
                        loading={isActive ? 'eager' : 'lazy'}
                        src={entry.assets.imageUrl}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                      />
                      <figcaption
                        className={`mt-2 text-center text-xs ${isActive ? 'text-cyan-100' : 'text-slate-300'}`}
                      >
                        <div className="font-medium">{entry.name}</div>
                        <div>{entry.heightMeters.toFixed(2)} m</div>
                      </figcaption>
                    </motion.figure>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-300">
          Showing Pokemon #{visibleEntries[0]?.dexNumber ?? 1} to #{activeEntry.dexNumber} at a
          shared scale. Move next to continue zooming out.
        </div>
      </section>
    </main>
  )
}