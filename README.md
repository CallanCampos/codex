# Pokemon Size Journey

 Neal-style size exploration for Pokemon, powered by PokeAPI metadata and local 3D model packs from The Models Resource, rendered as a static React app.

## Stack
- React + TypeScript + Vite
- Tailwind CSS
- Framer Motion
- Three.js + `@react-three/fiber` + `@react-three/drei` (scaffold only)
- Web Audio API layered soundtrack
- Vitest + React Testing Library
- Playwright (Chromium)

## Features
- Intro gate and wheel/arrow-key journey navigation
- True side-by-side scale viewport with shared baseline and accurate relative heights
- Continuous zoom-out as Pokemon heights increase
- Auto zoom that keeps scale comparisons readable
- Jump-to-any-Pokemon search from anywhere in the journey
- Hash deep links (`/#pikachu`)
- Dynamic background blending by log(height)
- Pokemon dataset pipeline from PokeAPI plus local model extraction from `models.spriters-resource.com/3ds/pokemonxy`
- Automatic fallback to front-facing art when a local 3D model is unavailable
- Layered background music that adds instruments as you progress
- Click any visible Pokemon to play its cry
- In-app music mute/unmute control

## Getting Started
Node.js `20.19+` is recommended (Vite 7 requirement).

Enable pnpm via Corepack (if needed):
```bash
corepack enable
```

1. Install dependencies:
```bash
pnpm install
```

2. Build Pokemon dataset:
```bash
pnpm data:build
```

3. Build local 3D model assets:
```bash
pnpm models:build
```

4. Run development server:
```bash
pnpm dev
```

## Scripts
- `pnpm dev` - start local dev server
- `pnpm build` - typecheck + production build
- `pnpm preview` - preview production build
- `pnpm lint` - run ESLint
- `pnpm typecheck` - run TypeScript checks (app + scripts)
- `pnpm test` - run unit + component tests with coverage
- `pnpm test:e2e` - run Playwright E2E (includes dataset build)
- `pnpm data:build` - fetch and generate `src/data/pokemon.sorted.json`
- `pnpm data:validate` - validate dataset against schema
- `pnpm models:build` - download/extract representative Pokemon model packs into `public/models/xy` and generate `src/data/pokemon.models3d.json`

## Data Notes
- Species count is fetched dynamically from PokeAPI at build time.
- As of February 6, 2026, PokeAPI `pokemon-species` reports 1025 species.
- 3D assets are pulled from The Models Resource Pokemon XY section.
- Model mapping is generated in `src/data/pokemon.models3d.json`; entries without a sourced model automatically use front-facing HOME artwork.
- Output is sorted from smallest to largest by `heightMeters`.

## Audio Stems (Optional)
To use your own licensed Pokemon-compatible layered music, place stems in `public/audio/`:
- `pokemon-layer-1.ogg`
- `pokemon-layer-2.ogg`
- `pokemon-layer-3.ogg`
- `pokemon-layer-4.ogg`
- `pokemon-layer-5.ogg`

If those files are absent, the app uses the built-in synthesized fallback track.

## Deploy (GitHub Pages)
A workflow is included at `.github/workflows/deploy-pages.yml`.
It builds static assets and publishes them to the `gh-pages` branch.

The workflow sets `VITE_BASE_PATH` automatically to match repository pages path.

If deployment fails on first run, confirm repository settings:
1. In GitHub, open `Settings -> Pages`.
2. Set `Source` to `Deploy from a branch`.
3. Select branch `gh-pages` and folder `/ (root)`.

## Architecture
See `docs/ARCHITECTURE.md` for engine, data pipeline, and background details.
