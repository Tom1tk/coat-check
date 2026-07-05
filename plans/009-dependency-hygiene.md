# Plan 009: Dependencies aligned — eslint-config-next matches Next 16, audit vulns cleared, types in devDependencies

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e85bba..HEAD -- package.json package-lock.json`
> If versions already moved (e.g. plan 004 added vitest — that's fine), just
> confirm the three specific issues below still exist before proceeding; if
> any is already fixed, skip that step and note it.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (if plan 004 landed, `npm test` becomes an extra verification gate — use it)
- **Category**: migration
- **Planned at**: commit `6e85bba`, 2026-07-05

## Why this matters

Three hygiene issues, each cheap and each a slow leak: (1) `eslint-config-next`
is pinned at `15.5.5` while `next` is `^16.1.1` — the lint rules lag the
framework major and can miss/mis-report Next-16-specific patterns. (2)
`npm audit` reports 10 vulnerabilities (5 high) — all in **transitive
build-time** dependencies (`tar` via `@tailwindcss/oxide`,
`protocol-buffers-schema` via `maplibre-gl→pbf`, plus eslint-chain packages),
none reachable in shipped runtime code, but all clearable with
`npm audit fix`, and leaving them red trains people to ignore the signal. (3)
`@types/suncalc` sits in `dependencies` — type packages belong in
`devDependencies`.

## Current state

- `package.json:12` — `"@types/suncalc": "^1.9.2"` under `dependencies`.
- `package.json:17` — `"next": "^16.1.1"`.
- `package.json:31` — `"eslint-config-next": "15.5.5"` (exact pin, one major behind).
- `npm audit` (2026-07-05): 10 vulnerabilities (5 moderate, 5 high); all fix
  available via `npm audit fix` (no `--force` needed per audit output).
  Affected chains: `tar@7.5.2` ← `@tailwindcss/oxide` (build tool);
  `protocol-buffers-schema@3.6.0` ← `pbf` ← `maplibre-gl` (schema parsing not
  invoked in browser runtime path); `ajv`/`brace-expansion`/`flatted`/
  `js-yaml`/`minimatch` ← eslint toolchain (dev-only).
- Baseline check results at planning time: `npx tsc --noEmit` exits 0;
  `npx eslint src` exits 0 with 2 warnings
  (`jsx-a11y/role-has-required-aria-props` in `LocationSearch.tsx:90`,
  `react-hooks/exhaustive-deps` in `useWeather.ts:106` — the latter removed
  by plan 001 if it landed).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Audit     | `npm audit`              | 0 vulnerabilities (after Step 2) |
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Lint      | `npx eslint src`         | exit 0 (warnings OK) |
| Build     | `npm run build`          | exit 0              |
| Tests     | `npm test` (only if plan 004 landed) | all pass |

## Scope

**In scope**:
- `package.json`
- `package-lock.json`

**Out of scope**:
- Upgrading `next`, `react`, `tailwindcss`, `maplibre-gl`, or any direct
  dependency's major/minor — this plan is alignment + audit-fix only.
- `npm audit fix --force` — never; it can jump majors.
- Any source file. If a dependency change forces a source change, that's a
  STOP condition.

## Git workflow

- Branch: `advisor/009-dependency-hygiene`
- One commit per step is fine; short imperative sentences.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Align eslint-config-next with Next 16

1. Check the installed next version: `npm ls next` (expect 16.x).
2. `npm install --save-dev eslint-config-next@16` — if npm reports no
   matching version, run `npm view eslint-config-next versions --json | tail -20`,
   pick the latest 16.x, and install that exact spec. If **no 16.x exists at
   all**, STOP (see STOP conditions).
3. Run `npx eslint src`. New warnings are acceptable (report them); new
   **errors** must be triaged: if they are legitimate findings in app code,
   list them in your report rather than fixing app code (out of scope); if
   they are config breakage, STOP.

**Verify**: `npm ls eslint-config-next` shows a 16.x version; `npx eslint src`
exits 0 or exits 1 only with pre-approved reported findings.

### Step 2: Clear the audit

1. `npm audit fix` (no `--force`).
2. `npm audit` → expect 0 vulnerabilities. If any remain, record exactly
   which advisories persist and why (`fix available` false?) in your report —
   do not force.

**Verify**: `npm audit` → `found 0 vulnerabilities` (or documented remainder).

### Step 3: Move @types/suncalc

1. `npm uninstall @types/suncalc && npm install --save-dev @types/suncalc`
2. Confirm it now appears under `devDependencies` in `package.json`.

**Verify**: `npx tsc --noEmit` → exit 0 (types still resolve).

### Step 4: Full gate

`npx tsc --noEmit && npx eslint src && npm run build` (plus `npm test` if the
script exists) — all exit 0.

**Verify**: as stated.

## Test plan

No new tests; the existing gates (typecheck, lint, build, suite if present)
are the regression net for a lockfile-level change.

## Done criteria

- [ ] `npm ls eslint-config-next` reports 16.x
- [ ] `npm audit` reports 0 vulnerabilities (or a written list of unfixable-without-force remainders)
- [ ] `@types/suncalc` is under `devDependencies`
- [ ] `npx tsc --noEmit`, `npx eslint src`, `npm run build` exit 0
- [ ] `git status` shows only `package.json` and `package-lock.json` modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- No 16.x `eslint-config-next` exists on the registry (report; the operator
  may prefer the `@next/eslint-plugin` route — that's a decision, not a
  default).
- `npm audit fix` modifies `next`, `react`, `react-dom`, `maplibre-gl`, or
  `tailwindcss` version specs in `package.json` (it should only touch
  transitive locks; direct-dep changes need human sign-off).
- The build breaks after any step and reverting that step's change fixes it.

## Maintenance notes

- Consider enabling GitHub Dependabot (or Renovate) so the lag doesn't
  re-accumulate — deferred here because it's a repo-settings decision.
- The `maplibre-gl` chain advisory (`protocol-buffers-schema`) will resurface
  whenever the lockfile pins an old `pbf`; it's build-graph noise unless the
  app starts parsing vector tiles server-side.
- Reviewer: the diff should be exactly two files, and `package.json`'s only
  spec changes should be `eslint-config-next` and the `@types/suncalc` move.
