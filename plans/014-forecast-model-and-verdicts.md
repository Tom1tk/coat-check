# Plan 014: One typed forecast, commute windows and graded coat verdicts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. The reviewer maintains `plans/README.md` — do
> not edit it.
>
> **Drift check (run first)**: `git log --oneline -1` → on branch
> `advisor/014-forecast-model`, cut from `staging` at or after `d7af640`
> (after plan 013 merged, if it has). `grep -n "type OpenMeteoResponse = any"
> src/app/hooks/useWeather.ts` → must match. `grep -n "export function
> getCoatAdvice" src/app/utils/coatAdvice.ts` → must match. On mismatch, STOP.

## Status

- **Priority**: P1 (UK showers, codes 80–82, are not treated as rain today)
- **Effort**: M
- **Risk**: LOW–MED (pure functions with tests; the hook's return shape changes)
- **Depends on**: soft 013 (both edit `useWeather.ts`; if 013 has landed, keep its fetcher/cache seam)
- **Category**: correctness / data
- **Planned at**: commit `d7af640`, 2026-10-17
- **Source**: `plans/2026-10-audit.md` §4 (D1–D4), R4

## Why this matters

- `codeToCondition` only knows 0, 1–3, 45/48 and 51–65. Showers (80–82),
  snow, freezing rain and thunder become `"Other"` (D1).
- The verdict samples just two hours (08:00, 17:00) and uses three strings.
  The approved layout (plan 016) needs **Out / Back windows** and four
  graded verdicts (D2).
- `rain > 0` treats 0.1 mm as "coat"; `temp < 10` ignores wind chill (D3).
- The response is typed `any` and uses the legacy `weathercode` alias; the
  new UI needs `minutely_15`, wind, probability and an 8-day `daily` block (D4).

## Design (decided — do not re-derive)

### Config — `src/app/config.ts`
```ts
export const COMMUTE = {
  out:  { start: '07:30', end: '09:00' },
  back: { start: '17:00', end: '18:30' },
};
export const WEEKEND_LOOKAHEAD_HOURS = 12;
export const WET = { mm: 0.2, probability: 50 };
export const COLD_FEELS_LIKE_C = 10;
export const LAYER_FEELS_LIKE_C = 15;
export const UMBRELLA_MAX_GUST_MPH = 25;
```

### Request (D4, verbatim)
```
current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m
&minutely_15=precipitation&forecast_minutely_15=12
&hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m
&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max
&forecast_days=8&timezone=auto&wind_speed_unit=mph
```

### Types and guard — `src/app/utils/forecast.ts`
```ts
export interface Forecast { utcOffsetSeconds: number; current: {...};
  minutely15: { time: string[]; precipitation: number[] };
  hourly: { time: string[]; temperature: number[]; feelsLike: number[];
            precipitation: number[]; probability: number[]; code: number[];
            wind: number[]; gusts: number[] };
  daily: { date: string[]; code: number[]; max: number[]; min: number[];
           precipitationSum: number[]; probabilityMax: number[];
           windMax: number[]; gustMax: number[];
           sunrise: string[]; sunset: string[]; uvMax: number[] } }

export function parseForecast(json: unknown): Forecast   // throws a descriptive Error
```
A hand-written guard in the `latestRadarFrame` style (no new dependency):
check each array exists, is numeric, and is the same length as its `time`.
`null` entries in probability/gusts (models omit them) become `0`.

### WMO table — `src/app/utils/weatherCodes.ts`
```ts
export interface Condition { label: string; icon: IconKey; wet: boolean; group: ConditionGroup }
export type ConditionGroup = 'clear' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'showers' | 'snow' | 'freezing' | 'thunder';
export function describeCode(code: number): Condition  // unknown codes → { label: 'Unknown', wet: false, group: 'cloud' }
```
Cover every WMO code Open-Meteo emits: 0, 1, 2, 3, 45, 48, 51, 53, 55, 56,
57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99.
`IconKey` names map to lucide icons in the UI (plan 016), not here.

### Windows and verdicts — `src/app/utils/coatAdvice.ts` (rewrite)
```ts
export interface WindowSummary { label: 'Out' | 'Back' | 'Next 12 h';
  start: string; end: string;           // "HH:MM" location-local
  minFeelsLike: number; maxTemp: number; maxProbability: number;
  totalPrecipitation: number; maxGust: number; wet: boolean; dominantCode: number }

export type Verdict = 'coat-on' | 'coat-in-bag' | 'light-layer' | 'no-coat';

export function summariseWindow(f: Forecast, dateISO: string, start: string, end: string, label): WindowSummary | null
export function commuteWindows(f: Forecast, now: Date): WindowSummary[]
// weekday → [Out, Back] for today; once Back has ended → tomorrow's.
// Sat/Sun → [Next 12 h] from the current hour.
export function verdictFor(now: WindowSummary | null, windows: WindowSummary[]): { verdict: Verdict; reason: string; umbrella: boolean }
```
Rules, in order:
1. **coat-on** — the current hour (or the first window if it has started) is
   wet, or its min feels-like < `COLD_FEELS_LIKE_C`.
2. **coat-in-bag** — dry now, but any later window today is wet or cold.
3. **light-layer** — no window wet; min feels-like < `LAYER_FEELS_LIKE_C`.
4. **no-coat** — otherwise.
`wet` = `totalPrecipitation ≥ WET.mm || maxProbability ≥ WET.probability || describeCode(dominantCode).wet`.
`umbrella` = wet and `maxGust < UMBRELLA_MAX_GUST_MPH`.
`reason` is one short line, e.g. `"Back 17:30 · 70% showers · feels 6°"`.

Keep `getCoatAdvice` working as a thin adapter until plan 016 removes the
old cards (map `coat-on`/`coat-in-bag` → NEEDED, `light-layer` → RECOMMENDED,
`no-coat` → NOT_NEEDED), so the current UI keeps rendering.

### Nowcast — `src/app/utils/nowcast.ts`
```ts
export function nextTwoHours(f: Forecast, now: Date): { time: string; mm: number }[]  // 8 × 15 min from the current slot
export function nowcastSummary(slots): string  // "Dry for 40 min, then light rain" | "Dry for the next 2 hours" | "Rain easing by 09:15"
```

### Sun — replace `suncalc`
`isDaytime(f, now)` from `daily.sunrise[0]` / `sunset[0]` (location-local
strings, compare with `locationNow`). `useSunCalc` and `useAutoTheme` read
from it; then `npm uninstall suncalc @types/suncalc`.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Lint      | `npx eslint src`   | exit 0, 0 warnings  |
| Tests     | `npm test`         | all pass            |
| Build     | `npm run build`    | exit 0              |
| Live shape | `curl -s "https://api.open-meteo.com/v1/forecast?latitude=52.2&longitude=0.12&<request above>" \| head -c 600` | JSON with `minutely_15`, `daily.sunrise` |

## Scope

**In scope**:
- create `src/app/config.ts`, `utils/forecast.ts`, `utils/weatherCodes.ts`,
  `utils/nowcast.ts` and a test file for each
- rewrite `utils/coatAdvice.ts` + `coatAdvice.test.ts`
- `utils/weatherUtils.ts` (delete `codeToCondition`; keep interfaces still in use)
- `hooks/useWeather.ts` (new request, `parseForecast`, expose `forecast`)
- `hooks/deriveWeather.test.ts` (move to the new types)
- `hooks/useSunCalc.ts`, `hooks/useAutoTheme.ts`, `page.tsx` (sun from the forecast; drop suncalc)
- `package.json` / lockfile (remove suncalc)
- fixture: `src/app/utils/__fixtures__/forecast-cambridge.json` — a real
  response saved from the curl above, trimmed is fine

**Out of scope**:
- Any new UI (plan 016). Existing cards keep rendering via the adapter.
- Weather moods (plan 017) — `getMood` consumes these types later.
- Configurable windows in a settings UI (plan 016 handles URL params).

## Git workflow

Branch `advisor/014-forecast-model` from `staging`. Commit per step. Do NOT
push or open a PR.

## Steps

### Step 1: Fixture and `parseForecast`
Save the live response as the fixture. Implement `parseForecast`.
Tests: fixture parses; missing `hourly.time` throws with the field name in
the message; length mismatch throws; `null` probability becomes 0.
**Verify**: `npm test`.

### Step 2: `weatherCodes.ts`
Tests: every listed code has a label; 80, 81, 82, 61, 95, 66 are `wet`;
0, 3, 45 are not; 999 → Unknown.
**Verify**: `npm test`.

### Step 3: `config.ts` + window summaries
Implement `summariseWindow` (inclusive start hour, exclusive end; half-hour
starts include the hour that contains them) and `commuteWindows`.
Tests against the fixture, plus hand-built Forecasts for: weekday morning,
weekday 19:00 (rolls to tomorrow), Saturday (Next 12 h), a window that crosses
the end of the hourly array → `null`, not a throw.
**Verify**: `npm test`.

### Step 4: `verdictFor`
Table-driven tests, one per rule, plus the boundary values (0.19 vs 0.2 mm,
49 vs 50%, feels-like 9.9 vs 10, gust 24 vs 25 for the umbrella flag). Add
the `getCoatAdvice` adapter and keep the existing adapter-level tests green.
**Verify**: `npm test`.

### Step 5: `nowcast.ts`
Tests for each summary phrase and for "now" falling between slots.
**Verify**: `npm test`.

### Step 6: Wire `useWeather`
New URL, `parseForecast`, expose `forecast: Forecast | null` alongside the
existing derived values (re-derived through the adapter). If plan 013 has
landed, the cached payload goes through `parseForecast` too; a cache that
fails to parse is dropped.
**Verify**: `npm run dev` → current UI still shows today/tomorrow/now, no
console errors. The Network tab shows one Open-Meteo request containing `minutely_15`.

### Step 7: Sun from the forecast; remove suncalc
**Verify**: `grep -rn "suncalc" src package.json` → no matches; the theme still
flips (set the system clock or stub `now` in a test of `isDaytime`).

### Step 8: Gate
`npx tsc --noEmit && npx eslint src && npm test && npm run build`.

## Done criteria

- [ ] Gate passes; ≥25 new test cases across the four new modules
- [ ] `grep -rn ": any\|no-explicit-any" src/app` → no matches outside vendored code
- [ ] `grep -rn "weathercode" src` → no matches
- [ ] suncalc removed from `package.json`
- [ ] Today's UI unchanged visually (adapter), confirmed in the dev server
- [ ] Only in-scope files in the diff

## STOP conditions

- The live response lacks `minutely_15` for the configured location (Open-Meteo
  coverage change) → report; don't invent a fallback.
- Removing suncalc changes the day/night flip time by more than 5 minutes
  versus the old implementation for Cambridge today → report.
- Plan 013's cache seam conflicts with the new types in a way that needs a
  design decision.

## Maintenance notes

- Plan 016 renders `commuteWindows`, `verdictFor`, `nextTwoHours` and
  `daily` directly; plan 017's `getMood` reads `describeCode().group`,
  feels-like and `isDaytime`.
- Thresholds live only in `config.ts`; tests import them rather than
  hard-coding numbers, so tuning doesn't break tests.
