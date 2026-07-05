# Plan 002: Fade transitions actually run at the designed 1000ms (fix runtime-built Tailwind classes)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e85bba..HEAD -- src/app/page.tsx src/app/components/Header.tsx src/app/components/WeatherCard.tsx src/app/components/CurrentWeatherCard.tsx src/app/components/LoadingScreen.tsx`
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

Five components build a Tailwind class at runtime via a template literal:
`duration-[${FADE_DURATION}ms]`. Tailwind (v4) generates CSS by statically
scanning source files for complete class names — it sees the literal text
`duration-[${FADE_DURATION}ms]`, which is not a valid class, so
`duration-[1000ms]` is **never generated**. Verified: the string `1000ms`
does not appear anywhere in the built CSS under `.next/`. Every fade in the
app therefore runs at Tailwind's `transition-opacity` default of **150ms**
instead of the designed 1000ms. The elaborate fade choreography in `page.tsx`
(timeouts tuned to `FADE_DURATION = 1000`) waits a full second for fades that
finished in 150ms.

## Current state

The broken pattern appears at exactly 5 sites (confirm with the grep in Done
criteria):

- `src/app/page.tsx:334` — map background wrapper:
  ```tsx
  className={`transition-opacity duration-[${FADE_DURATION}ms] ${backgroundVisible ? 'opacity-100' : 'opacity-0'
    }`}
  ```
- `src/app/components/Header.tsx:27` — `<header className={`mb-2 text-center transition-opacity duration-[${FADE_DURATION}ms] ${...}`}>`
- `src/app/components/WeatherCard.tsx:23` — on the `SpotlightCard` className
- `src/app/components/CurrentWeatherCard.tsx:21` — on the `SpotlightCard` className
- `src/app/components/LoadingScreen.tsx:11` — on the wrapper div className

`FADE_DURATION` is defined in `src/app/page.tsx:42` (`const FADE_DURATION = 1000;`)
and passed to Header, WeatherCard, CurrentWeatherCard, and LoadingScreen as a
prop named `FADE_DURATION`. `SpotlightCard`
(`src/app/components/SpotlightCard.tsx`) spreads extra props onto its root
div (`{...props}`), so it accepts a `style` prop.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Lint      | `npx eslint src`         | exit 0; at most pre-existing warnings |
| Build     | `npm run build`          | exit 0              |
| Dev       | `npm run dev`            | serves on http://localhost:3000 |

## Scope

**In scope** (the only files you should modify):
- `src/app/page.tsx`
- `src/app/components/Header.tsx`
- `src/app/components/WeatherCard.tsx`
- `src/app/components/CurrentWeatherCard.tsx`
- `src/app/components/LoadingScreen.tsx`

**Out of scope**:
- `src/app/globals.css` — do not add safelist/`@source inline` hacks; the fix
  is inline style, not CSS config.
- Timeout values / choreography in `page.tsx` handlers — the *timings* are
  already correct; only the CSS class is broken.
- Static duration classes like `duration-500` or `duration-300` elsewhere —
  those are valid and work.

## Git workflow

- Branch: `advisor/002-fix-tailwind-fade-durations`
- Commit style: short imperative sentence matching repo history.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the dynamic class with an inline transition duration

At each of the 5 sites, remove `duration-[${FADE_DURATION}ms]` from the
className template and add an inline style on the same element:

```tsx
// Before (Header.tsx:26-29)
<header
    className={`mb-2 text-center transition-opacity duration-[${FADE_DURATION}ms] ${pageVisible ? (fade ? 'opacity-0' : 'opacity-100') : 'opacity-0'
        }`}
>

// After
<header
    className={`mb-2 text-center transition-opacity ${pageVisible ? (fade ? 'opacity-0' : 'opacity-100') : 'opacity-0'
        }`}
    style={{ transitionDuration: `${FADE_DURATION}ms` }}
>
```

Apply the same transformation in all five files. Keep the `transition-opacity`
class (it sets the transition property and easing); the inline
`transitionDuration` overrides only the duration. For `WeatherCard.tsx` and
`CurrentWeatherCard.tsx` the element is a `SpotlightCard` — pass
`style={{ transitionDuration: \`${FADE_DURATION}ms\` }}` as a prop; it is
spread onto the root div.

**Verify**: `grep -rn 'duration-\[' src/` → no matches.
`npx tsc --noEmit` → exit 0.

### Step 2: Confirm visually

1. `npm run dev`, open http://localhost:3000.
2. Click the 🔄 Refresh button: the cards should fade out slowly (a full
   second), hold, and fade back — not a quick 150ms blink.
3. Toggle the theme (bottom-left button): same slow fade.

**Verify**: fades are visibly ~1s. If unsure, in DevTools inspect the header
element → Computed → `transition-duration` must be `1s`.

## Test plan

Visual behavior; no unit tests applicable. The `grep` in Done criteria is the
regression guard until a lint rule exists.

## Done criteria

- [ ] `grep -rn 'duration-\[' src/` returns no matches
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] DevTools shows computed `transition-duration: 1s` on the header element
- [ ] `git status` shows only the five in-scope files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- You find more than the 5 listed occurrences of `duration-[${` (drift —
  new call sites were added; report the full list).
- `SpotlightCard` no longer spreads `{...props}` onto its root element (the
  style prop would silently drop — report instead of restructuring
  SpotlightCard).

## Maintenance notes

- The rule for future contributors: **never build Tailwind class names from
  variables** — Tailwind only generates classes it can see as complete
  strings at build time. Use inline `style` for dynamic values.
- Plan 008 (page.tsx refactor) touches the same file; land this first (it's
  smaller and 008's excerpts assume it).
- Reviewer: check no site lost its `transition-opacity` class — without it
  there is no transition at all.
