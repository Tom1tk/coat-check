# CLAUDE.md

Coat Check — a Next.js 16 (App Router, Turbopack) + React 19 + Tailwind 4
weather app answering one question: do you need a coat for the 9–5 commute.
Deployed on Vercel at coat-check.vercel.app.

## Commands

- `npm run dev` — dev server on :3000 (Turbopack)
- `npm run build` — production build (must pass before committing)
- `npx tsc --noEmit` — typecheck (strict mode; must stay clean)
- `npx eslint src` — lint
- `npm test` — Vitest suite

## Environment

- `OWM_API_KEY` in `.env.local` — **optional**. The primary rain overlay is
  RainViewer's keyless radar API (`src/app/utils/radarFrames.ts`,
  `src/app/components/RainViewerBackground.tsx`); this key only powers the
  OpenWeatherMap fallback tiles, read server-side in
  `src/app/api/rain-tiles/[z]/[x]/[y]/route.ts`, used if the RainViewer frame
  index can't be fetched. Copy `.env.example`. Never commit real keys.

## Architecture (src/)

- `app/page.tsx` — main client component: layout, fade choreography, wiring
- `app/api/rain-tiles/` — server-side tile proxy; holds the OpenWeatherMap
  key so it never reaches the client
- `app/hooks/` — one hook per file (`useWeather` fetches Open-Meteo;
  `useLocation` persists to localStorage; `useSunCalc` derives day/night)
- `app/utils/` — pure functions (weather-code mapping, coat rules)
- `app/components/` — presentational components; glass-morphism via the
  `glass-panel` class + `SpotlightCard`
- `components/ui/map.tsx` — VENDORED MapLibre wrapper from mapcn; do not
  edit it for app-level concerns

## Conventions

- All UI is client components (`'use client'`); no server data fetching
  except the rain-tiles proxy route
- State persisted to localStorage: location, zoomLevel, lastRefreshedHour
- Never build Tailwind class names from template variables — Tailwind can't
  see them at build time; use inline `style` for dynamic values
- Implementation plans live in `plans/` — read `plans/README.md` before
  starting improvement work
