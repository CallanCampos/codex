import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import AdmZip from 'adm-zip'
import { selectRepresentativePokemonByHeight } from '../src/lib/representative'
import type { PokemonDatasetEntry } from '../src/types/pokemon'

interface AssetMetadata {
  dexNumber: number
  zipUrl: string
}

interface DownloadResult {
  slug: string
  modelPath?: string
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const datasetPath = path.join(projectRoot, 'src', 'data', 'pokemon.sorted.json')
const outputDir = path.join(projectRoot, 'public', 'models', 'xy')
const outputMapPath = path.join(projectRoot, 'src', 'data', 'pokemon.models3d.json')

const gamePageUrl = 'https://models.spriters-resource.com/3ds/pokemonxy/'
const siteBaseUrl = 'https://models.spriters-resource.com'
const assetScanConcurrency = 12
const downloadConcurrency = 4
const requestTimeoutMs = 20000

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const fetchText = async (url: string, retries = 2): Promise<string> => {
  let attempt = 0

  while (attempt <= retries) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => {
        controller.abort()
      }, requestTimeoutMs)
      let response: Response
      try {
        response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'text/html,*/*;q=0.8',
            'User-Agent': 'pokemon-size-journey-model-pipeline/1.0',
          },
        })
      } finally {
        clearTimeout(timeout)
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`)
      }

      return await response.text()
    } catch (error) {
      if (attempt === retries) {
        throw error
      }

      await sleep(400 * 2 ** attempt)
      attempt += 1
    }
  }

  throw new Error(`Failed to fetch ${url}`)
}

const fetchBinary = async (url: string, retries = 2): Promise<ArrayBuffer> => {
  let attempt = 0

  while (attempt <= retries) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => {
        controller.abort()
      }, requestTimeoutMs)
      let response: Response
      try {
        response = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/zip,*/*;q=0.8',
            'User-Agent': 'pokemon-size-journey-model-pipeline/1.0',
          },
        })
      } finally {
        clearTimeout(timeout)
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`)
      }

      return await response.arrayBuffer()
    } catch (error) {
      if (attempt === retries) {
        throw error
      }

      await sleep(400 * 2 ** attempt)
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

const parseAssetIds = (html: string): number[] => {
  const matches = html.matchAll(/\/3ds\/pokemonxy\/asset\/(\d+)\//g)
  const ids = new Set<number>()

  for (const match of matches) {
    ids.add(Number.parseInt(match[1], 10))
  }

  return [...ids]
}

const resolveAssetUrl = (assetPath: string): string => {
  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath
  }

  return `${siteBaseUrl}${assetPath}`
}

const parseAssetMetadata = (html: string): AssetMetadata | null => {
  const dexFromTitle = html.match(/<title>\s*#(\d{4})\s/i)
  const dexFromTable = html.match(/<td>\s*#(\d{4})\s+[A-Za-z0-9]/i)
  const dexRaw = dexFromTitle?.[1] ?? dexFromTable?.[1]

  const zipFromDownloadControl =
    html.match(/id="download"[^>]*href="([^"]+\.zip(?:\?[^"]*)?)"/i)?.[1] ??
    html.match(/href="([^"]+\.zip(?:\?[^"]*)?)"[^>]*id="download"/i)?.[1]
  const zipFromBody = html.match(/(\/media\/assets\/\d+\/\d+\.zip(?:\?updated=\d+)?)/i)?.[1]
  const zipPath = zipFromDownloadControl ?? zipFromBody

  if (!dexRaw || !zipPath) {
    return null
  }

  return {
    dexNumber: Number.parseInt(dexRaw, 10),
    zipUrl: resolveAssetUrl(zipPath),
  }
}

const sanitizeSegment = (segment: string): string => {
  return segment.replace(/[^a-z0-9._-]/gi, '_')
}

const sanitizeZipPath = (entryName: string): string => {
  const parts = entryName
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part.length > 0 && part !== '.' && part !== '..')
    .map((part) => sanitizeSegment(part))

  return parts.join('/')
}

const ALT_FORM_MARKERS = [
  'mega',
  'primal',
  'gmax',
  'eternamax',
  'origin',
  'therian',
  'totem',
  'hisui',
  'alola',
  'galar',
  'paldea',
  'black',
  'white',
  'complete',
  'attack',
  'defense',
  'speed',
]

const scoreModelFile = (entryName: string, slug: string): number => {
  const normalizedName = entryName.replace(/\\/g, '/').toLowerCase()
  const compactSlug = slug.replace(/[^a-z0-9]/gi, '').toLowerCase()
  const compactName = normalizedName.replace(/[^a-z0-9]/gi, '')

  let score = 0

  if (normalizedName.endsWith('.dae')) {
    score += 120
  } else if (normalizedName.endsWith('.fbx')) {
    score += 30
  }

  if (normalizedName.includes('opencollada')) {
    score += 24
  }

  if (normalizedName.includes('colladamax')) {
    score += 14
  }

  if (compactSlug && compactName.includes(compactSlug)) {
    score += 32
  }

  for (const marker of ALT_FORM_MARKERS) {
    if (normalizedName.includes(marker)) {
      score -= 45
    }
  }

  if (/(^|[^a-z0-9])f($|[^a-z0-9])/.test(normalizedName)) {
    score -= 8
  }

  if (/(^|[^a-z0-9])m($|[^a-z0-9])/.test(normalizedName)) {
    score -= 8
  }

  return score
}

const pickModelFileFromZip = (
  entries: AdmZip.IZipEntry[],
  slug: string,
): AdmZip.IZipEntry | null => {
  const files = entries.filter((entry) => !entry.isDirectory)
  const modelFiles = files.filter((entry) => /\.(dae|fbx)$/i.test(entry.entryName))

  if (modelFiles.length === 0) {
    return null
  }

  const sorted = [...modelFiles].sort((a, b) => {
    const scoreDiff = scoreModelFile(b.entryName, slug) - scoreModelFile(a.entryName, slug)
    if (scoreDiff !== 0) {
      return scoreDiff
    }

    return a.entryName.localeCompare(b.entryName)
  })

  return sorted[0]
}

const extractZipToDir = async (
  zip: AdmZip,
  destinationDir: string,
  slug: string,
): Promise<string | null> => {
  const entries = zip.getEntries()
  const modelEntry = pickModelFileFromZip(entries, slug)
  const safeModelPath = modelEntry ? sanitizeZipPath(modelEntry.entryName) : null

  for (const entry of entries) {
    if (entry.isDirectory) {
      continue
    }

    const safeRelativePath = sanitizeZipPath(entry.entryName)
    if (!safeRelativePath) {
      continue
    }

    const outputPath = path.join(destinationDir, safeRelativePath)
    const resolvedOutputPath = path.resolve(outputPath)
    if (!resolvedOutputPath.startsWith(path.resolve(destinationDir))) {
      continue
    }

    await mkdir(path.dirname(resolvedOutputPath), { recursive: true })
    await writeFile(resolvedOutputPath, entry.getData())
  }

  return safeModelPath
}

const main = async (): Promise<void> => {
  const datasetRaw = await readFile(datasetPath, 'utf8')
  const dataset = JSON.parse(datasetRaw) as PokemonDatasetEntry[]
  const representativeEntries = selectRepresentativePokemonByHeight(dataset)

  const representativeByDex = new Map<number, PokemonDatasetEntry>()
  for (const entry of representativeEntries) {
    representativeByDex.set(entry.dexNumber, entry)
  }

  console.log(`Target representative entries: ${representativeByDex.size}`)
  console.log(`Fetching asset index: ${gamePageUrl}`)
  const gamePageHtml = await fetchText(gamePageUrl)
  const assetIds = parseAssetIds(gamePageHtml)
  console.log(`Discovered ${assetIds.length} candidate asset pages`)

  const assetByDex = new Map<number, AssetMetadata>()
  const pendingDex = new Set<number>(representativeByDex.keys())

  await runWithConcurrency(assetIds, assetScanConcurrency, async (assetId, index) => {
    if (pendingDex.size === 0) {
      return
    }

    const assetUrl = `${gamePageUrl}asset/${assetId}/`
    const html = await fetchText(assetUrl)
    const metadata = parseAssetMetadata(html)
    if (!metadata) {
      return
    }

    if (!pendingDex.has(metadata.dexNumber) || assetByDex.has(metadata.dexNumber)) {
      return
    }

    assetByDex.set(metadata.dexNumber, metadata)
    pendingDex.delete(metadata.dexNumber)
    console.log(`Mapped dex #${metadata.dexNumber} (${assetByDex.size}/${representativeByDex.size})`)

    if ((index + 1) % 100 === 0 || index + 1 === assetIds.length) {
      console.log(`Scanned ${index + 1}/${assetIds.length} assets`)
    }
  })

  await rm(outputDir, { recursive: true, force: true })
  await mkdir(outputDir, { recursive: true })

  const results = await runWithConcurrency(
    representativeEntries,
    downloadConcurrency,
    async (entry): Promise<DownloadResult> => {
      const metadata = assetByDex.get(entry.dexNumber)
      if (!metadata) {
        return { slug: entry.slug }
      }

      try {
        const zipBinary = await fetchBinary(metadata.zipUrl)
        const zip = new AdmZip(Buffer.from(zipBinary))
        const slugDirectory = sanitizeSegment(entry.slug)
        const destinationDir = path.join(outputDir, slugDirectory)
        await rm(destinationDir, { recursive: true, force: true })
        await mkdir(destinationDir, { recursive: true })

        const modelRelativePath = await extractZipToDir(zip, destinationDir, entry.slug)
        if (!modelRelativePath) {
          return { slug: entry.slug }
        }

        return {
          slug: entry.slug,
          modelPath: `/models/xy/${slugDirectory}/${modelRelativePath}`,
        }
      } catch (error) {
        console.warn(`Failed to download model ZIP for ${entry.slug}: ${String(error)}`)
        return { slug: entry.slug }
      }
    },
  )

  const mapping: Record<string, string> = {}
  for (const result of results) {
    if (result.modelPath) {
      mapping[result.slug] = result.modelPath
    }
  }

  await writeFile(outputMapPath, JSON.stringify(mapping, null, 2) + '\n', 'utf8')

  const downloadedCount = Object.keys(mapping).length
  const missingCount = representativeEntries.length - downloadedCount
  console.log(`Extracted ${downloadedCount} representative models to ${outputDir}`)
  console.log(`Wrote model map to ${outputMapPath}`)
  if (missingCount > 0) {
    console.warn(`Missing ${missingCount} representative models in source set`)
  }
}

main().catch((error) => {
  console.error('Failed to build Pokemon 3D model assets')
  console.error(error)
  process.exitCode = 1
})
