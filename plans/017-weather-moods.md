# Plan 017: Weather moods — the whole screen takes the colour of the next 3 hours

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. The reviewer maintains `plans/README.md` — do
> not edit it.
>
> **Drift check (run first)**: `git log --oneline -1` → on branch
> `advisor/017-weather-moods`, cut from `staging` **after 016 merged**.
> `grep -n "\-\-accent-coat" src/app/globals.css` and
> `grep -n "export function describeCode" src/app/utils/weatherCodes.ts`
> → both must match. On mismatch, STOP.

## Status

- **Priority**: P2 (the user's own idea; the biggest at-a-glance gain)
- **Effort**: S–M
- **Risk**: LOW (CSS tokens + one pure function)
- **Depends on**: 014, 016
- **Category**: UI / UX
- **Planned at**: commit `d7af640`, 2026-10-17
- **Source**: `plans/2026-10-audit.md` U6; mockup boards F, G1 (Overcast), G2 (Rain)

## Why this matters

From across the porch, colour reads before any text does. If the palette
follows the next 3 hours (cream = clear, grey = overcast, deep blue = rain),
the screen answers the question before you get close. It also replaces the
manual light/dark toggle.

## Design (decided — do not re-derive)

```ts
// src/app/utils/mood.ts
export type Mood = 'clear' | 'overcast' | 'rain' | 'frost' | 'storm' | 'night';
export function getMood(f: Forecast, now: Date): Mood
export function stableMood(prev: { mood: Mood; pending: Mood | null; count: number },
                           next: Mood): { mood: Mood; pending: Mood | null; count: number }
// hysteresis: switch only after `next` is seen on 2 consecutive updates
```

`getMood` looks at the next 3 hourly slots, in priority order:
1. **storm** — any `thunder` group, or max gust ≥ 40 mph
2. **rain** — any slot wet (014's `WET` rule)
3. **frost** — min feels-like ≤ 2 °C, or a `snow`/`freezing` group
4. **night** — not `isDaytime` (and none of the above)
5. **overcast** — dominant group `cloud`/`fog`/`drizzle` (code ≥ 3)
6. **clear** — otherwise

Darkness follows the sun: `rain`, `storm` and `night` use dark ink-on-dark
palettes; at night `frost` and `overcast` use their dark variants
(`data-mood="overcast" data-dark`).

- `useMood(forecast)` → `<html data-mood=… data-dark?>`; recomputed on each
  forecast update and on the 1-minute clock tick for the sunset flip.
- Palettes are defined in `globals.css` as `:root[data-mood="rain"] { --surface…; --ink…; --map-tint… }`,
  using the same token names as plan 016. Take the hex values from board F
  (`WeatherMoods.dc.html` in the mockup artifact). Copy them; don't re-pick.
- **Crossfade**: `transition: background-color 60s, color 60s` on the
  token-driven surfaces (CSS only).
- **Basemap**: CARTO Positron (light moods) / Dark Matter (dark moods), plus
  a `--map-tint` overlay div at 10–14% opacity **above the basemap and below
  the radar**. The radar keeps its true colours.
- **Orange = coat**: `--accent-coat` is the same orange in all six palettes.
  No mood may use orange or amber for anything else.
- Remove `useAutoTheme` and `next-themes`' manual toggle path; keep
  `next-themes` only if something else uses it (check first).

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Lint      | `npx eslint src`   | exit 0, 0 warnings  |
| Tests     | `npm test`         | all pass            |
| Build     | `npm run build`    | exit 0              |

## Scope

**In scope**:
- `utils/mood.ts` + `mood.test.ts`; `utils/moodPalettes.ts` (the same hex
  values exported as data for the contrast test — single source; generate the
  CSS from it, or the test reads both and checks they match)
- `hooks/useMood.ts`; delete `hooks/useAutoTheme.ts` (and `useSunCalc` if
  014 left it as a thin wrapper)
- `globals.css`, `RainViewerBackground.tsx` (style switch + tint overlay)
- `/dev/kiosk` from 016: add `?mood=` to preview each palette

**Out of scope**: layout changes; new data sources.

## Git workflow

Branch `advisor/017-weather-moods` from `staging`. Commit per step. Do NOT
push or open a PR.

## Steps

### Step 1: `getMood` + `stableMood`
Table tests: one per rule, plus priority conflicts (rain at night → rain;
thunder and frost together → storm). For hysteresis, A→B once stays A;
A→B→B switches; A→B→A stays A.
**Verify**: `npm test`.

### Step 2: Palettes + contrast test
`moodPalettes.ts` holds six palettes (plus dark variants where they apply).
The test computes the WCAG relative-luminance contrast for each palette:
`ink` on `surface` ≥ 4.5, `ink-muted` on `surface` ≥ 4.5, `accent-coat` on
`surface` ≥ 3 (large text). It also asserts `accent-coat` is identical across
all palettes.
**Verify**: `npm test`.

### Step 3: Wire `useMood`, CSS, basemap swap + tint
**Verify**: `/dev/kiosk?mood=<each>` → screenshots of all six; the radar
colours are identical across moods (sample a pixel).

### Step 4: Remove the old theme path
**Verify**: `grep -rn "useAutoTheme\|setTheme" src/app` → no matches.

### Step 5: Gate
`npx tsc --noEmit && npx eslint src && npm test && npm run build`.

## Done criteria

- [ ] Gate passes; contrast test covers every palette
- [ ] Six mood screenshots in the report, compared with board F
- [ ] A mood change crossfades over ~60 s (observed by stubbing the forecast)
- [ ] Only in-scope files in the diff

## STOP conditions

- A board-F palette fails AA → report the pair and ratio; don't silently
  adjust the colours (the user approved those looks).
- Swapping the basemap style drops the radar layers (style reload) and needs
  more than re-adding them through 015's `ensureFrameLayer` → report.

## Maintenance notes

- A seventh mood (e.g. heat) = one rule, one palette, one contrast case.
- The thresholds (40 mph, 2 °C) should move into `config.ts` next to 014's.
