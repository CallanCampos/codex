import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PokemonDatasetEntry } from '../src/types/pokemon'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const datasetPath = path.join(projectRoot, 'src', 'data', 'pokemon.sorted.json')
const outputMapPath = path.join(projectRoot, 'src', 'data', 'pokemon.models3d.json')
const projectPokemonSvHomeBaseUrl =
  'https://projectpokemon.org/images/sprites-models/sv-sprites-home'

const buildProjectPokemonModelUrl = (dexNumber: number): string => {
  const dex = String(dexNumber).padStart(4, '0')
  return `${projectPokemonSvHomeBaseUrl}/${dex}.png`
}

const main = async (): Promise<void> => {
  const datasetRaw = await readFile(datasetPath, 'utf8')
  const dataset = JSON.parse(datasetRaw) as PokemonDatasetEntry[]

  const mapping: Record<string, string> = {}
  for (const pokemon of dataset) {
    mapping[pokemon.slug] = buildProjectPokemonModelUrl(pokemon.dexNumber)
  }

  await mkdir(path.dirname(outputMapPath), { recursive: true })
  await writeFile(outputMapPath, JSON.stringify(mapping, null, 2) + '\n', 'utf8')

  const generatedCount = Object.keys(mapping).length
  console.log(`Generated ${generatedCount} Project Pokemon model mappings`)
  console.log(`Wrote model map to ${outputMapPath}`)
}

main().catch((error) => {
  console.error('Failed to build Pokemon 3D model assets')
  console.error(error)
  process.exitCode = 1
})
