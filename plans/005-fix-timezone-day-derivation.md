# Plan 005: Day and current-hour derivation use the location's clock, and lookup failures surface errors instead of wrong data

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e85bba..HEAD -- src/app/hooks/useWeather.ts`
> Plans 001, 003, and 004 legitimately modified this file (error state,
> `getCoatAdvice` calls, `export` keywords). The *date/index computation*
> excerpted below must still be recognizable; if the derivation math itself
> changed, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/004-test-baseline-and-ci.md (characterization tests must exist), plans/001-weather-fetch-error-handling.md (error state to reuse)
- **Category**: bug
- **Planned at**: commit `6e85bba`, 2026-07-05

## Why this matters

"Today" is computed from the **browser's** clock converted to **UTC**
(`new Date().toISOString()`), then matched against timestamps that Open-Meteo
returns in the **location's** local time. Two distinct wrongness modes:

1. Any user whose local date differs from the UTC date (e.g. Los Angeles
   every evening after 4/5pm) gets **tomorrow's forecast labeled "today"**.
2. Viewing a city in a different timezone (the app has worldwide city search)
   uses the browser's date, not the city's — wrong around either midnight.

Additionally, failed timestamp lookups are silently mishandled: `indexOf`
returning −1 makes `deriveDayWeather` render `undefined°C`, and
`deriveCurrentHourWeather` falls back to `Math.floor(times.length / 2)` —
data from ~3.5 days in the future shown as "right now".

## Current state

`src/app/hooks/useWeather.ts`. The current-hour function already computes the
location's local time correctly using `utc_offset_seconds` — reuse that
technique:

```ts
// useWeather.ts:9-24 (deriveCurrentHourWeather) — CORRECT approach, keep
const utcOffsetSeconds = data.utc_offset_seconds;
const nowUTC = new Date().getTime() + (new Date().getTimezoneOffset() * 60000);
const targetTimeAsUTC = new Date(nowUTC + (utcOffsetSeconds * 1000));
// ...builds "YYYY-MM-DDTHH:00" from getUTC* parts...
const currentIndex = times.indexOf(currentTimeStr);
const actualIndex = currentIndex !== -1 ? currentIndex : Math.floor(times.length / 2);  // ← BAD fallback
```

**Known bug in the "correct" approach worth preserving awareness of**: the
`nowUTC` line double-applies the browser offset (`Date.getTime()` is already
UTC; adding `getTimezoneOffset()` shifts it). It happens to be compensated
nowhere — see STOP conditions: verify with the tests whether current-hour
selection is right for non-UTC browsers before assuming. The clean rewrite in
Step 1 sidesteps the question entirely.

```ts
// useWeather.ts:47-62 (deriveDayWeather) — WRONG approach, replace
const dateObj = new Date();
dateObj.setDate(dateObj.getDate() + dayOffset);
const dateStr = dateObj.toISOString().split('T')[0];   // ← browser clock, UTC date

const times = data.hourly.time;
const morningIndex = times.indexOf(`${dateStr}T08:00`);
const afternoonIndex = times.indexOf(`${dateStr}T17:00`);
// ...direct array indexing with possibly -1...
```

By plan 001, the hook has an `error: string | null` state and its `refresh`
wraps derivation in `try/catch`. By plan 004, characterization tests in
`src/app/hooks/deriveWeather.test.ts` assert today's buggy behavior with
comments `// BUG documented, fixed by plan 005`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Tests     | `npm test`               | all pass            |
| Lint      | `npx eslint src`         | exit 0; at most pre-existing warnings |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/app/hooks/useWeather.ts` (derivation functions only)
- `src/app/hooks/deriveWeather.test.ts` (flip characterization assertions, add new cases)

**Out of scope**:
- The fetch/error-state plumbing from plan 001 (reuse, don't redesign).
- `page.tsx`, all components.
- Changing the 08:00/17:00 commute hours or advice rules.

## Git workflow

- Branch: `advisor/005-fix-timezone-day-derivation`
- Commit style: short imperative sentence matching repo history.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a single "location local time" helper

In `useWeather.ts`, add one exported helper both derive functions use:

```ts
// The API returns hourly.time in the location's local time; represent the
// location's "now" as a Date whose getUTC* fields read as location-local.
export function locationNow(utcOffsetSeconds: number): Date {
    return new Date(Date.now() + utcOffsetSeconds * 1000);
}
```

(`Date.now()` is epoch UTC; adding the location offset makes the `getUTC*`
accessors yield location-local wall-clock fields. No browser-timezone terms
belong in this expression — that's the old bug.)

### Step 2: Rewrite the date/index logic

1. `deriveCurrentHourWeather`: replace lines 11–13 (`nowUTC` /
   `targetTimeAsUTC` computation) with `const targetTimeAsUTC = locationNow(data.utc_offset_seconds);`
   Keep the existing `getUTC*` string building. Replace the midpoint fallback:
   ```ts
   const currentIndex = times.indexOf(currentTimeStr);
   if (currentIndex === -1) {
       throw new Error(`Current hour ${currentTimeStr} not found in forecast data`);
   }
   ```
2. `deriveDayWeather`: replace the `dateObj`/`toISOString` block with the same
   technique — start from `locationNow(data.utc_offset_seconds)`, add
   `dayOffset` days via `setUTCDate(getUTCDate() + dayOffset)`, and build
   `dateStr` from `getUTCFullYear`/`getUTCMonth`/`getUTCDate` with
   `padStart(2, '0')` (same formatting as `deriveCurrentHourWeather`).
3. In `deriveDayWeather`, after the two `indexOf` calls:
   ```ts
   if (morningIndex === -1 || afternoonIndex === -1) {
       throw new Error(`Forecast data missing for ${dateStr}`);
   }
   ```
4. These throws are caught by the `try/catch` plan 001 added in `refresh`,
   surfacing the user-facing error panel. Confirm that catch block wraps the
   derivation calls, not just the fetch — if it doesn't, extend it to.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Flip the characterization tests and extend

In `src/app/hooks/deriveWeather.test.ts`:

1. The UTC−7 case (browser at `2026-07-06T01:00:00Z`, location offset −25200):
   now must assert `deriveDayWeather(data, 0)` returns **2026-07-05** values
   (the location's date), not 07-06.
2. Missing current hour: now must assert `deriveCurrentHourWeather` **throws**.
3. Missing day timestamps: now must assert `deriveDayWeather` **throws**.
4. Add new cases:
   - Location UTC+13 (offset 46800, e.g. Auckland DST) with browser in UTC:
     "today" is the location's date, one ahead of UTC.
   - Browser in UTC+2 viewing a UTC−7 location: current hour matches the
     location's wall clock (this is the regression test for the
     browser-offset double-count noted in Current state).
   - `dayOffset = 1` crossing a month boundary (e.g. location-local
     2026-07-31 → tomorrow is 2026-08-01) — `setUTCDate` handles rollover;
     assert the string is `2026-08-01`.

**Verify**: `npm test` → all pass; no test still carries a
`// BUG documented, fixed by plan 005` comment (delete the markers as you
flip each one: `grep -rn "fixed by plan 005" src/` → no matches).

### Step 4: Manual smoke test

`npm run dev` → open the app, search for "Auckland" and then "Los Angeles";
each shows plausible temperatures for morning/afternoon (no `undefined`, no
error panel), and "Current Hour (HH:00)" matches the *city's* local hour
(check against a world clock).

**Verify**: the observations above.

## Test plan

Covered by Steps 3–4: three flipped characterization tests plus three new
timezone/rollover cases, all in `src/app/hooks/deriveWeather.test.ts`,
modeled on the fixture builder plan 004 created.

## Done criteria

- [ ] `npm test` exits 0; the UTC−7 "wrong day" characterization is inverted to assert the correct day
- [ ] `grep -rn "fixed by plan 005" src/` returns no matches
- [ ] `grep -n "toISOString" src/app/hooks/useWeather.ts` returns no matches
- [ ] `grep -n "times.length / 2" src/app/hooks/useWeather.ts` returns no matches
- [ ] `npx tsc --noEmit` and `npm run build` exit 0
- [ ] Manual smoke test (Step 4) observed
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plans 001 or 004 have not landed (no `error` state in the hook, or no
  `deriveWeather.test.ts`).
- The derivation code no longer resembles the excerpts (someone else rewrote it).
- Your Step-3 test for the browser-offset double-count shows the OLD
  current-hour code was actually *correct* for non-UTC browsers — that means
  the analysis in "Current state" is wrong somewhere; report the failing
  matrix of (browser offset × location offset) rather than fudging the helper.
- Open-Meteo responses turn out not to include `utc_offset_seconds` (the
  fixture and real API disagree).

## Maintenance notes

- `locationNow` is the single point where "whose clock?" is decided. Any
  future feature dealing with time (hourly strip, sunrise/sunset — note
  `useSunCalc` uses the *browser's* clock, acceptable for theme choice)
  should reuse or consciously diverge from it, in writing.
- Reviewer: scrutinize the fixture timestamps — they must be location-local
  strings exactly as Open-Meteo returns them (`YYYY-MM-DDTHH:00`, no `Z`, no
  offset suffix).
- Deferred: `refresh` re-deriving on an interval so "current hour" rolls over
  without a data refetch — today it only recomputes on refresh, which the
  hourly auto-refresh already triggers.
