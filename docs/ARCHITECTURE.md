# Architecture

## Overview
This project emulates the `neal.fun/size-of-life` interaction model with a Pokemon-driven dataset:
- Intro gate before interaction.
- Step-based journey (next/prev + arrow keys) with continuous zoom-out.
- Hash deep-linking (`/#slug`).
- Jump-to-any-Pokemon controls.
- Dynamic background blending based on Pokemon height.

## Data Pipeline
Data is generated from PokeAPI into `src/data/pokemon.sorted.json`. Visual assets are resolved in two layers:
- Primary: Project Pokemon HOME model-render URLs (`https://projectpokemon.org/images/sprites-models/sv-sprites-home/{dex4}.png`)
- Runtime rendering mode: mesh-backed canvas for local `.dae/.fbx/.glb/.gltf` URLs, image-backed overlay for image URLs

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
   - `model = https://projectpokemon.org/images/sprites-models/sv-sprites-home/{dex4}.png` (fallback art)
5. Sort by `heightMeters` ascending, then `dexNumber` ascending.
6. Write `src/data/pokemon.sorted.json`.

`pnpm models:build` runs `scripts/build-pokemon-models.ts`:
1. Load `pokemon.sorted.json`.
2. Build a Project Pokemon model URL from each entry dex number.
3. Write `src/data/pokemon.models3d.json` as `{ slug: projectPokemonModelUrl }` for all entries.

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
- A visible window of Pokemon around the active index is rendered side-by-side.
- Each Pokemon's rendered pixel height is `heightMeters * pixelsPerMeter`, so relative scale follows dataset heights.
- The active Pokemon remains centered while neighboring entries are kept visible with extra horizontal spacing to avoid clustering.
- If `assets.model3dUrl` exists and WebGL is available, the entry renders in an R3F canvas with local model loading.
- If `assets.model3dUrl` points to an image format, the entry renders that image directly in the model overlay slot.
- If no model overlay URL exists, the entry renders the dataset image fallback.
- Relative local model paths are resolved against Vite `BASE_URL` so GitHub Pages project paths load correctly.

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
- Includes an in-UI mute/unmute toggle wired to master gain.
- Clicking a Pokemon plays the current entry's cry URL.

No copyrighted audio files are embedded in the repository.

## 3D Scaffolding
`src/three/ThreeSceneShell.tsx` remains a feature-flagged R3F canvas placeholder.
