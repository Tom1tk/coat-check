# Plan 013: The kiosk keeps itself fresh — a data-age scheduler replaces the hourly refresh

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. The reviewer maintains `plans/README.md` — do
> not edit it.
>
> **Drift check (run first)**: `git log --oneline -1` → on branch
> `advisor/013-kiosk-scheduler`, cut from `staging` at or after `d7af640`.
> `grep -n "minutesUntilNextRefresh" src/app/hooks/useAutoRefresh.ts` → must
> match. `grep -n "allReady = allWeatherLoaded && mapLoaded" src/app/page.tsx`
> → must match. On mismatch, STOP.

## Status

- **Priority**: P1 (root cause of every "needed a manual refresh" report)
- **Effort**: M
- **Risk**: MED (replaces the refresh system; touches boot gating and the map lifecycle)
- **Depends on**: — (first in the 2026-10 series)
- **Category**: reliability
- **Planned at**: commit `d7af640`, 2026-10-17
- **Source**: `plans/2026-10-audit.md` §2 (K1–K7), T2

## Why this matters

The app now runs on a porch kiosk that nobody touches. Today:
- boot waits for the map, so a failed CARTO style load leaves it on the
  loading screen forever (K1);
- a failed weather fetch blocks the screen with a modal and a Retry button,
  and nothing retries (K2);
- data refreshes on hour boundaries, so radar is ~30 min old on average (K3);
- each refresh fades the whole screen out and in (K4);
- nothing shows how old the data is, and a cold boot shows nothing until
  the network is up (K5);
- WebGL context loss blanks the map permanently (K6);
- a Vercel deploy can 404 the lazy `suncalc` chunk in a long-lived tab (K7).

Done means: **the kiosk survives an hour with the network cable pulled and
recovers by itself, with no reload and no input.**

## Design (decided — do not re-derive)

One scheduler, driven by **data age**, not the clock.

```ts
// src/app/utils/freshness.ts  (pure, tested)
export type SourceId = 'forecast' | 'radar';
export const MAX_AGE_MS: Record<SourceId, number> = {
  forecast: 15 * 60_000, // Open-Meteo current/minutely_15 update cadence
  radar: 5 * 60_000,     // RainViewer publishes every 10 min
};
export const BACKOFF_MS = [30_000, 60_000, 120_000, 240_000, 600_000]; // cap 10 min

export function isDue(now: number, lastSuccess: number | null,
                      lastAttempt: number | null, failures: number,
                      maxAge: number): boolean
// due when never succeeded, or now - lastSuccess > maxAge — but never while
// a backoff is pending: now - lastAttempt < BACKOFF_MS[min(failures-1, last)]

export type Freshness = 'fresh' | 'stale' | 'offline';
export function freshness(now: number, lastSuccess: number | null,
                          maxAge: number, online: boolean): Freshness
// offline if !online or lastSuccess null; stale if age > 2×maxAge (amber)
// AND red/offline wording if age > 6×maxAge; else fresh.
```

(The forecast is one Open-Meteo request covering current, minutely, hourly and
daily, so a single 15-minute `forecast` source is enough. Plan 014 changes what
the request asks for, not how often.)

```ts
// src/app/hooks/useScheduler.ts
// One 30 s setInterval + visibilitychange + 'online' event → tick().
// tick(): for each source, if isDue(...) call its fetcher; record
// lastSuccess / lastAttempt / failures in a ref; expose a state snapshot
// { [source]: { lastSuccess, failures } } for the status chip.
export function useScheduler(fetchers: Record<SourceId, () => Promise<void>>): SchedulerState
```

Fetchers throw on failure; the scheduler owns retry. No localStorage hour
bookkeeping, no heartbeat, no countdown.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Lint      | `npx eslint src`   | exit 0, 0 warnings  |
| Tests     | `npm test`         | all pass (38 existing − removed + new) |
| Build     | `npm run build`    | exit 0              |
| Dev       | `npm run dev`      | http://localhost:3000 |

## Scope

**In scope**:
- `src/app/utils/freshness.ts` + `freshness.test.ts` (create)
- `src/app/hooks/useScheduler.ts` (create)
- `src/app/hooks/useWeather.ts` (fetch becomes a throwing fetcher; cache last good payload)
- `src/app/hooks/useAutoRefresh.ts` + `useAutoRefresh.test.ts` (delete)
- `src/app/components/RainViewerBackground.tsx` (frame refetch driven by scheduler; context-loss + boot-timeout remount)
- `src/app/components/StatusChip.tsx` (create — the board-E chip)
- `src/app/page.tsx` (boot gating, remove modal/countdown/refresh button/fade-on-refresh, static suncalc)
- `.github/workflows/ci.yml` (T2: also run on pushes to `staging`)

**Out of scope**:
- The new layout (plan 016) — keep today's components; just place the
  `StatusChip` where the countdown was.
- Changing the Open-Meteo request fields (plan 014).
- `/api/version` + 03:00 reload (K7b) — opt-in, not planned.
- `src/components/ui/map.tsx` (vendored — never edit).

## Git workflow

Branch `advisor/013-kiosk-scheduler` from `staging`. Commit per step, short
imperative messages matching history. Do NOT push or open a PR.

## Steps

### Step 1: `freshness.ts` + tests
Implement the two pure functions above. Tests (Vitest, node env, match
`coatAdvice.test.ts` style):
1. never succeeded → due; succeeded 1 min ago with 5 min maxAge → not due.
2. stale but last attempt 10 s ago after 1 failure → not due (30 s backoff); 31 s → due.
3. failures beyond the table length use the 10 min cap.
4. `freshness`: fresh at 1×, stale at 2.1×, offline when `online=false`, offline when never loaded.

**Verify**: `npm test` → new cases pass.

### Step 2: `useScheduler`
As designed. Requirements:
- tick immediately on mount, then every 30 s; also on `visibilitychange`
  (visible) and `window` `online`.
- never run two fetches of the same source concurrently (in-flight flag).
- clear the interval and listeners on unmount.
- `console.warn('[Scheduler] <source> failed (n): <err>')` on failure — never
  swallow silently.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: `useWeather` becomes a fetcher with a cache
1. Split into `fetchForecast(location, signal): Promise<OpenMeteoResponse>`
   (throws on non-2xx) and state derivation.
2. On success write the raw payload to `localStorage['forecastCache']` as
   `{ savedAt, location: {latitude, longitude}, data }`. Wrap read/write in
   try/catch (quota, private mode).
3. On mount, if the cache matches the current location, derive state from it
   immediately and expose `lastSuccess = savedAt`. Derivation that throws on
   a stale cache (current hour missing) → ignore the cache, don't crash.
4. Expose `{ ..., fetcher, lastSuccess }`; drop the `error` string — the
   scheduler's failure count replaces it.

**Verify**: unit-test the cache-validation guard (location mismatch → null;
malformed JSON → null).

### Step 4: Map recovers by itself (K1, K6)
In `RainViewerBackground.tsx`:
1. The frame-index effect is re-run by the scheduler (pass a `radarTick`
   number instead of `refreshKey`; same remove/re-add path).
2. Wrap `<Map>` in a component holding `const [mapKey, setMapKey] = useState(0)`.
   Remount (`setMapKey(k => k + 1)`) when: (a) `webglcontextlost` fires on
   `map.getCanvas()`, after a 5 s delay; (b) `isLoaded` is still false 20 s
   after mount — retry with the same backoff table.
3. Log each remount with its reason.

**Verify**: `npx tsc --noEmit`, `npx eslint src` clean.

### Step 5: `page.tsx` — never block, never blink (K2, K4, K7a)
1. `allReady` = weather state exists (live or cached). The map no longer gates
   the UI; it fades in on its own when loaded.
2. Delete the error modal, the countdown, the Refresh button and
   `handleRefresh`'s fade. Data swaps in place.
3. Replace `import('suncalc')` in `handleLocationUpdate` with the static
   import (`import SunCalc from 'suncalc'`).
4. Wire `useScheduler({ forecast: weather.fetcher, radar: bumpRadarTick })`.
5. Add `<StatusChip>` bottom-right showing the five board-E states: fresh
   "Updated HH:MM", stale amber "Updated N min ago", offline red
   "Offline · showing HH:MM", radar-down grey "Radar unavailable",
   boot "Starting · cached HH:MM". Colours as inline `style`, not built
   Tailwind class names (CLAUDE.md rule).

**Verify**: full gate (below).

### Step 6: Delete `useAutoRefresh` and CI on staging
1. `git rm src/app/hooks/useAutoRefresh.ts src/app/hooks/useAutoRefresh.test.ts`;
   remove the `lastRefreshedHour`/`lastRefreshedDate` localStorage keys
   (one-time `removeItem` on mount is fine) and update CLAUDE.md's
   "State persisted" line.
2. `ci.yml`: `push: branches: [main, staging]`.

**Verify**: `grep -rn "useAutoRefresh\|lastRefreshedHour" src` → no matches.

### Step 7: Gate + kiosk drills
1. `npx tsc --noEmit && npx eslint src && npm test && npm run build`.
2. `npm run dev`, then in DevTools:
   - **Offline drill**: Network → Offline for 5 min. UI stays, chip goes
     amber then red. Back online → chip fresh within 30 s, no reload.
   - **Boot offline**: offline, reload → cached forecast shows within 1 s
     with "Starting · cached …".
   - **Map boot failure**: block `basemaps.cartocdn.com`, reload → weather
     shows; console shows remount attempts; unblock → map appears by itself.
   - **Context loss**: in the console,
     `document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()`
     → map remounts within ~5 s.
   - Radar: Network tab shows the frame index refetched at most every 5 min.

## Done criteria

- [ ] Gate passes; ≥6 new freshness/cache tests
- [ ] `grep -rn "Retry\|Auto Refresh in" src/app` → no matches
- [ ] `grep -n "import('suncalc')" src/app/page.tsx` → no match
- [ ] All Step 7 drills observed and reported
- [ ] Only in-scope files in the diff

## STOP conditions

- MapLibre's context-loss event isn't reachable without editing `map.tsx` → report.
- Remounting `<Map>` loses the rain layer in a way that needs page-level state → report the seam.
- Any gate failure not caused by your diff.

## Maintenance notes

- New data sources (e.g. warnings, plan list item 6) add one `MAX_AGE_MS`
  entry and one fetcher — nothing else.
- Plan 015 (radar loop) reuses `radarTick`.
