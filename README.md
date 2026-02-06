# Pokemon Size Journey

Neal-style size exploration for Pokemon, powered by PokeAPI and rendered as a static React app.

## Stack
- React + TypeScript + Vite
- Tailwind CSS
- Framer Motion
- Three.js + `@react-three/fiber` + `@react-three/drei` (scaffold only)
- Web Audio API scaffold
- Vitest + React Testing Library
- Playwright (Chromium)

## Features
- Intro gate and step-by-step journey (`Prev` / `Next` + arrow keys)
- Hash deep links (`/#pikachu`)
- Compare mode with side-by-side scaling
- Dynamic background blending by log(height)
- Pokemon dataset pipeline from PokeAPI

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

3. Run development server:
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

## Data Notes
- Species count is fetched dynamically from PokeAPI at build time.
- As of February 6, 2026, PokeAPI `pokemon-species` reports 1025 species.
- Output is sorted from smallest to largest by `heightMeters`.

## Deploy (GitHub Pages)
A workflow is included at `.github/workflows/deploy-pages.yml`.
It builds static assets and publishes to GitHub Pages.

The workflow sets `VITE_BASE_PATH` automatically to match repository pages path.

## Architecture
See `docs/ARCHITECTURE.md` for engine, data pipeline, and background details.
