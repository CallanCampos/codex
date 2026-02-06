# Architecture

## Overview
This project emulates the `neal.fun/size-of-life` interaction model with a Pokemon-driven dataset:
- Intro gate before interaction.
- Step-based journey (next/prev + arrow keys).
- Hash deep-linking (`/#slug`).
- Compare mode with a second target.
- Dynamic background blending based on Pokemon height.

## Data Pipeline
Data is generated from PokeAPI into `src/data/pokemon.sorted.json`.

### Schema
`data/pokemon.schema.json` defines required fields:
- `dexNumber`
- `slug`
- `name`
- `heightMeters`
- `weightKg`
- `description`
- `sourceUrl`
- `cry`
- `model`

### Build Flow
`pnpm data:build` runs `scripts/build-pokemon-data.ts`:
1. Fetch `pokemon-species` count from PokeAPI.
2. Iterate dex numbers `1..count`.
3. Fetch `pokemon-species/{id}` and `pokemon/{id}`.
4. Normalize units and text:
   - `heightMeters = height / 10`
   - `weightKg = weight / 10`
   - `description` from cleaned English flavor text.
5. Sort by `heightMeters` ascending, then `dexNumber` ascending.
6. Write `src/data/pokemon.sorted.json`.

### Validation
`pnpm data:validate` uses Ajv against `data/pokemon.schema.json`.
Validation errors are formatted with JSON pointer path + reason + value snippet.

## Journey Engine
`src/engine/scaleJourney.ts` contains deterministic state helpers:
- Index clamp and step transitions.
- Hash slug lookup to entry index.
- Progress percentage from current index.
- Log-height normalization for background selection.
- Size ratio math for compare mode.

## Background Blending
`src/lib/background.ts` defines scene stops across normalized log-height.
`BackgroundSystem` blends between neighboring scene colors using interpolation.
Layers:
- Interpolated gradients.
- Subtle procedural noise overlay.
- Slow parallax blobs.

## Rendering Model
The app is a stage-based (single-entry) renderer, not scroll-virtualized.
Only the active Pokemon is rendered as the primary stage target, with neighbor preloading for smooth transitions.

## URL Behavior
- Initial hash is parsed on load to select the entry.
- Active entry updates `location.hash` via `history.replaceState`.
- `hashchange` updates active index when user edits URL manually.

## 3D and Audio Scaffolding
- `src/three/ThreeSceneShell.tsx` is a feature-flagged R3F canvas placeholder.
- `src/hooks/useWebAudioScaffold.ts` initializes a resumable `AudioContext` and master gain node.