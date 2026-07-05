# Plan 006: The OpenWeatherMap API key lives server-side behind a tile proxy, and the exposed key is rotated

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e85bba..HEAD -- src/app/components/RainViewerBackground.tsx next.config.ts`
> If the tile-source block below no longer matches, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `6e85bba`, 2026-07-05

## Why this matters

The OpenWeatherMap API key is exposed to every visitor: it's stored as
`NEXT_PUBLIC_OWM_API_KEY` (the `NEXT_PUBLIC_` prefix inlines it into the
client JavaScript bundle) and appears in plain sight in every tile request
URL. Anyone can lift it from the deployed site and consume the account's
free-tier quota (1M calls/month), breaking the rain overlay for real users —
or worse if the account is ever upgraded to paid. The fix is a same-origin
tile proxy (a Next.js route handler) holding the key server-side, plus
rotation of the current key, which must be treated as burned.

## Current state

- `.env.local:1` — holds `NEXT_PUBLIC_OWM_API_KEY` (an OpenWeatherMap API
  key; the file is gitignored and NOT committed — good — but the
  `NEXT_PUBLIC_` prefix ships it in the bundle anyway).
- `src/app/components/RainViewerBackground.tsx` — the only consumer:

```tsx
// RainViewerBackground.tsx:32
const apiKey = process.env.NEXT_PUBLIC_OWM_API_KEY;
// RainViewerBackground.tsx:52-59
map.addSource(sourceId, {
    type: 'raster',
    tiles: [
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}&t=${key}`
    ],
    tileSize: 256,
    attribution: '© OpenWeatherMap'
});
```

  `{z}/{x}/{y}` are MapLibre tile-URL placeholders substituted by the map
  engine. `&t=${key}` is a cache-buster incremented on manual/hourly refresh.
- The repo has no `src/app/api/` directory yet; Next.js 16 App Router route
  handlers live at `src/app/api/<path>/route.ts`.
- Deployment: Vercel (`coat-check.vercel.app`). Env vars are set in the
  Vercel dashboard; a proxy route adds serverless-function invocations per
  tile — mitigated by CDN caching headers (Step 2).
- The app is a client component; the map runs entirely in the browser, so the
  proxy URL must be absolute or root-relative from the page origin.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Lint      | `npx eslint src`         | exit 0; at most pre-existing warnings |
| Build     | `npm run build`          | exit 0              |
| Dev       | `npm run dev`            | serves on http://localhost:3000 |
| Tile probe| `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/rain-tiles/5/15/10?t=0"` | `200` |

## Scope

**In scope**:
- `src/app/api/rain-tiles/[z]/[x]/[y]/route.ts` (create)
- `src/app/components/RainViewerBackground.tsx` (switch tile URL)
- `.env.local` (rename the variable — see Step 4; never print its value)
- `.env.example` (create or update with the new variable name, placeholder value only)

**Out of scope**:
- `src/components/ui/map.tsx` — vendored; the tile URL is app-level config.
- CARTO basemap style URLs — public, unauthenticated, fine as-is.
- Rate-limiting the proxy (see Maintenance notes — deferred).

## Git workflow

- Branch: `advisor/006-proxy-owm-tiles`
- Commit style: short imperative sentence matching repo history.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the tile proxy route handler

Create `src/app/api/rain-tiles/[z]/[x]/[y]/route.ts`:

```ts
import { NextRequest } from 'next/server';

const TILE_COORD = /^\d{1,2}$|^\d{1,7}$/;

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
    const { z, x, y } = await params;

    // Validate: small non-negative integers only (z 0-22, x/y within 2^z)
    const zi = Number(z), xi = Number(x), yi = Number(y);
    if (
        !Number.isInteger(zi) || !Number.isInteger(xi) || !Number.isInteger(yi) ||
        zi < 0 || zi > 22 || xi < 0 || yi < 0 || xi >= 2 ** zi || yi >= 2 ** zi
    ) {
        return new Response('Invalid tile coordinates', { status: 400 });
    }

    const apiKey = process.env.OWM_API_KEY;
    if (!apiKey) {
        console.error('[rain-tiles] OWM_API_KEY is not set');
        return new Response('Server misconfigured', { status: 500 });
    }

    const upstream = await fetch(
        `https://tile.openweathermap.org/map/precipitation_new/${zi}/${xi}/${yi}.png?appid=${apiKey}`
    );
    if (!upstream.ok) {
        return new Response('Upstream tile error', { status: 502 });
    }

    return new Response(upstream.body, {
        status: 200,
        headers: {
            'Content-Type': 'image/png',
            // Cache on the CDN; rain data updates every ~10 min upstream.
            'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=600',
        },
    });
}
```

Notes: in Next.js 16, dynamic route `params` is a Promise — await it (as
above). The client's `?t=` cache-buster passes through as a query string and
naturally varies the CDN cache key; do not forward it upstream.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Point the map at the proxy

In `RainViewerBackground.tsx`:
1. Delete line 32 (`const apiKey = ...`).
2. Change the tiles array to a same-origin absolute URL (MapLibre requires
   resolvable URLs; build from the page origin):
   ```ts
   tiles: [
       `${window.location.origin}/api/rain-tiles/{z}/{x}/{y}?t=${key}`
   ],
   ```
   (This code runs inside a `useEffect` in a `"use client"` component, so
   `window` is safe here.)

**Verify**: `grep -rn "NEXT_PUBLIC_OWM_API_KEY\|tile.openweathermap.org" src/app src/components` → the only `tile.openweathermap.org` match is in the new route handler; no `NEXT_PUBLIC_OWM_API_KEY` matches remain.

### Step 3: Local end-to-end check

1. In `.env.local`, add `OWM_API_KEY=<same value as the old var for now>`
   (copy the value within the file; never echo it to the terminal or into
   any committed file).
2. `npm run dev`, open http://localhost:3000 → rain overlay renders over the
   basemap (compare against production if unsure there's currently rain
   anywhere visible — zoom is fixed; a fully clear map can be legitimate.
   The curl probe is the deterministic check).
3. Run the tile probe curl (Commands table) → `200`.
4. Probe validation: `curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/rain-tiles/99/0/0"` → `400`.

**Verify**: probes return 200 and 400 respectively; no console errors about
tiles in the browser.

### Step 4: Retire the exposed key (operator hand-off)

These require dashboard access — do them if you have it; otherwise list them
in your completion report as operator actions:

1. In the Vercel project settings: add `OWM_API_KEY` (server), remove
   `NEXT_PUBLIC_OWM_API_KEY`, redeploy.
2. In the OpenWeatherMap account: generate a new API key, update
   `OWM_API_KEY` in Vercel and `.env.local`, then delete the old key. The
   old key has been public in the client bundle since first deploy and must
   be considered burned.
3. Remove the `NEXT_PUBLIC_OWM_API_KEY` line from `.env.local`.

**Verify**: `grep -rn "NEXT_PUBLIC_OWM" .env.local` → no match (after step 3).

## Test plan

The two curl probes (valid tile → 200 + PNG; invalid z → 400) are the
functional tests. If plan 004 has landed, optionally add
`src/app/api/rain-tiles/validate.test.ts` for the coordinate-validation
predicate by extracting it into an exported pure function — optional, not a
done criterion.

## Done criteria

- [ ] `npx tsc --noEmit` and `npm run build` exit 0
- [ ] `grep -rn "NEXT_PUBLIC_OWM_API_KEY" src/` returns no matches
- [ ] Tile probe returns 200 with `Content-Type: image/png`; invalid-coordinate probe returns 400
- [ ] Rain overlay renders in local dev
- [ ] No secret value appears in any committed file (`git diff` inspected)
- [ ] Key rotation done, or explicitly listed as a pending operator action in the completion report
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- MapLibre refuses the proxied tile URL or tiles 404 through the proxy after
  one debugging pass (report the network trace; do not fall back to the
  direct OWM URL).
- The route handler cannot read `OWM_API_KEY` in dev despite `.env.local`
  containing it (would indicate a Next env-loading quirk worth reporting, not
  patching around).
- You are tempted to log, echo, or commit the key value anywhere. Never do.

## Maintenance notes

- The proxy is unauthenticated and open to anyone who finds it — same
  exposure class as before, but now bounded by your CDN cache and origin. If
  quota abuse appears, add per-IP rate limiting or a signed-request check at
  the route; that's the deliberate deferral here.
- Vercel serverless invocations now occur per uncached tile; the
  `s-maxage=600` header keeps that small. If costs show up, raise it — rain
  radar staleness tolerance is ~10–15 min.
- Reviewer: confirm `?t=` is NOT forwarded upstream (it would needlessly bust
  OWM-side caching) and that `params` is awaited (Next 16 breaking change).
