import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePokemonDataset } from './lib/validation'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const schemaPath = path.join(projectRoot, 'data', 'pokemon.schema.json')
const defaultDatasetPath = path.join(projectRoot, 'src', 'data', 'pokemon.sorted.json')

const main = async (): Promise<void> => {
  const inputPath = process.argv[2]
    ? path.resolve(process.cwd(), process.argv[2])
    : defaultDatasetPath

  const schemaRaw = await readFile(schemaPath, 'utf8')
  const datasetRaw = await readFile(inputPath, 'utf8')

  const schema = JSON.parse(schemaRaw) as unknown
  const dataset = JSON.parse(datasetRaw) as unknown

  const errors = validatePokemonDataset(schema, dataset)

  if (errors.length > 0) {
    console.error(`Dataset validation failed for ${inputPath}`)
    for (const [index, error] of errors.entries()) {
      console.error(`${index + 1}. ${error}`)
    }
    process.exitCode = 1
    return
  }

  console.log(`Dataset is valid: ${inputPath}`)
}

main().catch((error) => {
  console.error('Unable to validate dataset')
  console.error(error)
  process.exitCode = 1
})