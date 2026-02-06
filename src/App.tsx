import { lazy, Suspense, useMemo } from 'react'
import pokemonDataset from './data/pokemon.sorted.json'
import { ScaleJourneyApp } from './components/ScaleJourneyApp'
import { mapPokemonToEntries } from './lib/entries'
import { selectRepresentativePokemonByHeight } from './lib/representative'
import type { PokemonDatasetEntry } from './types/pokemon'

const ThreeSceneShell = lazy(async () => {
  const module = await import('./three/ThreeSceneShell')
  return { default: module.ThreeSceneShell }
})

function App() {
  const representativeDataset = useMemo(() => {
    return selectRepresentativePokemonByHeight(pokemonDataset as PokemonDatasetEntry[])
  }, [])

  const entries = useMemo(() => {
    return mapPokemonToEntries(representativeDataset)
  }, [representativeDataset])

  const enableThree = import.meta.env.VITE_ENABLE_3D === 'true'

  return (
    <>
      {enableThree ? (
        <Suspense fallback={null}>
          <ThreeSceneShell />
        </Suspense>
      ) : null}
      <ScaleJourneyApp entries={entries} />
    </>
  )
}

export default App
