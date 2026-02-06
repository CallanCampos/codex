import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildSourceUrl,
  cleanFlavorText,
  decimetersToMeters,
  hectogramsToKilograms,
  sortPokemonByHeight,
  type PokemonDatasetEntry,
} from './lib/pokemon-data'

interface NamedResource {
  name: string
  url: string
}

interface PokemonSpeciesListResponse {
  count: number
  results: NamedResource[]
}

interface PokemonResponse {
  id: number
  name: string
  height: number
  weight: number
  cries: {
    latest: string | null
    legacy: string | null
  }
  sprites: {
    other: {
      'official-artwork': {
        front_default: string | null
      }
    }
    front_default: string | null
  }
}

interface PokemonSpeciesResponse {
  id: number
  name: string
  names: Array<{
    name: string
    language: {
      name: string
    }
  }>
  flavor_text_entries: Array<{
    flavor_text: string
    language: {
      name: string
    }
  }>
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const outputFilePath = path.join(projectRoot, 'src', 'data', 'pokemon.sorted.json')

const DEFAULT_CONCURRENCY = 8
const REQUEST_TIMEOUT_MS = 20000

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const titleCaseSlug = (slug: string): string => {
  return slug
    .split('-')
    .filter(Boolean)
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join(' ')
}

const normalizeSlug = (slug: string): string => {
  return slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
}

const fetchJson = async <T>(url: string, retries = 3): Promise<T> => {
  let attempt = 0

  while (attempt <= retries) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => {
        controller.abort()
      }, REQUEST_TIMEOUT_MS)
      let response: Response
      try {
        response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'User-Agent': 'pokemon-size-journey-data-pipeline/1.0',
          },
        })
      } finally {
        clearTimeout(timeout)
      }

      if (!response.ok) {
        const retryAfterHeader = response.headers.get('retry-after')
        const retryAfterMs = retryAfterHeader
          ? Number.parseInt(retryAfterHeader, 10) * 1000
          : undefined
        const error = new Error(`HTTP ${response.status} for ${url}`)
        ;(error as Error & { retryAfterMs?: number }).retryAfterMs = retryAfterMs
        throw error
      }

      return (await response.json()) as T
    } catch (error) {
      if (attempt === retries) {
        throw error
      }

      const retryAfterMs =
        typeof error === 'object' &&
        error &&
        'retryAfterMs' in error &&
        typeof (error as { retryAfterMs?: number }).retryAfterMs === 'number'
          ? (error as { retryAfterMs?: number }).retryAfterMs
          : undefined
      const delayMs = retryAfterMs ?? 600 * 2 ** attempt
      await sleep(delayMs)
      attempt += 1
    }
  }

  throw new Error(`Failed to fetch ${url}`)
}

const runWithConcurrency = async <TInput, TResult>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TResult>,
): Promise<TResult[]> => {
  const results = new Array<TResult>(items.length)
  let cursor = 0

  const runners = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const current = cursor
      cursor += 1
      results[current] = await worker(items[current], current)
    }
  })

  await Promise.all(runners)
  return results
}

const getEnglishName = (species: PokemonSpeciesResponse): string => {
  const english = species.names.find((item) => item.language.name === 'en')
  if (english?.name) {
    return english.name
  }

  return titleCaseSlug(species.name)
}

const getEnglishFlavor = (species: PokemonSpeciesResponse): string => {
  const english = species.flavor_text_entries.find(
    (entry) => entry.language.name === 'en',
  )

  if (english?.flavor_text) {
    return cleanFlavorText(english.flavor_text)
  }

  return `${getEnglishName(species)} is a Pokemon discovered in the National Pokedex.`
}

const buildEntryFromDexNumber = async (
  dexNumber: number,
): Promise<PokemonDatasetEntry> => {
  const [species, pokemon] = await Promise.all([
    fetchJson<PokemonSpeciesResponse>(
      `https://pokeapi.co/api/v2/pokemon-species/${dexNumber}`,
    ),
    fetchJson<PokemonResponse>(`https://pokeapi.co/api/v2/pokemon/${dexNumber}`),
  ])

  const slug = normalizeSlug(species.name)
  const cry = pokemon.cries.latest ?? pokemon.cries.legacy
  const model =
    pokemon.sprites.other['official-artwork'].front_default ??
    pokemon.sprites.front_default

  if (!cry) {
    throw new Error(`Missing cry URL for dex #${dexNumber}`)
  }

  if (!model) {
    throw new Error(`Missing artwork URL for dex #${dexNumber}`)
  }

  return {
    dexNumber,
    slug,
    name: getEnglishName(species),
    heightMeters: decimetersToMeters(pokemon.height),
    weightKg: hectogramsToKilograms(pokemon.weight),
    description: getEnglishFlavor(species),
    sourceUrl: buildSourceUrl(slug),
    cry,
    model,
  }
}

const getSpeciesCount = async (): Promise<number> => {
  const response = await fetchJson<PokemonSpeciesListResponse>(
    'https://pokeapi.co/api/v2/pokemon-species?limit=1',
  )

  if (!Number.isInteger(response.count) || response.count < 1) {
    throw new Error('Invalid pokemon-species count response from PokeAPI')
  }

  return response.count
}

const main = async (): Promise<void> => {
  console.log('Fetching PokeAPI species count...')
  const speciesCount = await getSpeciesCount()
  console.log(`Building dataset for ${speciesCount} species...`)
  console.log(`Using concurrency=${DEFAULT_CONCURRENCY}`)

  const dexNumbers = Array.from({ length: speciesCount }, (_, index) => index + 1)
  const startTime = Date.now()

  const rawEntries = await runWithConcurrency(
    dexNumbers,
    DEFAULT_CONCURRENCY,
    async (dexNumber, index) => {
      const entry = await buildEntryFromDexNumber(dexNumber)
      const processed = index + 1

      if (processed % 50 === 0 || processed === dexNumbers.length) {
        console.log(`Processed ${processed}/${dexNumbers.length}`)
      }

      return entry
    },
  )

  const sortedEntries = sortPokemonByHeight(rawEntries)

  await mkdir(path.dirname(outputFilePath), { recursive: true })
  await writeFile(outputFilePath, JSON.stringify(sortedEntries, null, 2) + '\n', 'utf8')

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`Wrote ${sortedEntries.length} rows to ${outputFilePath} in ${elapsedSec}s`)
}

main().catch((error) => {
  console.error('Failed to build Pokemon dataset')
  console.error(error)
  process.exitCode = 1
})
