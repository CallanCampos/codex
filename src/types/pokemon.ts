export interface PokemonDatasetEntry {
  dexNumber: number
  slug: string
  name: string
  heightMeters: number
  weightKg: number
  description: string
  sourceUrl: string
  cry: string
  model: string
}

export interface EntryTheme {
  accent: string
  gradientA: string
  gradientB: string
  noiseOpacity: number
}

export interface EntryAssets {
  imageUrl: string
  cryUrl: string
  modelPlaceholder: string
}

export interface Entry {
  id: string
  dexNumber: number
  name: string
  heightMeters: number
  weightKg: number
  description: string
  sourceUrl: string
  theme: EntryTheme
  assets: EntryAssets
}