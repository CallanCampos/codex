# Architecture

## Overview
This project emulates the `neal.fun/size-of-life` interaction model with a Pokemon-driven dataset:
- Intro gate before interaction.
- Step-based journey (next/prev + arrow keys) with continuous zoom-out.
- Hash deep-linking (`/#slug`).
- Jump-to-any-Pokemon controls.
- Dynamic background blending based on Pokemon height.

## Data Pipeline
Data is generated from PokeAPI into `src/data/pokemon.sorted.json`, with model URLs sourced from ProjectPokemon 3D-model docs pages.

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
   - `model` resolved from ProjectPokemon 3D model GIF directories:
     - `https://projectpokemon.org/images/sprites-models/normal-back/{slug}.gif`
     - `https://projectpokemon.org/images/sprites-models/swsh-normal-sprites/{slug}.gif`
   - unresolved species are assigned a fallback marker URL (`?fallback=1`)
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
The app renders a shared baseline scale viewport (no card-to-card layout):
- A visible window of Pokemon up to the active index is rendered side-by-side.
- All sprites use the same `pixelsPerMeter * effectiveZoom` transform, so relative height is accurate.
- `effectiveZoom = autoZoom(tallestVisible, viewportHeight) * manualZoom`.
- As the active Pokemon gets taller, `autoZoom` decreases to create a smooth zoom-out journey.
- Users can override with manual zoom in/out controls.

## URL Behavior
- Initial hash is parsed on load to select the entry.
- Active entry updates `location.hash` via `history.replaceState`.
- `hashchange` updates active index when user edits URL manually.

## Audio System
`src/hooks/useWebAudioScaffold.ts` supports two paths:
- Preferred: external layered stems (`/audio/pokemon-layer-1.ogg` to `pokemon-layer-5.ogg`) if present.
- Fallback: lightweight procedural score synthesized in Web Audio.

Both paths:
- Starts after user interaction (`Enter`) to satisfy browser autoplay policies.
- Uses a five-layer synth arrangement (lead, bass, chords, arpeggio, percussion).
- Mixes layers via `getLayerMixForProgress(progress)` so early journey stages play one instrument and later stages add full instrumentation.
- Slightly increases tempo across progress for stronger growth perception.

No copyrighted audio files are embedded in the repository.

## 3D Scaffolding
`src/three/ThreeSceneShell.tsx` remains a feature-flagged R3F canvas placeholder.
