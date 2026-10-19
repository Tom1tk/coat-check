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

- `app/page.tsx` — the kiosk: composes map, panel, nowcast card, week
  ribbon and settings sheet; one boot-time `<Reveal>`; data swaps happen
  in place (the only other fade is the day switch's tap cross-fade)
- `app/api/rain-tiles/` — server-side tile proxy; holds the OpenWeatherMap
  key so it never reaches the client
- `app/hooks/` — one hook per file (`useWeather` fetches Open-Meteo;
  `useLocation` persists to localStorage; `useMood` picks the weather mood)
- `app/utils/` — pure functions (weather-code mapping, coat rules; the
  view models `panelModel`, `weekRibbon`, `nowcast`; `kioskParams`, `burnIn`)
- `app/components/kiosk/` — the hybrid layout (boards G1/G2): `Panel` (clock,
  verdict, live stats, and `DaySwitch`: the window cards and rain strip,
  which a tap turns to tomorrow's), `NowcastCard`, `WeekRibbon`,
  `SettingsSheet`, `Reveal`. Sizes go through `u()` (1920×1080 reference
  pixels scaled by `--u`); colours only through the mood tokens (`utils/moodPalettes.ts`)
- `app/components/` — shared pieces (`WeatherIcon`, `StatusChip`,
  `RadarTimestamp`, `LocationSearch`, the map background)
- `app/dev/kiosk` — dev-only fixture preview (`?at=`, `?mood=`, `?dark`, `?map`,
  `?settings`, `?tomorrow`); 404 in production
- `components/ui/map.tsx` — VENDORED MapLibre wrapper from mapcn; do not
  edit it for app-level concerns

## URL params (kiosk setup)

Params pin config and win over localStorage: `lat`, `lon` (+ optional
`name`), `zoom` (8/7/6/5), `radar=still`. `?settings` opens the settings
sheet; otherwise it opens on a tap of the place name. Invalid params are
ignored with a `console.warn`.

## Conventions

- All UI is client components (`'use client'`); no server data fetching
  except the rain-tiles proxy route
- State persisted to localStorage: location, zoomLevel, forecastCache (last
  good Open-Meteo payload). Data refresh is driven by data age in
  `hooks/useScheduler.ts` — never by reloads or clock boundaries
- Never build Tailwind class names from template variables — Tailwind can't
  see them at build time; use inline `style` for dynamic values
- Implementation plans live in `plans/` — read `plans/README.md` before
  starting improvement work
