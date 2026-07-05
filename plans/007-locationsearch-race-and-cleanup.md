# Plan 007: Location autocomplete cannot show stale results and cleans up its timer on unmount

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e85bba..HEAD -- src/app/components/LocationSearch.tsx`
> If the file changed since planning, compare against the excerpts; on
> mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e85bba`, 2026-07-05

## Why this matters

Autocomplete requests are debounced but never cancelled. Typing "Lon" then
"London" fires two fetches; if the "Lon" response arrives last (common on
slow connections), its suggestions overwrite the correct "London" ones — the
user sees results for a query they already replaced. Separately, the debounce
timer isn't cleared on unmount, so a pending callback can fire `setState` on
an unmounted component (React warning, harmless today, a leak pattern
regardless).

## Current state

`src/app/components/LocationSearch.tsx` — a client component with a debounced
suggestion fetcher:

```tsx
// LocationSearch.tsx:20-38
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
        setSuggestions([]);
        return;
    }
    try {
        const res = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`
        );
        const data = await res.json();
        if (data.results) setSuggestions(data.results);
        else setSuggestions([]);
    } catch (err) {
        console.error(err);
        setSuggestions([]);
    }
}, []);

// LocationSearch.tsx:40-54 (handleInputChange) — clears/sets debounceRef,
// 300ms, then calls fetchSuggestions(value). No unmount cleanup anywhere.
```

There is no `useEffect` in this file at all (verify: `grep -n useEffect src/app/components/LocationSearch.tsx` → no match).

Convention: errors are caught and logged with `console.error`, suggestions
cleared on failure — keep that.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Lint      | `npx eslint src`         | exit 0; at most pre-existing warnings |
| Dev       | `npm run dev`            | serves on http://localhost:3000 |

## Scope

**In scope**:
- `src/app/components/LocationSearch.tsx`

**Out of scope**:
- The manual Submit button's fetch (lines 113–142) — it sets
  `loadingLocation` and disables re-entry visually; racing it is a different,
  lower-value problem. Don't touch.
- Keyboard navigation / ARIA (plan 011 owns that; touching it here creates
  merge conflicts).
- Extracting a generic `useDebounce` hook — over-engineering for one call site.

## Git workflow

- Branch: `advisor/007-locationsearch-race-and-cleanup`
- Commit style: short imperative sentence matching repo history.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Abort superseded suggestion fetches

1. Add an abort ref: `const abortRef = useRef<AbortController | null>(null);`
2. In `fetchSuggestions`, before fetching: abort any previous controller,
   create a new one, pass its signal:
   ```tsx
   abortRef.current?.abort();
   const controller = new AbortController();
   abortRef.current = controller;
   // ...
   const res = await fetch(url, { signal: controller.signal });
   ```
3. In the `catch`, ignore abort errors (they are the expected result of
   superseding a request — clearing suggestions on them re-introduces flicker):
   ```tsx
   } catch (err) {
       if (err instanceof DOMException && err.name === 'AbortError') return;
       console.error(err);
       setSuggestions([]);
   }
   ```
4. Also abort in the `query.length < 2` early-return branch (an in-flight
   request for the longer previous query must not resurrect suggestions
   after the user deleted their input).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Clean up on unmount

Add a `useEffect` with an unmount cleanup that clears the debounce timer and
aborts any in-flight request:

```tsx
useEffect(() => {
    return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        abortRef.current?.abort();
    };
}, []);
```

**Verify**: `npx tsc --noEmit` → exit 0. `npx eslint src` → no new warnings.

### Step 3: Manual check

1. `npm run dev` → open app → click "📍 Current Location – …" to open search.
2. In DevTools → Network, throttle to "Slow 3G". Type "Lon", pause ~400ms,
   quickly extend to "London".
3. Expected: earlier `search?name=Lon…` requests show as **(canceled)** in the
   Network tab; the suggestion list matches the final query.
4. Type two characters then immediately toggle the search closed (click the
   location label): no React "setState on unmounted component" warning in
   console. (Note: the search panel is conditionally rendered inside the same
   component, so full unmount happens on page navigation — the timer cleanup
   is defensive; absence of new console errors is the check.)

**Verify**: observations 3 and 4.

## Test plan

Manual (Step 3). If jsdom-based component testing is ever added (deliberately
out of scope in plan 004), this file's abort behavior is a good first
candidate — noted, not required.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `grep -n "AbortController" src/app/components/LocationSearch.tsx` returns a match
- [ ] `grep -n "clearTimeout" src/app/components/LocationSearch.tsx` shows a cleanup in a `useEffect` return
- [ ] Manual race check (Step 3.3) observed: superseded requests canceled
- [ ] `git status` shows only `LocationSearch.tsx` modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The file no longer matches the excerpts (drift).
- Aborting requests somehow breaks the Submit flow (it must not — Submit has
  its own fetch — but if you observe it, report rather than restructure).

## Maintenance notes

- Plan 011 edits the same file (a11y). Land this first; 011's excerpts assume it.
- If a "use my location" geolocation feature is added later (direction option
  A in the audit), it will share this component — the abort pattern extends
  to reverse-geocoding calls.
