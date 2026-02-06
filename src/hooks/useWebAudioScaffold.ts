import { useCallback, useMemo, useRef } from 'react'

export interface WebAudioScaffold {
  isSupported: boolean
  resume: () => Promise<void>
  setMasterVolume: (value: number) => void
}

export const useWebAudioScaffold = (): WebAudioScaffold => {
  const audioContextRef = useRef<AudioContext | null>(null)
  const gainRef = useRef<GainNode | null>(null)

  const isSupported = useMemo(() => {
    return typeof window !== 'undefined' && typeof window.AudioContext !== 'undefined'
  }, [])

  const ensureContext = useCallback(async () => {
    if (!isSupported) {
      return
    }

    if (!audioContextRef.current) {
      const context = new window.AudioContext()
      const gain = context.createGain()
      gain.gain.value = 0.25
      gain.connect(context.destination)

      audioContextRef.current = context
      gainRef.current = gain
    }

    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume()
    }
  }, [isSupported])

  const setMasterVolume = useCallback((value: number) => {
    if (!gainRef.current) {
      return
    }

    gainRef.current.gain.value = Math.max(0, Math.min(value, 1))
  }, [])

  return {
    isSupported,
    resume: ensureContext,
    setMasterVolume,
  }
}