import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  clampUnit,
  getLayerMixForProgress,
  getMusicBpm,
  getStepDurationSeconds,
  midiToFrequency,
} from '../lib/music'

export interface WebAudioScaffold {
  isSupported: boolean
  resume: () => Promise<void>
  setMasterVolume: (value: number) => void
  setProgress: (value: number) => void
}

interface JourneyAudioRuntime {
  context: AudioContext
  layerGains: GainNode[]
  masterGain: GainNode
  noiseBuffer: AudioBuffer
  nextStepTime: number
  schedulerId: number | null
  stepIndex: number
}

const MASTER_GAIN_DEFAULT = 0.22
const LAYER_BASE_GAINS = [0.24, 0.2, 0.16, 0.15, 0.2]
const LOOP_STEPS = 16
const SCHEDULER_LOOKAHEAD_MS = 32
const SCHEDULE_AHEAD_SECONDS = 0.18

const MELODY_PATTERN: Array<number | null> = [
  76,
  null,
  78,
  null,
  81,
  null,
  78,
  null,
  76,
  null,
  74,
  null,
  73,
  null,
  74,
  null,
]
const BASS_PATTERN: Array<number | null> = [40, null, null, null, 40, null, null, null, 36, null, null, null, 38, null, null, null]
const ARP_PATTERN: Array<number | null> = [64, 67, 71, 67, 66, 69, 73, 69, 64, 67, 71, 67, 62, 66, 69, 66]
const CHORD_PATTERN: Array<readonly [number, number, number]> = [
  [64, 67, 71],
  [66, 69, 73],
  [62, 66, 69],
  [64, 67, 71],
]

const getAudioContextConstructor = (): typeof AudioContext | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const legacyWindow = window as unknown as { webkitAudioContext?: typeof AudioContext }
  return window.AudioContext ?? legacyWindow.webkitAudioContext ?? null
}

const createNoiseBuffer = (context: AudioContext): AudioBuffer => {
  const frameCount = context.sampleRate
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < frameCount; index += 1) {
    channel[index] = Math.random() * 2 - 1
  }
  return buffer
}

interface ScheduleToneOptions {
  context: AudioContext
  destination: AudioNode
  duration: number
  frequency: number
  startTime: number
  type: OscillatorType
  volume: number
  detuneCents?: number
  lowpassHz?: number
}

const scheduleTone = ({
  context,
  destination,
  duration,
  frequency,
  startTime,
  type,
  volume,
  detuneCents = 0,
  lowpassHz,
}: ScheduleToneOptions): void => {
  if (!Number.isFinite(frequency) || frequency <= 0 || duration <= 0) {
    return
  }

  const oscillator = context.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startTime)
  oscillator.detune.setValueAtTime(detuneCents, startTime)

  const envelope = context.createGain()
  let outputNode: AudioNode = oscillator
  let filter: BiquadFilterNode | null = null

  if (lowpassHz) {
    filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(lowpassHz, startTime)
    oscillator.connect(filter)
    outputNode = filter
  }

  outputNode.connect(envelope)
  envelope.connect(destination)

  envelope.gain.setValueAtTime(0.0001, startTime)
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startTime + 0.015)
  envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  oscillator.start(startTime)
  oscillator.stop(startTime + duration + 0.04)
  oscillator.onended = () => {
    oscillator.disconnect()
    envelope.disconnect()
    filter?.disconnect()
  }
}

interface ScheduleNoiseOptions {
  context: AudioContext
  destination: AudioNode
  duration: number
  highpassHz: number
  noiseBuffer: AudioBuffer
  startTime: number
  volume: number
}

const scheduleNoise = ({
  context,
  destination,
  duration,
  highpassHz,
  noiseBuffer,
  startTime,
  volume,
}: ScheduleNoiseOptions): void => {
  const source = context.createBufferSource()
  source.buffer = noiseBuffer

  const filter = context.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.setValueAtTime(highpassHz, startTime)

  const envelope = context.createGain()
  envelope.gain.setValueAtTime(0.0001, startTime)
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startTime + 0.004)
  envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  source.connect(filter)
  filter.connect(envelope)
  envelope.connect(destination)

  source.start(startTime)
  source.stop(startTime + duration + 0.03)
  source.onended = () => {
    source.disconnect()
    filter.disconnect()
    envelope.disconnect()
  }
}

const scheduleKick = (
  context: AudioContext,
  destination: AudioNode,
  startTime: number,
  volume: number,
): void => {
  const oscillator = context.createOscillator()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(130, startTime)
  oscillator.frequency.exponentialRampToValueAtTime(48, startTime + 0.09)

  const envelope = context.createGain()
  envelope.gain.setValueAtTime(0.0001, startTime)
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startTime + 0.005)
  envelope.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.11)

  oscillator.connect(envelope)
  envelope.connect(destination)

  oscillator.start(startTime)
  oscillator.stop(startTime + 0.13)
  oscillator.onended = () => {
    oscillator.disconnect()
    envelope.disconnect()
  }
}

const scheduleStep = (
  runtime: JourneyAudioRuntime,
  stepIndex: number,
  startTime: number,
  stepDuration: number,
): void => {
  const melodyNote = MELODY_PATTERN[stepIndex]
  if (melodyNote !== null) {
    scheduleTone({
      context: runtime.context,
      destination: runtime.layerGains[0],
      duration: stepDuration * 0.95,
      frequency: midiToFrequency(melodyNote),
      lowpassHz: 6000,
      startTime,
      type: 'square',
      volume: 0.65,
    })
  }

  const bassNote = BASS_PATTERN[stepIndex]
  if (bassNote !== null) {
    scheduleTone({
      context: runtime.context,
      destination: runtime.layerGains[1],
      duration: stepDuration * 3.5,
      frequency: midiToFrequency(bassNote),
      lowpassHz: 1400,
      startTime,
      type: 'triangle',
      volume: 0.52,
    })
  }

  if (stepIndex % 4 === 0) {
    const chord = CHORD_PATTERN[(stepIndex / 4) % CHORD_PATTERN.length]
    for (const note of chord) {
      scheduleTone({
        context: runtime.context,
        destination: runtime.layerGains[2],
        duration: stepDuration * 3.8,
        frequency: midiToFrequency(note),
        lowpassHz: 3600,
        startTime,
        type: 'sawtooth',
        volume: 0.26,
      })
    }
  }

  const arpNote = ARP_PATTERN[stepIndex]
  if (arpNote !== null) {
    scheduleTone({
      context: runtime.context,
      destination: runtime.layerGains[3],
      duration: stepDuration * 0.85,
      frequency: midiToFrequency(arpNote),
      lowpassHz: 5200,
      startTime,
      type: 'sine',
      volume: 0.38,
      detuneCents: stepIndex % 2 === 0 ? 4 : -4,
    })
  }

  if (stepIndex % 4 === 0) {
    scheduleKick(runtime.context, runtime.layerGains[4], startTime, 0.68)
  }
  if (stepIndex % 8 === 4) {
    scheduleNoise({
      context: runtime.context,
      destination: runtime.layerGains[4],
      duration: 0.11,
      highpassHz: 1200,
      noiseBuffer: runtime.noiseBuffer,
      startTime,
      volume: 0.28,
    })
  }
  if (stepIndex % 2 === 1) {
    scheduleNoise({
      context: runtime.context,
      destination: runtime.layerGains[4],
      duration: 0.05,
      highpassHz: 5200,
      noiseBuffer: runtime.noiseBuffer,
      startTime,
      volume: 0.16,
    })
  }
}

export const useWebAudioScaffold = (): WebAudioScaffold => {
  const runtimeRef = useRef<JourneyAudioRuntime | null>(null)
  const progressRef = useRef(0)

  const isSupported = useMemo(() => {
    return getAudioContextConstructor() !== null
  }, [])

  const applyLayerMix = useCallback((progressValue: number) => {
    const runtime = runtimeRef.current
    if (!runtime) {
      return
    }

    const layerMix = getLayerMixForProgress(progressValue)
    const now = runtime.context.currentTime

    for (let index = 0; index < runtime.layerGains.length; index += 1) {
      const gainNode = runtime.layerGains[index]
      const target = (layerMix[index] ?? 0) * (LAYER_BASE_GAINS[index] ?? 0)

      gainNode.gain.cancelScheduledValues(now)
      gainNode.gain.setValueAtTime(gainNode.gain.value, now)
      gainNode.gain.linearRampToValueAtTime(target, now + 0.35)
    }
  }, [])

  const startScheduler = useCallback((runtime: JourneyAudioRuntime) => {
    if (runtime.schedulerId !== null) {
      return
    }

    const tick = () => {
      while (runtime.nextStepTime < runtime.context.currentTime + SCHEDULE_AHEAD_SECONDS) {
        const bpm = getMusicBpm(progressRef.current)
        const stepDuration = getStepDurationSeconds(bpm)
        scheduleStep(runtime, runtime.stepIndex, runtime.nextStepTime, stepDuration)
        runtime.nextStepTime += stepDuration
        runtime.stepIndex = (runtime.stepIndex + 1) % LOOP_STEPS
      }
    }

    runtime.schedulerId = window.setInterval(tick, SCHEDULER_LOOKAHEAD_MS)
    tick()
  }, [])

  const ensureContext = useCallback(async () => {
    if (!isSupported) {
      return
    }

    if (!runtimeRef.current) {
      const AudioContextConstructor = getAudioContextConstructor()
      if (!AudioContextConstructor) {
        return
      }

      const context = new AudioContextConstructor()
      const compressor = context.createDynamicsCompressor()
      compressor.threshold.setValueAtTime(-22, context.currentTime)
      compressor.knee.setValueAtTime(16, context.currentTime)
      compressor.ratio.setValueAtTime(2.8, context.currentTime)
      compressor.attack.setValueAtTime(0.008, context.currentTime)
      compressor.release.setValueAtTime(0.18, context.currentTime)

      const masterGain = context.createGain()
      masterGain.gain.setValueAtTime(MASTER_GAIN_DEFAULT, context.currentTime)
      masterGain.connect(compressor)
      compressor.connect(context.destination)

      const layerGains = LAYER_BASE_GAINS.map(() => {
        const gain = context.createGain()
        gain.gain.setValueAtTime(0, context.currentTime)
        gain.connect(masterGain)
        return gain
      })

      runtimeRef.current = {
        context,
        layerGains,
        masterGain,
        noiseBuffer: createNoiseBuffer(context),
        nextStepTime: context.currentTime + 0.05,
        schedulerId: null,
        stepIndex: 0,
      }
    }

    const runtime = runtimeRef.current
    if (!runtime) {
      return
    }

    if (runtime.context.state === 'suspended') {
      await runtime.context.resume()
    }

    startScheduler(runtime)
    applyLayerMix(progressRef.current)
  }, [applyLayerMix, isSupported, startScheduler])

  const setMasterVolume = useCallback((value: number) => {
    const runtime = runtimeRef.current
    if (!runtime) {
      return
    }

    const target = clampUnit(value)
    const now = runtime.context.currentTime
    runtime.masterGain.gain.cancelScheduledValues(now)
    runtime.masterGain.gain.setValueAtTime(runtime.masterGain.gain.value, now)
    runtime.masterGain.gain.linearRampToValueAtTime(target, now + 0.2)
  }, [])

  const setProgress = useCallback(
    (value: number) => {
      progressRef.current = clampUnit(value)
      applyLayerMix(progressRef.current)
    },
    [applyLayerMix],
  )

  useEffect(() => {
    return () => {
      const runtime = runtimeRef.current
      if (!runtime) {
        return
      }

      if (runtime.schedulerId !== null) {
        window.clearInterval(runtime.schedulerId)
      }

      runtimeRef.current = null
      void runtime.context.close()
    }
  }, [])

  return {
    isSupported,
    resume: ensureContext,
    setMasterVolume,
    setProgress,
  }
}
