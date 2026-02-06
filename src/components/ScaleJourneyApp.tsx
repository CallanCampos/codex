import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clampIndex,
  findEntryIndexBySlug,
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

const ACTIVE_HEIGHT_RATIO = 0.58
const BASELINE_OFFSET_PX = 112
const WHEEL_STEP_THRESHOLD = 140
const ENTRY_WIDTH_FACTOR = 0.38
const MIN_GAP_METERS = 0.18
const MAX_GAP_METERS = 12
const EDGE_FRAME_MARGIN_PX = 26
const ADJACENT_MIN_VISIBLE_FRACTION = 0.2
const MAX_RENDER_DISTANCE = 2

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
  const [isJumpMenuOpen, setIsJumpMenuOpen] = useState(false)
  const [stageSize, setStageSize] = useState({ height: 640, width: 1280 })

  const stageRef = useRef<HTMLDivElement | null>(null)
  const wheelAccumulatorRef = useRef(0)

  const { resume, isSupported: isAudioSupported, setProgress } = useWebAudioScaffold()

  const safeActiveIndex = clampIndex(activeIndex, entries.length)
  const activeEntry = entries[safeActiveIndex]

  const minHeight = entries[0]?.heightMeters ?? 0.01
  const maxHeight = entries[entries.length - 1]?.heightMeters ?? 1
  const activeHeightMeters = activeEntry?.heightMeters ?? minHeight
  const targetActiveHeightPx = stageSize.height * ACTIVE_HEIGHT_RATIO
  const baselineOffsetPx = clamp(BASELINE_OFFSET_PX, 88, stageSize.height * 0.28)

  const worldCenters = useMemo(() => {
    if (entries.length === 0) {
      return []
    }

    const centers = new Array<number>(entries.length).fill(0)
    for (let index = 1; index < entries.length; index += 1) {
      const previous = entries[index - 1]
      const current = entries[index]
      const previousHalfWidth = previous.heightMeters * ENTRY_WIDTH_FACTOR * 0.5
      const currentHalfWidth = current.heightMeters * ENTRY_WIDTH_FACTOR * 0.5
      const averageHeight = (previous.heightMeters + current.heightMeters) * 0.5
      const heightDelta = Math.abs(current.heightMeters - previous.heightMeters)
      const gapMeters = clamp(
        averageHeight * 0.16 + heightDelta * 0.55 + 0.18,
        MIN_GAP_METERS,
        MAX_GAP_METERS,
      )

      centers[index] = centers[index - 1] + previousHalfWidth + gapMeters + currentHalfWidth
    }

    return centers
  }, [entries])

  const preferredPixelsPerMeter = targetActiveHeightPx / Math.max(activeHeightMeters, 0.01)
  const activeWorldX = worldCenters[safeActiveIndex] ?? 0
  const activeNeighborIndices = [safeActiveIndex - 1, safeActiveIndex + 1].filter(
    (index) => index >= 0 && index < entries.length,
  )
  const availableNeighborFramePx = Math.max(stageSize.width * 0.5 - EDGE_FRAME_MARGIN_PX, 32)
  const neighborVisibilityLimit = activeNeighborIndices.reduce((limit, index) => {
    const neighbor = entries[index]
    const neighborWorldX = worldCenters[index] ?? activeWorldX
    const deltaMeters = Math.abs(neighborWorldX - activeWorldX)
    const neighborHalfWidthMeters = neighbor.heightMeters * ENTRY_WIDTH_FACTOR * 0.5
    const denominator =
      deltaMeters - neighborHalfWidthMeters * (1 - ADJACENT_MIN_VISIBLE_FRACTION * 2)
    if (denominator <= 0) {
      return limit
    }
    const allowedPixelsPerMeter = availableNeighborFramePx / denominator
    return Math.min(limit, allowedPixelsPerMeter)
  }, Number.POSITIVE_INFINITY)
  const pixelsPerMeter = Math.min(preferredPixelsPerMeter, neighborVisibilityLimit)

  const renderedEntries = useMemo(() => {
    const viewportHalf = stageSize.width * 0.5
    const overscanPx = stageSize.width * 0.2

    return entries
      .map((entry, index) => {
        const worldX = worldCenters[index] ?? 0
        const x = (worldX - activeWorldX) * pixelsPerMeter
        const heightPx = Math.max(1, entry.heightMeters * pixelsPerMeter)
        const widthPx = Math.max(8, heightPx * ENTRY_WIDTH_FACTOR)
        const distancePx = Math.abs(x)
        const isVisible = distancePx - widthPx * 0.5 <= viewportHalf + overscanPx
        const isActive = index === safeActiveIndex
        const isAdjacent = Math.abs(index - safeActiveIndex) === 1
        const isNearby = Math.abs(index - safeActiveIndex) <= MAX_RENDER_DISTANCE
        const opacity = isActive ? 1 : clamp(0.95 - distancePx / (stageSize.width * 1.28), 0.2, 0.88)
        const scale = isActive ? 1 : clamp(1 - distancePx / (stageSize.width * 3.4), 0.65, 0.98)

        return {
          entry,
          index,
          isActive,
          isVisible,
          isAdjacent,
          isNearby,
          heightPx,
          x,
          opacity,
          scale,
        }
      })
      .filter((item) => item.isNearby && (item.isVisible || item.isAdjacent || item.isActive))
  }, [activeWorldX, entries, pixelsPerMeter, safeActiveIndex, stageSize.width, worldCenters])

  const progress = useMemo(() => {
    return getProgressPercent(safeActiveIndex, entries.length)
  }, [safeActiveIndex, entries.length])

  useEffect(() => {
    if (!hasEntered) {
      return
    }

    setProgress(progress / 100)
  }, [hasEntered, progress, setProgress])

  const setActive = useCallback(
    (index: number) => {
      setActiveIndex(clampIndex(index, entries.length))
    },
    [entries.length],
  )

  const onJumpButtonClick = useCallback(() => {
    setIsJumpMenuOpen((current) => !current)
  }, [])

  const onJumpSelectionChange = useCallback(
    (id: string) => {
      const index = findEntryIndexBySlug(entries, id)
      if (index >= 0) {
        setActive(index)
        setIsJumpMenuOpen(false)
      }
    },
    [entries, setActive],
  )

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

  const perspectivePx = 1140
  const activeHeightPx = Math.max(activeHeightMeters * pixelsPerMeter, 1)
  const focusBottomMax = Math.max(205, stageSize.height - 256)
  const focusInfoBottom = clamp(baselineOffsetPx + activeHeightPx + 18, 170, focusBottomMax)
  const labelBottomPx = Math.round(clamp(baselineOffsetPx * 0.52, 42, baselineOffsetPx - 18))
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

      <div className="absolute bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        <AnimatePresence>
          {isJumpMenuOpen ? (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="w-60 rounded-2xl border border-cyan-200/30 bg-slate-950/90 p-2 shadow-xl backdrop-blur"
              data-testid="jump-menu"
              exit={{ opacity: 0, y: 8 }}
              initial={{ opacity: 0, y: 8 }}
            >
              <select
                className="h-56 w-full rounded-xl border border-white/15 bg-slate-950/80 p-2 text-sm text-slate-100 outline-none"
                data-testid="jump-select"
                onChange={(event) => onJumpSelectionChange(event.target.value)}
                size={10}
                value={activeEntry.id}
              >
                {entries.map((entry, index) => (
                  <option key={entry.id} value={entry.id}>
                    {index + 1}. {entry.name} ({entry.heightMeters.toFixed(2)} m)
                  </option>
                ))}
              </select>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <button
          className="rounded-full border border-cyan-200/40 bg-slate-950/75 px-3 py-1.5 text-xs text-cyan-100 shadow-lg backdrop-blur hover:bg-cyan-300/20"
          data-testid="jump-fab"
          onClick={onJumpButtonClick}
          type="button"
        >
          Jump
        </button>
      </div>

      <div className="absolute inset-0 overflow-hidden" ref={stageRef}>
        <motion.div
          animate={{ opacity: 0.24, scaleX: 1.08 }}
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
          animate={{ rotateX: -8, y: 0 }}
          className="absolute inset-x-0 bottom-0 top-24 overflow-hidden"
          style={{ perspective: `${perspectivePx}px`, transformOrigin: '50% 100%' }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <AnimatePresence initial={false}>
            {renderedEntries.map(({ entry, isActive, x, heightPx, opacity, scale }) => {

              return (
                <motion.div
                  key={entry.id}
                  animate={{ opacity, scale, x, y: 0 }}
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
            {renderedEntries.map(({ entry, isActive, x, opacity }) => {

              return (
                <motion.div
                  key={`${entry.id}-label`}
                  animate={{ opacity, x }}
                  className="pointer-events-none absolute left-1/2"
                  initial={{ opacity: 0 }}
                  style={{ bottom: `${labelBottomPx}px` }}
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
