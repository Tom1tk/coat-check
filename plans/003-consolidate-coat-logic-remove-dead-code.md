# Plan 003: One coat-advice function, dead files deleted, README architecture section truthful

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e85bba..HEAD -- src/app/hooks/useWeather.ts src/app/hooks/useCoatAdvice.ts src/app/hooks/useSunCalc.ts src/app/utils/mapUtils.ts README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (Exception: plan 001 legitimately
> edits `useWeather.ts`'s `refresh` callback — only the derivation functions'
> coat-advice blocks must still match the excerpts below.)

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (but land after 001 to avoid merge conflicts in `useWeather.ts`)
- **Category**: tech-debt
- **Planned at**: commit `6e85bba`, 2026-07-05

## Why this matters

The coat recommendation — the entire point of the app — is implemented three
times: twice inline in `useWeather.ts` and once in a hook
(`useCoatAdvice.ts`) that **nothing imports**. The dead hook even contains a
falsy-zero bug (`otherTemp && otherTemp < 10` skips 0°C), waiting to be
"reused" by a future contributor. Two more dead artifacts exist:
`src/app/utils/mapUtils.ts` (never imported) and a second `latLonToTile`
inside `useSunCalc.ts` (also never imported). Meanwhile `README.md:93`
documents the dead hook as where the coat logic lives. After this plan there
is exactly one pure, exported, testable `getCoatAdvice` function, no dead
files, and an accurate README. This also gives plan 004 (test baseline) a
clean unit to test.

## Current state

Confirm dead code first: `grep -rn "useCoatAdvice\|latLonToTile\|mapUtils" src/ --include="*.ts*"`
must show only the definitions themselves, no imports.

- `src/app/hooks/useWeather.ts` — the two live copies of the logic:

```ts
// useWeather.ts:31-36 (inside deriveCurrentHourWeather)
let coatAdvice = 'No need to bring a coat';
if (currentRain > 0 || currentTemp < 10) {
    coatAdvice = 'Bring a coat';
} else if (currentTemp >= 10 && currentTemp <= 15 && currentCondition === 'Cloudy') {
    coatAdvice = 'Coat recommended but not necessary';
}
```

```ts
// useWeather.ts:64-72 (inside deriveDayWeather)
let coatAdvice = 'No need to bring a coat';
if (morningRain > 0 || afternoonRain > 0 || morningTemp < 10 || afternoonTemp < 10) {
    coatAdvice = 'Bring a coat';
} else if (
    (morningTemp >= 10 && morningTemp <= 15 && morningCondition === 'Cloudy') ||
    (afternoonTemp >= 10 && afternoonTemp <= 15 && afternoonCondition === 'Cloudy')
) {
    coatAdvice = 'Coat recommended but not necessary';
}
```

- `src/app/hooks/useCoatAdvice.ts` — 34 lines, never imported. DELETE.
- `src/app/utils/mapUtils.ts` — 9 lines (`TILE_SIZE`, `latLonToTile`), never
  imported. DELETE.
- `src/app/hooks/useSunCalc.ts:30-36` — a second `latLonToTile` export tacked
  onto the sun hook file, never imported. DELETE those lines only; the
  `useSunCalc` hook above them is live.
- `README.md:93` — `│   │   └── useCoatAdvice.ts     # Coat recommendation logic`
  and `README.md:97` — `│       └── mapUtils.ts          # Map tile coordinate helpers`
  document the dead files.
- Convention: pure helpers live in `src/app/utils/` with plain named exports
  (see `src/app/utils/weatherUtils.ts`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Lint      | `npx eslint src`         | exit 0; at most pre-existing warnings |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `src/app/utils/coatAdvice.ts` (create)
- `src/app/hooks/useWeather.ts` (replace the two inline blocks with calls)
- `src/app/hooks/useCoatAdvice.ts` (delete)
- `src/app/utils/mapUtils.ts` (delete)
- `src/app/hooks/useSunCalc.ts` (delete the dead `latLonToTile` only)
- `README.md` (architecture tree only)

**Out of scope**:
- Changing the advice *rules or wording* — this is a pure consolidation; the
  three UI-visible strings must remain byte-identical.
- The fetch/error logic in `useWeather.ts` (plan 001's territory).
- `src/components/ui/map.tsx` — vendored third-party code.

## Git workflow

- Branch: `advisor/003-consolidate-coat-logic`
- Commit style: short imperative sentence matching repo history.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the single pure function

Create `src/app/utils/coatAdvice.ts`:

```ts
export interface WeatherPeriod {
    temp: number;
    rain: number;
    condition: string;
}

export const COAT_ADVICE = {
    NEEDED: 'Bring a coat',
    RECOMMENDED: 'Coat recommended but not necessary',
    NOT_NEEDED: 'No need to bring a coat',
} as const;

export type CoatAdvice = (typeof COAT_ADVICE)[keyof typeof COAT_ADVICE];

// A coat is needed if any period is rainy or below 10°C; recommended if any
// period is 10–15°C and cloudy.
export function getCoatAdvice(periods: WeatherPeriod[]): CoatAdvice {
    if (periods.some((p) => p.rain > 0 || p.temp < 10)) {
        return COAT_ADVICE.NEEDED;
    }
    if (periods.some((p) => p.temp >= 10 && p.temp <= 15 && p.condition === 'Cloudy')) {
        return COAT_ADVICE.RECOMMENDED;
    }
    return COAT_ADVICE.NOT_NEEDED;
}
```

This is semantically identical to both inline blocks: with one period it
reproduces the current-hour logic; with two periods it reproduces the
morning/afternoon logic (each `some` distributes over the `||` chains).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Switch `useWeather.ts` to the shared function

1. Add `import { getCoatAdvice } from '../utils/coatAdvice';`.
2. In `deriveCurrentHourWeather`, replace the lines 31–36 block with:
   ```ts
   const coatAdvice = getCoatAdvice([
       { temp: currentTemp, rain: currentRain, condition: currentCondition },
   ]);
   ```
3. In `deriveDayWeather`, replace the lines 64–72 block with:
   ```ts
   const coatAdvice = getCoatAdvice([
       { temp: morningTemp, rain: morningRain, condition: morningCondition },
       { temp: afternoonTemp, rain: afternoonRain, condition: afternoonCondition },
   ]);
   ```

**Verify**: `npx tsc --noEmit` → exit 0. `npm run build` → exit 0.

### Step 3: Delete the dead code

1. `git rm src/app/hooks/useCoatAdvice.ts`
2. `git rm src/app/utils/mapUtils.ts`
3. In `src/app/hooks/useSunCalc.ts`, delete lines 30–36 (the comment block +
   `latLonToTile` function). Keep everything above line 30.

**Verify**: `npx tsc --noEmit` → exit 0.
`grep -rn "useCoatAdvice\|latLonToTile\|mapUtils" src/` → no matches.

### Step 4: Fix the README architecture tree

In `README.md`'s Architecture section (lines ~89–97):
- Remove the `useCoatAdvice.ts` line and the `mapUtils.ts` line.
- Add under `utils/`: `coatAdvice.ts       # Coat recommendation rules (pure)`.

**Verify**: `grep -n "useCoatAdvice\|mapUtils" README.md` → no matches.

## Test plan

Plan 004 adds the test runner and includes `coatAdvice.test.ts` cases
(boundaries at 10°C and 15°C, rain > 0, Cloudy vs Clear, single vs two
periods, temp exactly 0). Until then, behavior preservation is guaranteed by
the mechanical mapping in Step 1 plus the build gate.

## Done criteria

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -rn "useCoatAdvice\|latLonToTile\|mapUtils" src/ README.md` returns no matches
- [ ] `src/app/utils/coatAdvice.ts` exists and exports `getCoatAdvice`
- [ ] The three advice strings in `coatAdvice.ts` are byte-identical to the originals
- [ ] `git status` shows only in-scope files changed/deleted
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The grep in "Current state" shows `useCoatAdvice`, `latLonToTile`, or
  `mapUtils` imported anywhere — they would no longer be dead.
- The inline advice blocks in `useWeather.ts` no longer match the excerpts
  (rules changed since planning; consolidation must preserve the *new* rules,
  which needs re-planning).

## Maintenance notes

- Direction option B in the audit (configurable commute thresholds) would
  parameterize `getCoatAdvice`'s 10/15 constants — this file is where that
  lands.
- Reviewer: diff the advice strings character-by-character; UI copy must not
  change.
- Deferred: `weatherUtils.ts`'s `codeToCondition` covers only a subset of WMO
  codes (snow 71–77, showers 80–86, thunderstorm 95–99 → 'Other'); expanding
  it changes advice behavior and is deliberately out of scope here.
