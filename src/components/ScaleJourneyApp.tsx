import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clampIndex,
  findEntryIndexBySlug,
  getLogHeightNormalized,
  getProgressPercent,
} from '../engine/scaleJourney'
import { useWebAudioScaffold } from '../hooks/useWebAudioScaffold'
import { formatHeightDualUnits } from '../lib/height'
import { clamp } from '../lib/scaleViewport'
import type { Entry } from '../types/pokemon'
import { BackgroundSystem } from './BackgroundSystem'

interface ScaleJourneyAppProps {
  entries: Entry[]
}

const VISIBLE_WINDOW = 1
const MIN_ACTIVE_HEIGHT_RATIO = 0.48
const MAX_ACTIVE_HEIGHT_RATIO = 0.78
const BASELINE_MIN_OFFSET_PX = 94
const BASELINE_MAX_OFFSET_PX = 126
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
  const [stageSize, setStageSize] = useState({ height: 640, width: 1280 })

  const stageRef = useRef<HTMLDivElement | null>(null)
  const wheelAccumulatorRef = useRef(0)

  const { resume, isSupported: isAudioSupported } = useWebAudioScaffold()

  const safeActiveIndex = clampIndex(activeIndex, entries.length)
  const activeEntry = entries[safeActiveIndex]

  const minHeight = entries[0]?.heightMeters ?? 0.01
  const maxHeight = entries[entries.length - 1]?.heightMeters ?? 1
  const activeHeightMeters = activeEntry?.heightMeters ?? minHeight
  const normalizedScale = getLogHeightNormalized(activeHeightMeters, minHeight, maxHeight)
  const scaleEase = 1 - (1 - normalizedScale) ** 1.4

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

  const jumpToQuery = useCallback(
    (query: string) => {
      const match = findEntryByQuery(entries, query)
      if (!match) {
        return false
      }

      const index = findEntryIndexBySlug(entries, match.id)
      if (index >= 0) {
        setActive(index)
        return true
      }

      return false
    },
    [entries, setActive],
  )

  const onJumpClick = useCallback(() => {
    const query = window.prompt('Jump to Pokemon by name or slug:')
    if (!query) {
      return
    }

    jumpToQuery(query)
  }, [jumpToQuery])

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
      wheelAccumulatorRef.current += -event.deltaY

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

  const activeHeightRatio =
    MIN_ACTIVE_HEIGHT_RATIO + (MAX_ACTIVE_HEIGHT_RATIO - MIN_ACTIVE_HEIGHT_RATIO) * scaleEase
  const baselineOffsetPx = Math.round(
    BASELINE_MIN_OFFSET_PX + (BASELINE_MAX_OFFSET_PX - BASELINE_MIN_OFFSET_PX) * scaleEase,
  )
  const perspectivePx = Math.round(clamp(1700 - scaleEase * 900, 760, 1700))
  const targetActiveHeightPx = stageSize.height * activeHeightRatio
  const pixelsPerMeter = targetActiveHeightPx / Math.max(activeEntry.heightMeters, 0.01)
  const slotWidthPx = clamp(stageSize.width * (0.33 + scaleEase * 0.12), 160, 480)
  const focusBottomMax = Math.max(205, stageSize.height - 268)
  const focusInfoBottom = clamp(baselineOffsetPx + targetActiveHeightPx + 24, 170, focusBottomMax)
  const activeListPosition = safeActiveIndex + 1

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
              The camera pulls back as scale increases so each next Pokemon feels dramatically larger.
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

          <div className="ml-auto min-w-[200px]">
            <div className="mb-1 flex justify-between text-xs text-slate-200/80">
              <span data-testid="list-counter">
                {activeListPosition} of {entries.length}
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

      <button
        className="absolute bottom-5 right-5 z-40 rounded-full border border-cyan-200/40 bg-slate-950/75 px-3 py-1.5 text-xs text-cyan-100 shadow-lg backdrop-blur hover:bg-cyan-300/20"
        data-testid="jump-fab"
        onClick={onJumpClick}
        type="button"
      >
        Jump
      </button>

      <div className="absolute inset-0 overflow-hidden" ref={stageRef}>
        <motion.div
          animate={{ opacity: 0.16 + scaleEase * 0.22, scaleX: 0.96 + scaleEase * 0.36 }}
          className="pointer-events-none absolute inset-x-[-14%] bottom-0 h-[45vh] origin-bottom rounded-[45%] bg-gradient-to-t from-black/40 via-slate-950/25 to-transparent blur-sm"
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
        <div
          className="absolute inset-x-0 h-px bg-white/45"
          data-testid="baseline-line"
          style={{ bottom: `${baselineOffsetPx}px` }}
        />

        <motion.div
          animate={{ bottom: focusInfoBottom }}
          className="absolute left-1/2 z-20 w-[min(88vw,700px)] -translate-x-1/2 text-center"
          data-testid="active-focus-meta"
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <p
            className="text-3xl font-bold leading-tight text-cyan-100 drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)] md:text-5xl"
            data-testid="active-focus-name"
          >
            {activeEntry.name}
          </p>
          <p
            className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-100/95 md:text-base"
            data-testid="active-description"
          >
            {activeEntry.description}
          </p>
          <a
            className="mt-4 inline-flex rounded-full border border-cyan-200/45 px-4 py-1.5 text-xs text-cyan-100 hover:bg-cyan-300/20"
            data-testid="source-link"
            href={activeEntry.sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            Source
          </a>
        </motion.div>

        <motion.div
          animate={{ rotateX: -4 - scaleEase * 6, y: scaleEase * -16 }}
          className="absolute inset-x-0 bottom-0 top-24 overflow-hidden"
          style={{ perspective: `${perspectivePx}px`, transformOrigin: '50% 100%' }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <AnimatePresence initial={false}>
            {visibleEntries.map(({ entry, index }) => {
              const distance = index - safeActiveIndex
              const absoluteDistance = Math.abs(distance)
              const x = distance * slotWidthPx
              const heightPx = Math.max(1, entry.heightMeters * pixelsPerMeter)
              const opacity = index === safeActiveIndex ? 1 : clamp(0.64 - absoluteDistance * 0.15, 0.16, 0.72)
              const isActive = index === safeActiveIndex
              const scale = isActive ? 1 : clamp(0.88 - absoluteDistance * 0.11, 0.58, 0.88)
              const y = isActive ? 0 : 12 + absoluteDistance * 10

              return (
                <motion.div
                  key={entry.id}
                  animate={{ opacity, scale, x, y }}
                  className="pointer-events-none absolute left-1/2"
                  exit={{ opacity: 0, y: 10 }}
                  initial={{ opacity: 0, y: 10 }}
                  style={{ bottom: `${baselineOffsetPx}px` }}
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
                      className={`w-auto max-w-[22vw] object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.45)] ${
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
                  style={{ bottom: '24px' }}
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
        </motion.div>

        <div className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-sm text-slate-300">
          Scroll wheel: up = next, down = previous
        </div>
      </div>
    </main>
  )
}
