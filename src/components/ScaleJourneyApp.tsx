import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clampIndex, findEntryIndexBySlug, getProgressPercent } from '../engine/scaleJourney'
import { useWebAudioScaffold } from '../hooks/useWebAudioScaffold'
import { formatHeightDualUnits } from '../lib/height'
import { clamp } from '../lib/scaleViewport'
import type { Entry } from '../types/pokemon'
import { BackgroundSystem } from './BackgroundSystem'

interface ScaleJourneyAppProps {
  entries: Entry[]
}

const VISIBLE_WINDOW = 2
const ACTIVE_HEIGHT_RATIO = 0.58
const BASELINE_OFFSET_PX = 112
const WHEEL_STEP_THRESHOLD = 140

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

const isFormControl = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select'
}

export const ScaleJourneyApp = ({ entries }: ScaleJourneyAppProps) => {
  const [hasEntered, setHasEntered] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => readInitialIndex(entries))
  const [jumpQuery, setJumpQuery] = useState('')
  const [stageSize, setStageSize] = useState({ height: 640, width: 1280 })

  const stageRef = useRef<HTMLDivElement | null>(null)
  const wheelAccumulatorRef = useRef(0)

  const { resume, isSupported: isAudioSupported } = useWebAudioScaffold()

  const safeActiveIndex = clampIndex(activeIndex, entries.length)
  const activeEntry = entries[safeActiveIndex]

  const minHeight = entries[0]?.heightMeters ?? 0.01
  const maxHeight = entries[entries.length - 1]?.heightMeters ?? 1

  const visibleEntries = useMemo(() => {
    const start = Math.max(0, safeActiveIndex - VISIBLE_WINDOW)
    const end = Math.min(entries.length - 1, safeActiveIndex + VISIBLE_WINDOW)
    return entries.slice(start, end + 1).map((entry, offset) => ({
      entry,
      index: start + offset,
    }))
  }, [entries, safeActiveIndex])

  const progress = useMemo(() => {
    return getProgressPercent(safeActiveIndex, entries.length)
  }, [safeActiveIndex, entries.length])

  const setActive = useCallback(
    (index: number) => {
      setActiveIndex(clampIndex(index, entries.length))
    },
    [entries.length],
  )

  const jumpToQuery = useCallback(() => {
    const match = findEntryByQuery(entries, jumpQuery)
    if (!match) {
      return
    }

    const index = findEntryIndexBySlug(entries, match.id)
    if (index >= 0) {
      setActive(index)
    }
  }, [entries, jumpQuery, setActive])

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousHtmlOverflow
    }
  }, [])

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
        setActive(index)
      }
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [entries, setActive])

  useEffect(() => {
    if (!hasEntered) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setActive(safeActiveIndex + 1)
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setActive(safeActiveIndex - 1)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasEntered, safeActiveIndex, setActive])

  useEffect(() => {
    if (!hasEntered) {
      return
    }

    const onWheel = (event: WheelEvent) => {
      if (isFormControl(event.target)) {
        return
      }

      event.preventDefault()
      wheelAccumulatorRef.current += event.deltaY

      const steps = Math.trunc(wheelAccumulatorRef.current / WHEEL_STEP_THRESHOLD)
      if (steps === 0) {
        return
      }

      setActiveIndex((current) => clampIndex(current + steps, entries.length))
      wheelAccumulatorRef.current -= steps * WHEEL_STEP_THRESHOLD
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [entries.length, hasEntered])

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
      const width = element.clientWidth
      if (height > 100 && width > 100) {
        setStageSize({ height, width })
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
      <main className="flex h-screen w-screen items-center justify-center overflow-hidden text-white">
        <p>No Pokemon data loaded.</p>
      </main>
    )
  }

  const targetActiveHeightPx = stageSize.height * ACTIVE_HEIGHT_RATIO
  const pixelsPerMeter = targetActiveHeightPx / Math.max(activeEntry.heightMeters, 0.01)
  const slotWidthPx = clamp(stageSize.width * 0.34, 300, 560)

  return (
    <main className="relative h-screen w-screen overflow-hidden text-slate-100">
      <BackgroundSystem
        currentHeight={activeEntry.heightMeters}
        maxHeight={maxHeight}
        minHeight={minHeight}
      />

      {!hasEntered ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/85 backdrop-blur">
          <div className="mx-4 max-w-2xl rounded-3xl border border-white/15 bg-slate-900/85 p-8 text-center shadow-2xl">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-cyan-200/80">Pokemon Scale</p>
            <h1 className="mb-4 text-4xl font-semibold text-white">True Size Journey</h1>
            <p className="mb-3 text-slate-300">
              Scroll to move through Pokemon from smallest to largest.
            </p>
            <p className="mb-8 text-slate-300">
              The focused Pokemon is always centered and kept at a consistent screen size.
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

      <div className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-slate-950/70 to-transparent">
        <div className="flex w-full flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-[180px]">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/90">Current Pokemon</p>
            <h2 className="text-2xl font-semibold" data-testid="current-entry-title">
              {activeEntry.name}
            </h2>
            <p className="text-sm text-slate-300">{formatHeightDualUnits(activeEntry.heightMeters)}</p>
          </div>

          <div className="flex min-w-[260px] flex-1 items-center gap-2">
            <input
              className="w-full rounded-full border border-white/20 bg-slate-950/65 px-4 py-2 text-sm"
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
            <datalist data-testid="jump-datalist" id="pokemon-jump-list">
              {entries.map((entry) => (
                <option key={entry.id} value={entry.name} />
              ))}
            </datalist>
            <button
              className="rounded-full border border-cyan-200/45 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-300/20"
              data-testid="jump-button"
              onClick={jumpToQuery}
              type="button"
            >
              Jump
            </button>
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
        </div>
      </div>

      <aside
        className="absolute bottom-4 left-4 right-4 z-20 rounded-2xl border border-white/10 bg-slate-950/50 p-4 backdrop-blur md:bottom-auto md:left-auto md:right-6 md:top-1/2 md:w-[360px] md:-translate-y-1/2"
        data-testid="active-description"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/85">About {activeEntry.name}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{activeEntry.description}</p>
        <a
          className="mt-3 inline-flex rounded-full border border-cyan-200/45 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-300/20"
          data-testid="source-link"
          href={activeEntry.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          Source
        </a>
      </aside>

      <div className="absolute inset-0 overflow-hidden" ref={stageRef}>
        <div className="absolute inset-x-0 bottom-[112px] h-px bg-white/45" data-testid="baseline-line" />

        <div className="absolute inset-x-0 bottom-0 top-24 overflow-hidden">
          <AnimatePresence initial={false}>
            {visibleEntries.map(({ entry, index }) => {
              const distance = index - safeActiveIndex
              const absoluteDistance = Math.abs(distance)
              const x = distance * slotWidthPx
              const heightPx = Math.max(1, entry.heightMeters * pixelsPerMeter)
              const opacity = index === safeActiveIndex ? 1 : clamp(0.54 - absoluteDistance * 0.18, 0.1, 0.6)
              const isActive = index === safeActiveIndex

              return (
                <motion.div
                  key={entry.id}
                  animate={{ opacity, x, y: isActive ? 0 : 4 }}
                  className="pointer-events-none absolute left-1/2"
                  exit={{ opacity: 0, y: 10 }}
                  initial={{ opacity: 0, y: 10 }}
                  style={{ bottom: `${BASELINE_OFFSET_PX}px` }}
                  transition={{ damping: 28, mass: 0.75, stiffness: 210, type: 'spring' }}
                >
                  <figure
                    className="-translate-x-1/2 flex flex-col items-center"
                    data-active={isActive ? 'true' : 'false'}
                    data-testid={`pokemon-figure-${entry.id}`}
                  >
                    <motion.img
                      alt={entry.name}
                      animate={{ height: heightPx }}
                      className={`w-auto max-w-[18vw] object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.45)] ${
                        isActive ? 'brightness-110' : 'brightness-90'
                      }`}
                      data-height-px={heightPx.toFixed(2)}
                      loading={isActive ? 'eager' : 'lazy'}
                      src={entry.assets.imageUrl}
                      transition={{ duration: 0.48, ease: 'easeOut' }}
                    />
                  </figure>
                </motion.div>
              )
            })}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {visibleEntries.map(({ entry, index }) => {
              const distance = index - safeActiveIndex
              const absoluteDistance = Math.abs(distance)
              const x = distance * slotWidthPx
              const opacity = index === safeActiveIndex ? 1 : clamp(0.5 - absoluteDistance * 0.18, 0.08, 0.5)
              const isActive = index === safeActiveIndex

              return (
                <motion.div
                  key={`${entry.id}-label`}
                  animate={{ opacity, x }}
                  className="pointer-events-none absolute left-1/2"
                  initial={{ opacity: 0 }}
                  style={{ bottom: '20px' }}
                  transition={{ damping: 28, mass: 0.75, stiffness: 210, type: 'spring' }}
                >
                  <div
                    className="-translate-x-1/2 text-center text-xs"
                    data-testid={`pokemon-label-${entry.id}`}
                  >
                    <div className={isActive ? 'font-semibold text-cyan-100' : 'font-medium text-slate-300'}>
                      {entry.name}
                    </div>
                    <div className={isActive ? 'text-cyan-100/95' : 'text-slate-400'}>
                      {entry.heightMeters.toFixed(2)} m
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        <div className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-sm text-slate-300">
          Scroll wheel: down = next, up = previous
        </div>
      </div>
    </main>
  )
}
