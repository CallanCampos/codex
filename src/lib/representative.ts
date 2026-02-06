import type { PokemonDatasetEntry } from '../types/pokemon'

const POPULARITY_PRIORITY = [
  'pikachu',
  'charizard',
  'mewtwo',
  'eevee',
  'bulbasaur',
  'squirtle',
  'charmander',
  'lucario',
  'gengar',
  'snorlax',
  'dragonite',
  'gardevoir',
  'greninja',
  'rayquaza',
  'garchomp',
  'lapras',
  'arcanine',
  'gyarados',
  'alakazam',
  'machamp',
  'psyduck',
  'jigglypuff',
  'meowth',
  'onix',
  'scyther',
  'ditto',
  'vaporeon',
  'jolteon',
  'flareon',
  'mew',
  'lugia',
  'ho-oh',
  'blaziken',
  'sceptile',
  'swampert',
  'aggron',
  'metagross',
  'salamence',
  'kyogre',
  'groudon',
  'gallade',
  'infernape',
  'empoleon',
  'staraptor',
  'luxray',
  'riolu',
  'dialga',
  'palkia',
  'giratina',
  'arceus',
  'zoroark',
  'bisharp',
  'haxorus',
  'hydreigon',
  'reshiram',
  'zekrom',
  'kyurem',
  'chesnaught',
  'delphox',
  'talonflame',
  'aegislash',
  'goodra',
  'sylveon',
  'xerneas',
  'yveltal',
  'zygarde',
  'decidueye',
  'incineroar',
  'primarina',
  'mimikyu',
  'lycanroc',
  'solgaleo',
  'lunala',
  'necrozma',
  'cinderace',
  'rillaboom',
  'inteleon',
  'corviknight',
  'dragapult',
  'zacian',
  'zamazenta',
  'urshifu',
  'calyrex',
  'sprigatito',
  'quaxly',
  'meowscarada',
  'skeledirge',
  'quaquaval',
  'ceruledge',
  'armarouge',
  'tinkaton',
  'annihilape',
  'kingambit',
  'koraidon',
  'miraidon',
  'pecharunt',
  'eternatus',
]

const priorityMap = new Map<string, number>()
for (const [index, slug] of POPULARITY_PRIORITY.entries()) {
  priorityMap.set(slug, index)
}

const hasResolvedProjectPokemonModel = (modelUrl: string): boolean => {
  return !modelUrl.includes('fallback=1')
}

const getPopularityScore = (entry: PokemonDatasetEntry): number => {
  const priorityIndex = priorityMap.get(entry.slug)
  const priorityScore = priorityIndex !== undefined ? 1_000_000 - priorityIndex * 1_000 : 0
  const dexScore = Math.max(0, 200_000 - entry.dexNumber * 100)
  return priorityScore + dexScore
}

const compareByPopularity = (a: PokemonDatasetEntry, b: PokemonDatasetEntry): number => {
  const scoreDiff = getPopularityScore(b) - getPopularityScore(a)
  if (scoreDiff !== 0) {
    return scoreDiff
  }

  return a.dexNumber - b.dexNumber
}

const compareByHeightThenDex = (a: PokemonDatasetEntry, b: PokemonDatasetEntry): number => {
  if (a.heightMeters === b.heightMeters) {
    return a.dexNumber - b.dexNumber
  }

  return a.heightMeters - b.heightMeters
}

export const selectRepresentativePokemonByHeight = (
  dataset: PokemonDatasetEntry[],
): PokemonDatasetEntry[] => {
  const grouped = new Map<string, PokemonDatasetEntry[]>()

  for (const entry of dataset) {
    const key = entry.heightMeters.toFixed(2)
    const existing = grouped.get(key)
    if (existing) {
      existing.push(entry)
    } else {
      grouped.set(key, [entry])
    }
  }

  const representatives: PokemonDatasetEntry[] = []

  for (const group of grouped.values()) {
    const entriesWithResolvedModel = group.filter((entry) =>
      hasResolvedProjectPokemonModel(entry.model),
    )

    if (entriesWithResolvedModel.length === 0) {
      continue
    }

    const sortedByPopularity = [...entriesWithResolvedModel].sort(compareByPopularity)
    representatives.push(sortedByPopularity[0])
  }

  return representatives.sort(compareByHeightThenDex)
}
