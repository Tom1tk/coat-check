# Plan 001: Weather fetch failures surface an error state with retry instead of hanging on the loading screen

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e85bba..HEAD -- src/app/hooks/useWeather.ts src/app/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e85bba`, 2026-07-05

## Why this matters

This is a weather app people check on flaky mobile connections. The single data
fetch in `useWeather` has no `try/catch`, no `res.ok` check, and no error
state. If Open-Meteo is unreachable or returns an error, the fetch rejects
unhandled, all three weather states stay `null`, and the app displays
"Loading weather data..." forever with no retry path. After this plan, any
fetch failure shows a clear error message with a working Retry button.

## Current state

- `src/app/hooks/useWeather.ts` — the only data-fetching hook. The `refresh`
  callback (lines 90–106) is the problem:

```ts
// src/app/hooks/useWeather.ts:90-110
const refresh = useCallback(async () => {
    const { latitude, longitude } = location;
    // Single API call with timezone=auto for accurate local time calculation
    const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,weathercode&timezone=auto`
    );
    const data = await res.json();

    // Derive all weather states from the single response
    const current = deriveCurrentHourWeather(data);
    const today = deriveDayWeather(data, 0);
    const tomorrow = deriveDayWeather(data, 1);

    setCurrentHourWeather(current);
    setTodayWeather(today);
    setTomorrowWeather(tomorrow);
}, [location.latitude, location.longitude]);

useEffect(() => {
    refresh();
}, [refresh]);
```

  Note: the dependency array `[location.latitude, location.longitude]`
  currently produces an eslint warning (`react-hooks/exhaustive-deps` wants
  `location`). This plan fixes that too (Step 1).

- `src/app/page.tsx` — main component. `allWeatherLoaded` (line 263) gates the
  whole UI; while any state is `null`, only `LoadingScreen` shows (line 346).
  The loading screen is a full-screen overlay:

```tsx
// src/app/page.tsx:263-264
const allWeatherLoaded = currentHourWeather !== null && todayWeather !== null && tomorrowWeather !== null;
const allReady = allWeatherLoaded && mapLoaded;
```

- Repo conventions: hooks return plain objects of state + callbacks (see
  `useLocation.ts`); UI panels use the `glass-panel` CSS class and the
  `SpotlightCard` component (see the Refresh button, `src/app/page.tsx:395-401`).
  Errors elsewhere are handled with user-visible messages — see
  `src/app/components/LocationSearch.tsx:136-141` (`setErrorMessage('Error fetching location data.')`).
  Match that style.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0, no output   |
| Lint      | `npx eslint src`         | exit 0; at most 1 pre-existing warning (`jsx-a11y/role-has-required-aria-props` in LocationSearch.tsx) |
| Dev server| `npm run dev`            | serves on http://localhost:3000 |

## Scope

**In scope** (the only files you should modify):
- `src/app/hooks/useWeather.ts`
- `src/app/page.tsx`

**Out of scope** (do NOT touch, even though they look related):
- `src/app/components/LoadingScreen.tsx` — keep it as-is; the error UI is a
  separate element, not a LoadingScreen mode.
- The derivation functions `deriveCurrentHourWeather` / `deriveDayWeather` —
  their internal logic has known timezone bugs handled by `plans/005-*.md`.
  Do not change their bodies here.
- The refresh/heartbeat system in `page.tsx` (lines 95–261) — leave untouched.

## Git workflow

- Branch: `advisor/001-weather-fetch-error-handling`
- Commit style: short imperative sentence, matching repo history (e.g.
  "Fixed an issue with stale data not refreshing when tab is snoozed").
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add error state to `useWeather`

In `src/app/hooks/useWeather.ts`, change the `refresh` callback to:

1. Wrap the fetch + derivation in `try/catch`.
2. Check `res.ok`; if false, throw `new Error(\`Weather API returned ${res.status}\`)`.
3. On success: set the three weather states as today, and clear the error state.
4. On failure: `console.error('[Weather] fetch failed:', err)` and set a new
   `error` state (type `string | null`) to a user-friendly message, e.g.
   `'Could not load weather data. Check your connection and try again.'`.
5. Change the dependency array to `[location]` (fixes the eslint warning;
   `location` is replaced immutably in `useLocation`, so identity is a valid dep).
6. Return `error` from the hook alongside the existing fields:
   `return { todayWeather, tomorrowWeather, currentHourWeather, refresh, error };`
7. When a refresh starts, do NOT null out the existing weather states — stale
   data beats no data; the error state is enough signal.

**Verify**: `npx tsc --noEmit` → exit 0. `npx eslint src` → the
`react-hooks/exhaustive-deps` warning for useWeather.ts is gone.

### Step 2: Render the error state in `page.tsx`

1. Destructure `error` from the `useWeather(location)` call (line 26).
2. Below the `LoadingScreen` line (`{!pageVisible && <LoadingScreen ... />}`,
   line 346), add an error panel rendered when `error !== null`:
   a fixed, centered, high-z element using the repo's card style:

```tsx
{error && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center">
    <SpotlightCard className="glass-panel rounded-2xl p-6 max-w-md text-center text-black dark:text-white">
      <p className="font-semibold">{error}</p>
      <button
        onClick={() => refreshWeather()}
        className="mt-4 bg-blue-500 hover:bg-blue-600 text-black font-semibold py-1 px-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Retry
      </button>
    </SpotlightCard>
  </div>
)}
```

   (The button styling copies the Submit button in `LocationSearch.tsx:143`.)
3. The panel must render regardless of `allReady` (it must be reachable while
   the loading screen is up — that's the main failure mode).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Manually exercise the failure path

1. `npm run dev`, open http://localhost:3000 — app loads normally.
2. In browser DevTools → Network, set request blocking for
   `api.open-meteo.com` (or switch DevTools to "Offline"), then click the
   🔄 Refresh button.
3. Expected: the error panel appears with the message and Retry button; no
   unhandled promise rejection in the console.
4. Remove the block, click Retry → error panel disappears, weather updates.

**Verify**: the four observations above, in order.

## Test plan

No test infrastructure exists yet (`plans/004-*.md` adds it). When 004 lands,
it includes error-path tests for this hook. Manual verification (Step 3) is
the gate for this plan.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx eslint src` reports no `react-hooks/exhaustive-deps` warning for `useWeather.ts`
- [ ] `grep -n "res.ok" src/app/hooks/useWeather.ts` returns a match
- [ ] `grep -n "error" src/app/hooks/useWeather.ts` shows an error state returned from the hook
- [ ] Manual failure-path walkthrough (Step 3) observed as described
- [ ] `git status` shows only the two in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `refresh` callback in `useWeather.ts` no longer matches the excerpt
  (drift — someone else touched it).
- Changing the dep array to `[location]` causes an infinite refetch loop in
  dev (would mean `useLocation` started returning unstable identities —
  investigate, don't work around).
- The error panel requires touching `LoadingScreen.tsx` to display correctly.

## Maintenance notes

- Plan 005 (timezone fix) adds a second failure mode inside the derivation
  functions; it should reuse this `error` state rather than adding another.
- Plan 008 (page.tsx refactor) will move the refresh orchestration into a
  hook; the error panel should stay in `page.tsx`.
- Reviewer: check that stale weather remains visible during a failed
  background refresh (we deliberately do not clear state on error).
