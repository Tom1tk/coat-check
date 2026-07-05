# Plan 008: page.tsx delegates auto-refresh and auto-theme to dedicated hooks (414 → ~200 lines), behavior preserved

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e85bba..HEAD -- src/app/page.tsx src/app/hooks`
> Plans 001 (error panel) and 002 (inline transition styles) legitimately
> modified `page.tsx`. The refresh/heartbeat logic excerpted below must still
> be recognizable; if that logic itself was already extracted or rewritten, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/004-test-baseline-and-ci.md (test runner needed for the extracted pure helper), plans/001 and 002 (both edit page.tsx — land first to avoid conflicts)
- **Category**: tech-debt
- **Planned at**: commit `6e85bba`, 2026-07-05

## Why this matters

`src/app/page.tsx` is 414 lines mixing four concerns: auto-refresh
orchestration (heartbeat, hour-crossing detection, wake events, countdown),
theme automation (sunrise/sunset switching), fade choreography, and layout.
The refresh system alone is ~155 lines (95–261) of interlocking callbacks and
refs — the most-churned code in the repo (4 of the last 10 commits touched
it) and impossible to test in place. `handleRefresh` also duplicates the
persistence logic that `saveRefreshState` already owns, and the countdown can
display "0:60". Extracting two hooks makes the orchestration testable,
shrinks the component to layout + wiring, and gives the recurring
refresh-bug commits a single home.

## Current state

`src/app/page.tsx` structure today (line refs at commit `6e85bba`; plans
001/002 shift them slightly):

- Lines 50–70: auto-theme effect — on first run sets theme from `isDay`; on a
  `prevIsDay` transition flips theme; tracked via `initialThemeSet` /
  `prevIsDay` refs.
- Lines 73–93: `handleRefresh` — fades out, calls `refreshWeather()`, bumps
  `refreshKey` + `sunCalcTrigger`, then **manually duplicates persistence**:
  ```tsx
  // page.tsx:83-86 (inside handleRefresh)
  const currentHour = new Date().getHours();
  lastRefreshedHour.current = currentHour;
  localStorage.setItem('lastRefreshedHour', currentHour.toString());
  localStorage.setItem('lastRefreshedDate', new Date().toDateString());
  ```
  …which is exactly `saveRefreshState` (lines 130–134).
- Lines 99–104: `lastRefreshedHour` ref initialization (previous hour if
  before minute 1, else current hour).
- Lines 111–186: heartbeat refs/constants, localStorage restore effect,
  `saveRefreshState`, `checkHourBasedRefresh`, `checkSuspensionAndRefresh`,
  `handleWake`.
- Lines 188–261: the main effect — countdown `updateTimer` (can compute 60 →
  renders "0:60" at `page.tsx:390`), 1s countdown interval, 60s hourly-check
  interval, 30s heartbeat interval, `visibilitychange`/`focus`/`pageshow`
  listeners, full cleanup.
- Constants: `FADE_DURATION = 1000`, `HEARTBEAT_INTERVAL = 30000`,
  `HEARTBEAT_TOLERANCE = 60000`.

Existing hook conventions to match: hooks live in `src/app/hooks/`, one hook
per file, named `useX.ts`, return plain objects (see `useLocation.ts`,
`useWeather.ts`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Tests     | `npm test`               | all pass            |
| Lint      | `npx eslint src`         | exit 0; at most pre-existing warnings |
| Build     | `npm run build`          | exit 0              |
| Dev       | `npm run dev`            | serves on http://localhost:3000 |

## Scope

**In scope**:
- `src/app/hooks/useAutoRefresh.ts` (create)
- `src/app/hooks/useAutoTheme.ts` (create)
- `src/app/hooks/useAutoRefresh.test.ts` (create — pure helpers only)
- `src/app/page.tsx` (shrink)

**Out of scope**:
- Any behavior change beyond the two named fixes (duplication removal,
  "0:60" display). Refresh cadence, heartbeat tolerances, event choice,
  localStorage keys, and console.log messages all stay identical — those
  logs are the user's debugging tool per commit history.
- `useWeather.ts`, `RainViewerBackground.tsx`, all other components.
- The staged fade sequence and `handleLocationUpdate`/`handleThemeToggle`/
  `handleDayToggle` handlers — they stay in `page.tsx`.

## Git workflow

- Branch: `advisor/008-extract-refresh-hooks`
- Commit per step; short imperative sentences matching repo history.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract `useAutoTheme`

Create `src/app/hooks/useAutoTheme.ts` containing the lines 45–70 logic
verbatim (the two refs + the effect), as:

```ts
// Signature
export function useAutoTheme(isDay: boolean, setTheme: (t: string) => void): void
```

In `page.tsx`, replace the refs + effect with
`useAutoTheme(isDay, setTheme);`.

**Verify**: `npx tsc --noEmit` → exit 0. Dev smoke: load the app during local
daytime → light theme (or dark at night).

### Step 2: Extract `useAutoRefresh`

Create `src/app/hooks/useAutoRefresh.ts` that owns: `lastRefreshedHour`
initialization, localStorage restore/save, heartbeat refs + constants,
`checkHourBasedRefresh`, `checkSuspensionAndRefresh`, `handleWake`, the main
effect (all intervals + all three event listeners + cleanup), and the
countdown state. Signature:

```ts
// onRefresh: the page's handleRefresh (fade + refetch + cache-bust).
// The hook calls it when an hour boundary or wake-with-stale-hour is detected,
// and persists refresh state itself — the page no longer touches localStorage
// for refresh bookkeeping.
export function useAutoRefresh(onRefresh: () => void): {
    minutesLeft: number | null;
    notifyManualRefresh: () => void;  // page calls this inside handleRefresh
}
```

Inside, keep every constant, message, and interval identical. Two mandated
fixes while moving:

1. **De-duplicate persistence**: `handleRefresh` in `page.tsx` drops its
   inline localStorage block (old lines 83–86) and instead calls
   `notifyManualRefresh()`, which runs the hook's own `saveRefreshState(new Date().getHours())`.
2. **Fix "0:60"**: extract the countdown math into an exported pure helper in
   the same file —
   ```ts
   export function minutesUntilNextRefresh(now: Date): number
   ```
   — same algorithm (next minute-1 boundary), but clamp:
   `Math.min(59, Math.max(0, Math.floor(diffMs / 60000)))`. The effect calls
   this instead of inlining the math.

`page.tsx` then reduces to:
```tsx
const { minutesLeft, notifyManualRefresh } = useAutoRefresh(handleRefresh);
```
with `handleRefresh` defined before the hook call (it's a dependency).
Delete the now-moved lines from `page.tsx`.

**Verify**: `npx tsc --noEmit` → exit 0. `grep -n "localStorage.setItem('lastRefreshedHour'" src/app/page.tsx` → no matches (only the hook touches it).

### Step 3: Test the pure helper

Create `src/app/hooks/useAutoRefresh.test.ts` (node environment, fake system
time) covering `minutesUntilNextRefresh`:
- at HH:30:00 → 31
- at HH:00:30 → 0
- at HH:01:00 exactly → 59 (the old code produced 60 → displayed "0:60")
- at HH:59:59 → 1

**Verify**: `npm test` → all pass.

### Step 4: Full behavioral smoke test

`npm run dev`, then:
1. Load app → countdown shows `Auto Refresh in: 0:MM` with MM ≤ 59.
2. Click 🔄 Refresh → fade out/in, weather reloads, console shows no errors,
   and localStorage keys `lastRefreshedHour`/`lastRefreshedDate` update
   (DevTools → Application).
3. Switch to another tab for >60s, return → console logs `[Wake] Page became
   active` (and `[Wake] Suspension detected!` if >60s), exactly as before.
4. Theme toggle button still works.

**Verify**: all four observations.

## Test plan

Step 3's four cases for the countdown helper. The interval/listener
orchestration is validated behaviorally (Step 4) — jsdom timer testing of
the full hook is deliberately out of scope (no jsdom in the test setup, per
plan 004).

## Done criteria

- [ ] `wc -l src/app/page.tsx` ≤ 260 lines
- [ ] `npx tsc --noEmit`, `npm test`, `npm run build` all exit 0
- [ ] `grep -c "localStorage" src/app/page.tsx` counts only the `zoomLevel` usages (2)
- [ ] `minutesUntilNextRefresh(new Date('2026-01-01T10:01:00'))` tested → 59
- [ ] Step 4 smoke observations all hold, including unchanged console log messages
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The refresh logic in `page.tsx` no longer matches the structure described
  (someone refactored it already).
- After extraction, dev shows a refresh loop (repeated `[AutoRefresh]` logs
  every minute without hour changes) — a dependency-identity bug; report the
  effect's dep array rather than suppressing with eslint-disable.
- Preserving identical behavior appears to require passing more than
  `onRefresh` + the notify callback across the boundary (the seam is wrong;
  report the extra coupling you found).

## Maintenance notes

- The wake/heartbeat system is the repo's bug magnet (see commits `60c98ff`,
  `f148e37`, `df53912`, `b2dee59`). Future fixes now go in one file with a
  testable surface — extend `useAutoRefresh.test.ts` by extracting further
  pure predicates (e.g. "should refresh given (now, lastRefreshedHour)")
  rather than testing timers.
- Reviewer: diff the moved code against the original for silent edits —
  the only intended deltas are the de-duplication and the clamp.
- Deferred: replacing polling with a `setTimeout` aimed at the next minute-1
  boundary — cleaner but a behavior change; propose separately if wanted.
