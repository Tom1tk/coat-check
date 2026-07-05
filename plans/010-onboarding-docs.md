# Plan 010: A newcomer (or agent) can clone, configure, and run the app from the docs alone

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e85bba..HEAD -- README.md .env.example CLAUDE.md src/app/components/RainViewerBackground.tsx`
> Also check whether plan 006 landed (`ls src/app/api/rain-tiles 2>/dev/null`)
> — it renames the env var this plan documents; Step 1 branches on it.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none hard; **soft-depends on plans/006** (env var name changes) — if 006 is planned but not landed, prefer landing 006 first to avoid documenting a name that's about to change
- **Category**: dx
- **Planned at**: commit `6e85bba`, 2026-07-05

## Why this matters

The README has features, architecture, and credits — but **no setup section
at all**. The one required secret (`NEXT_PUBLIC_OWM_API_KEY`, an
OpenWeatherMap key needed for the rain overlay) is documented nowhere; there
is no `.env.example`; and there is no `CLAUDE.md`, which matters in this repo
specifically because implementation plans in `plans/` are executed by coding
agents that need build/test commands and conventions stated. A newcomer today
clones the repo, runs it, and gets a map with a silently missing rain layer.

## Current state

- `README.md` — sections: Features, APIs Used, Architecture, Tech Stack,
  License, Credits. No Setup/Getting Started. The Architecture tree (lines
  70–101) is corrected by plan 003 (it currently lists dead files —
  coordinate: if 003 hasn't landed, don't fix its lines here, just add the
  new section).
- Env var consumption: `src/app/components/RainViewerBackground.tsx:32` —
  `const apiKey = process.env.NEXT_PUBLIC_OWM_API_KEY;` — no fallback and no
  warning if unset; tiles silently 401 (invisible overlay). **If plan 006
  landed**, the variable is instead `OWM_API_KEY`, read server-side in
  `src/app/api/rain-tiles/[z]/[x]/[y]/route.ts`.
- No `.env.example`, no `CLAUDE.md`, no `CONTRIBUTING.md`.
- `.gitignore` ignores `.env*` — an `.env.example` must be force-added or the
  pattern narrowed; narrowing is cleaner (Step 2).
- Working commands, verified: `npm install`, `npm run dev` (Turbopack, port
  3000), `npm run build`, `npx tsc --noEmit`, `npx eslint src`; `npm test`
  exists only if plan 004 landed.
- License: GPL-3.0. Deploy target: Vercel.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Dev       | `npm run dev`            | serves on http://localhost:3000 |
| Build     | `npm run build`          | exit 0              |

## Scope

**In scope**:
- `README.md` (add a "Getting Started" section; do not rewrite other sections)
- `.env.example` (create)
- `.gitignore` (one-line adjustment to un-ignore `.env.example`)
- `CLAUDE.md` (create)

**Out of scope**:
- Any source code change (including adding a missing-key warning to
  `RainViewerBackground.tsx` — tempting, but code changes don't belong in a
  docs plan; note it as a suggestion in your report).
- Restructuring existing README sections (plan 003 owns the architecture-tree fix).
- `.env.local` — never open, print, or commit it.

## Git workflow

- Branch: `advisor/010-onboarding-docs`
- Commit style: short imperative sentence (repo examples: "Updated readme",
  "Updated readme again" — aim slightly higher).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Determine the env var name

If `src/app/api/rain-tiles/` exists (plan 006 landed), the variable is
`OWM_API_KEY` (server-side). Otherwise it is `NEXT_PUBLIC_OWM_API_KEY`
(client-side). Use the correct name consistently in Steps 2–4. All
verification greps below use `OWM_API_KEY` as the substring, which matches
both.

### Step 2: Create `.env.example` and un-ignore it

`.env.example` content (placeholder only — never a real value):

```
# OpenWeatherMap API key — used for the precipitation tile overlay.
# Get a free key at https://home.openweathermap.org/api_keys
<VAR_NAME_FROM_STEP_1>=your_openweathermap_api_key_here
```

In `.gitignore`, change the env section to keep ignoring real env files but
track the example:

```
# env files (can opt-in for committing if needed)
.env*
!.env.example
```

**Verify**: `git check-ignore .env.example` → exits 1 (not ignored);
`git check-ignore .env.local` → exits 0 (still ignored).

### Step 3: Add "Getting Started" to README.md

Insert after the Features section (before "APIs Used"), matching the
README's existing tone and `##` heading style:

```markdown
## Getting Started

### Prerequisites
- Node.js 20+ and npm
- A free [OpenWeatherMap API key](https://home.openweathermap.org/api_keys) (for the rain overlay)

### Run locally

​```bash
git clone <repo-url>
cd coat-check
npm install
cp .env.example .env.local   # then paste your OpenWeatherMap key
npm run dev                  # http://localhost:3000
​```

Without the API key the app still runs, but the precipitation overlay will be missing.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
```

(Include `npm test` in the table only if the script exists in `package.json`.)

**Verify**: `grep -n "Getting Started" README.md` → match;
`grep -n "OWM_API_KEY" README.md` → no raw variable dump of a value, name only.

### Step 4: Create `CLAUDE.md`

Repo root, content (adjust env var name and test row per Steps 1 and 3):

```markdown
# CLAUDE.md

Coat Check — a Next.js 16 (App Router, Turbopack) + React 19 + Tailwind 4
weather app answering one question: do you need a coat for the 9–5 commute.
Deployed on Vercel at coat-check.vercel.app.

## Commands

- `npm run dev` — dev server on :3000 (Turbopack)
- `npm run build` — production build (must pass before committing)
- `npx tsc --noEmit` — typecheck (strict mode; must stay clean)
- `npx eslint src` — lint
- `npm test` — Vitest suite (if present)

## Environment

- `<VAR_NAME>` in `.env.local` — OpenWeatherMap key for the rain tile
  overlay. Copy `.env.example`. Never commit real keys.

## Architecture (src/)

- `app/page.tsx` — main client component: layout, fade choreography, wiring
- `app/hooks/` — one hook per file (`useWeather` fetches Open-Meteo;
  `useLocation` persists to localStorage; `useSunCalc` derives day/night)
- `app/utils/` — pure functions (weather-code mapping, coat rules)
- `app/components/` — presentational components; glass-morphism via the
  `glass-panel` class + `SpotlightCard`
- `components/ui/map.tsx` — VENDORED MapLibre wrapper from mapcn; do not
  edit it for app-level concerns

## Conventions

- All UI is client components (`'use client'`); no server data fetching
- State persisted to localStorage: location, zoomLevel, lastRefreshedHour
- Never build Tailwind class names from template variables — Tailwind can't
  see them at build time; use inline `style` for dynamic values
- Implementation plans live in `plans/` — read `plans/README.md` before
  starting improvement work
```

**Verify**: file exists; every command listed in it actually runs from a
clean shell (`npm run build` at minimum).

### Step 5: Fresh-clone dry run

In a temp directory: `git clone <this repo path> /tmp-check && cd /tmp-check`
(or `git worktree`), then follow ONLY the README Getting Started steps
(skip the real API key — use the placeholder). Expected: `npm install` and
`npm run dev` succeed and the app loads at :3000 (rain overlay absent, as
the README states).

**Verify**: the dry run reaches a rendering app using no knowledge outside
the README. Delete the temp clone afterwards.

## Test plan

The Step 5 dry run IS the test: docs are correct iff a context-free clone
succeeds by following them.

## Done criteria

- [ ] `.env.example` exists, contains a placeholder (no real key), and is not gitignored
- [ ] `git check-ignore .env.local` still exits 0
- [ ] README has a Getting Started section whose commands all exist in `package.json`
- [ ] `CLAUDE.md` exists with commands, env, architecture, conventions
- [ ] Fresh-clone dry run (Step 5) succeeded
- [ ] No real secret value in any changed file (inspect `git diff` before committing)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- You cannot determine the correct env var name (neither the
  `RainViewerBackground.tsx:32` pattern nor an `api/rain-tiles` route exists
  — the codebase drifted).
- The fresh-clone dry run fails for a reason a docs change cannot fix (broken
  build on a clean install — that's a new finding, not yours to fix).

## Maintenance notes

- When plan 006 lands (if after this), update the var name in all three docs
  files — grep for `OWM_API_KEY`.
- The suggested-but-out-of-scope code improvement: log a console warning in
  `RainViewerBackground.tsx` when the key is absent, so the silent-missing-
  overlay failure mode becomes diagnosable. Worth a one-line follow-up.
- Keep `CLAUDE.md` under ~60 lines; it's loaded into every agent session.
