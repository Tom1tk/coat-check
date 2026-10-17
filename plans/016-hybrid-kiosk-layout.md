# Plan 016: The hybrid kiosk layout — A's panel, B's ribbon, map in the rest

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. The reviewer maintains `plans/README.md` — do
> not edit it.
>
> **Drift check (run first)**: `git log --oneline -1` → on branch
> `advisor/016-hybrid-layout`, cut from `staging` **after 013 and 014 merged**
> (015 optional). `grep -n "export function verdictFor" src/app/utils/coatAdvice.ts`
> and `grep -n "export function useScheduler" src/app/hooks/useScheduler.ts`
> → both must match. On mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (replaces the page's visual layer; the logic is already tested)
- **Depends on**: 013, 014 (hard); 015 (soft — the radar timestamp chip)
- **Category**: UI / UX
- **Planned at**: commit `d7af640`, 2026-10-17
- **Source**: `plans/2026-10-audit.md` §5 (U1–U5), §6 features 1–5; approved mockup boards **G1/G2** (artifact `CQqsTCEUDrYBteEo6oAdt8`, v7)

## Why this matters

The current UI is a desktop web page: small text, input controls nobody uses,
and two hours of data on screen. The approved hybrid answers "coat, and when?"
from 2–3 m away, shows the week for trips, and needs no input.

## Approved spec (from boards G1/G2 — build exactly this)

Reference frame 1920×1080; every size scales with `vw`/`clamp()` so it works
on other kiosk resolutions. Pixel values below are at 1920 wide.

- **Map**: full-bleed behind everything. `map.setPadding({ left: 608, bottom: 312, top: 0, right: 0 })`
  so the location centres in the area right of the panel and above the ribbon
  (≈ 1264, 380). Recompute it on `resize` from the measured panel/ribbon rects
  (a `ResizeObserver`), not constants.
- **Left panel** — `left/top/bottom: 32`, width 576, glass surface, top to bottom:
  1. Clock (large, tabular numerals, 1-minute tick), date, chip
     "Updated HH:MM · <Mood>" (this becomes 013's `StatusChip`).
  2. "LEAVING NOW" label → **serif verdict** (≈ 6–8 vw; `Coat on` /
     `Coat in bag` / `Light layer` / `No coat`) → reason line. Orange accent
     whenever the verdict involves a coat.
  3. Out / Back cards side by side: time window, temp, feels-like,
     `% · mm · wind/gust`, tag (verdict per window). Weekend: one "Next 12 h" card.
  4. Four live stats: temp/feels · mm/h now · wind/gusts · next change time.
  5. Today's chance-of-rain strip, 07:00–20:00, bars from hourly
     probability, commute windows shaded.
- **Bottom ribbon** — `left: 632, right: 32, bottom: 32, height: 280`; 7 columns
  (today + 6): day, icon, high/low, `% · mm`, `wind · gust`, coat label.
  **Sat and Sun share one tinted block** (no gap between them).
- **Top-right**: "Next 2 hours" card (8 × 15-minute bars from `nextTwoHours`,
  plus the `nowcastSummary` sentence) and, beneath it, the radar legend chip
  and timestamp (from 015, if merged).
- **Gone**: Header search box, ZoomControl, ThemeToggle, the Refresh card,
  SpotlightCard/SpotlightText, the today/tomorrow toggle.

## Design notes (decided)

- **Settings off-screen (U1)**: `?settings` (or a 3 s long-press on the
  location name) opens a sheet holding the existing `LocationSearch` and zoom.
  URL params pin config and **win over localStorage**: `lat`, `lon`, `name`,
  `zoom`, `radar=still`. Parse with a guard (finite numbers, lat ±90,
  lon ±180) in `utils/kioskParams.ts`; invalid params are ignored with a
  `console.warn`.
- **Burn-in (U5)**: a root wrapper translates by a 0–2 px offset that
  changes every 4 min (deterministic from the clock, so there's no state).
- **Fades (Q2)**: delete the `fade`/`pageVisible`/`FADE_DURATION` prop drilling.
  One `<Reveal>` on the root for boot only; data swaps without fades.
- **Colours**: use only CSS custom properties (`--surface`, `--ink`,
  `--ink-muted`, `--accent-coat`, `--weekend-tint`, …), defined once in
  `globals.css` with today's light/dark values. Plan 017 adds the mood
  palettes to the same tokens. **No Tailwind class built from a variable.**
- **Icons**: map `weatherCodes` `IconKey` → lucide components in one
  `components/WeatherIcon.tsx`.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Lint      | `npx eslint src`   | exit 0, 0 warnings  |
| Tests     | `npm test`         | all pass            |
| Build     | `npm run build`    | exit 0              |
| Dev       | `npm run dev`      | http://localhost:3000 |

## Scope

**In scope** (create unless stated):
- `components/kiosk/Panel.tsx`, `Clock.tsx`, `Verdict.tsx`, `WindowCard.tsx`,
  `LiveStats.tsx`, `RainStrip.tsx`, `WeekRibbon.tsx`, `NowcastCard.tsx`,
  `SettingsSheet.tsx`, `Reveal.tsx`, `components/WeatherIcon.tsx`
- `utils/kioskParams.ts` + test; `utils/weekRibbon.ts` (pure: daily → 7 columns
  with a weekend-group flag) + test
- `page.tsx` (rewrite as composition), `globals.css` (tokens)
- `RainViewerBackground.tsx` (accepts `padding`; calls `setPadding`)
- delete: `WeatherCard`, `CurrentWeatherCard`, `ZoomControl`, `ThemeToggle`,
  `SpotlightCard`, `SpotlightText`, `Header` (its search moves to the sheet)
- `CLAUDE.md` architecture section (components list, URL params)

**Out of scope**:
- Mood palettes (017), radar animation (015), warnings/pollen (later).
- `src/components/ui/map.tsx` — `setPadding` goes through the map instance
  from `useMap`, not by editing the wrapper.

## Git workflow

Branch `advisor/016-hybrid-layout` from `staging`. Commit per step. Do NOT
push or open a PR.

## Steps

### Step 1: Tokens + `kioskParams` + `weekRibbon`
Tests: params guard (valid, out of range, NaN, missing); ribbon groups Sat+Sun
when both are in the 7 days, handles a week that starts on Sunday (only Sun
tinted), and adds coat labels from `verdictFor` over each day's daylight.
**Verify**: `npm test`.

### Step 2: Panel components with the fixture
Build the panel components against the 014 fixture. Add a dev-only route
`/dev/kiosk` that renders the layout with fixture data and a fixed `now`, so
it can be reviewed without the network. Remove it in step 6, or gate it on
`NODE_ENV !== 'production'`.
**Verify**: screenshot `/dev/kiosk` at 1920×1080 next to board G1; list any
visible differences in the report.

### Step 3: Ribbon + nowcast card
**Verify**: at 1920×1080 and 1280×800, no text overflows and the weekend block
is one piece.

### Step 4: Map padding
**Verify**: the location marker centre is within ±8 px of the centre of the
free area (measure with `map.project(center)` in the console) at both sizes,
and after resizing the window.

### Step 5: Settings sheet + URL params + burn-in shift
**Verify**: `/?lat=51.5&lon=-0.12&name=London` shows London after clearing
localStorage; `?settings` opens the sheet; with no params and no input, nothing
interactive is visible.

### Step 6: Delete the old components; rewrite `page.tsx`
**Verify**: `grep -rn "SpotlightCard\|ZoomControl\|ThemeToggle\|FADE_DURATION" src/app` → no matches; `page.tsx` < 150 lines.

### Step 7: Gate + kiosk soak
Gate, then leave the dev server running for 30 min: the clock advances, the
chip stays fresh, and the console has no errors or warnings except scheduler
retries.

## Done criteria

- [ ] Gate passes; new tests for params and ribbon
- [ ] Screenshots at 1920×1080 (weekday + Saturday) attached to the report
- [ ] Map centring within ±8 px
- [ ] No pointer-only UI remains on the default view
- [ ] Only in-scope files in the diff

## STOP conditions

- `setPadding` isn't reachable through `useMap` without editing `map.tsx`.
- The verdict at the specified size doesn't fit the 576 px panel for
  "Coat in bag" → report with a screenshot; don't shrink it below 5 vw.
- 014's types are missing a field the spec needs → report; don't refetch
  separately.

## Maintenance notes

- Every colour is a token, so plan 017 is CSS + one pure function.
- New panel rows (warnings, pollen) go between Live stats and the Rain strip;
  the panel already scrolls nothing, so drop the rain strip on short screens first.
