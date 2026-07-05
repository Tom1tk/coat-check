# Plan 012: The rain overlay uses RainViewer's multi-colour radar (zoom.earth look), with OWM as fallback

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. The reviewer maintains `plans/README.md` — do
> not edit it.
>
> **Drift check (run first)**: `git log --oneline -1` → must be on branch
> `advisor/012-rainviewer-radar` at or after `31e55ad`.
> `grep -n "api/rain-tiles" src/app/components/RainViewerBackground.tsx` →
> must match (the OWM proxy URL is present). On mismatch, STOP.

## Status

- **Priority**: P2 (user-requested feature)
- **Effort**: M
- **Risk**: MED (touches the map layer lifecycle, which has theme-change re-add subtleties)
- **Depends on**: plans 006 (proxy = the fallback), 004 (test runner) — both landed on `staging`
- **Category**: feature
- **Planned at**: commit `31e55ad`, 2026-07-06

## Why this matters

The current OpenWeatherMap `precipitation_new` layer is monochrome blue and
hard to read. RainViewer's public API serves a real radar composite with a
dynamic palette (pale drizzle → blue → yellow → orange → red — the zoom.earth
look), needs **no API key**, is CORS-open, and updates every 10 minutes. The
user explicitly requested this look. OWM stays as a fallback when the
RainViewer frame index can't be fetched.

## Verified API facts (checked 2026-07-05, do not re-derive)

- Frame index: `GET https://api.rainviewer.com/public/weather-maps.json`
  (CORS `*`, no key). Shape:
  ```json
  { "version": "2.0", "host": "https://tilecache.rainviewer.com",
    "radar": { "past": [ { "time": 1783284600, "path": "/v2/radar/8e3bc56337b2" }, ... ],
               "nowcast": [] } }
  ```
  `radar.past` is oldest→newest; the **last** entry is the current frame.
  Paths are unique hashes → no cache-bust param needed.
- Tile URL template: `{host}{path}/256/{z}/{x}/{y}/2/1_1.png`
  (`2` = colour id — server currently ignores it but it must be a valid id;
  `1_1` = smoothed + snow colours). Keep `{z}/{x}/{y}` literal — MapLibre
  substitutes them.
- Native max zoom is **7**; the app's ZoomControl goes to 8 → the raster
  source MUST set `maxzoom: 7` so MapLibre overzooms instead of requesting
  missing tiles.
- Attribution is required: "Weather data © RainViewer" linking to
  https://www.rainviewer.com/ (the map's compact attribution control renders
  source attributions, so source-level attribution suffices; README credit
  added too).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `npm install`            | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Lint      | `npx eslint src`         | exit 0, 0 warnings  |
| Tests     | `npm test`               | all pass (32 existing + new) |
| Build     | `npm run build`          | exit 0              |
| Dev       | `npm run dev`            | serves on http://localhost:3000 |

## Scope

**In scope**:
- `src/app/utils/radarFrames.ts` (create)
- `src/app/utils/radarFrames.test.ts` (create)
- `src/app/components/RainViewerBackground.tsx` (modify the overlay layer)
- `README.md` (APIs Used table, Credits, Getting Started key-now-optional)
- `CLAUDE.md` (env section: key optional)
- `.env.example` (comment: key optional, fallback only)

**Out of scope**:
- Deleting `/api/rain-tiles` (it is the fallback — keep unchanged).
- Animated frame loops, nowcast frames (deferred by the user).
- `src/components/ui/map.tsx` (vendored — never edit).
- Any change to page.tsx, hooks, or other components.

## Git workflow

- Branch: `advisor/012-rainviewer-radar` (you are already on it).
- Commit per step; short imperative sentences matching repo history.
- Do NOT push or open a PR.

## Steps

### Step 1: Pure util `src/app/utils/radarFrames.ts`

Follow the repo's pure-util pattern (see `src/app/utils/coatAdvice.ts`):
immutable, no side effects, validates external data at the boundary.

```ts
export interface RadarFrame {
    host: string;
    path: string;
}

// Never trust external data: returns null unless json has the exact shape
// { host: string, radar: { past: [{ path: string }, ...] } } with a
// non-empty past array. The LAST entry of radar.past is the newest frame.
export function latestRadarFrame(json: unknown): RadarFrame | null

// `${host}${path}/256/{z}/{x}/{y}/2/1_1.png` — literal {z}/{x}/{y}
// placeholders for MapLibre; colour id 2; options 1_1 (smooth + snow).
export function rainViewerTileUrl(frame: RadarFrame): string
```

Implementation notes: use narrow type-guard checks (`typeof`,
`Array.isArray`), not casts. No classes, no state.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Tests `src/app/utils/radarFrames.test.ts`

Vitest, node environment (match `coatAdvice.test.ts` style). Cases:

1. `latestRadarFrame` on a valid two-frame payload → returns the **second**
   (last) frame's `{host, path}`.
2. Empty `radar.past` → null.
3. Missing `radar` key → null. Non-object input (`null`, `"str"`) → null.
4. `past` entry whose `path` is not a string → null.
5. `rainViewerTileUrl({host: 'https://tilecache.rainviewer.com', path: '/v2/radar/abc123'})`
   → exactly `'https://tilecache.rainviewer.com/v2/radar/abc123/256/{z}/{x}/{y}/2/1_1.png'`.

**Verify**: `npm test` → all pass (existing 32 + these).

### Step 3: Rewire `RainOverlayLayer` in `RainViewerBackground.tsx`

Current behavior to preserve: layer/source ids (`rain-layer`/`rain-tiles`),
paint properties, the `styledata` re-add dance, cleanup, the fly-to effect,
the memo comparator. Only the tile *source* selection changes.

1. Add state to `RainOverlayLayer`:
   ```tsx
   const [radarFrame, setRadarFrame] = useState<RadarFrame | null | 'fallback'>(null);
   ```
   `null` = loading; `'fallback'` = use OWM proxy.
2. New effect, keyed on `refreshKey`, fetching the frame index with an
   `AbortController` (same pattern as `LocationSearch.tsx` post-plan-007):
   ```tsx
   useEffect(() => {
       const controller = new AbortController();
       fetch('https://api.rainviewer.com/public/weather-maps.json', { signal: controller.signal })
           .then((res) => {
               if (!res.ok) throw new Error(`RainViewer index HTTP ${res.status}`);
               return res.json();
           })
           .then((json) => {
               const frame = latestRadarFrame(json);
               if (frame === null) throw new Error('RainViewer index malformed or empty');
               setRadarFrame(frame);
           })
           .catch((err) => {
               if (controller.signal.aborted) return;
               console.warn('[RainViewer] frame fetch failed, falling back to OWM tiles:', err);
               setRadarFrame('fallback');
           });
       return () => controller.abort();
   }, [refreshKey]);
   ```
3. In `addRainLayer`: if `radarFrame === null`, return (not ready). Build the
   source from the state:
   - RainViewer: `tiles: [rainViewerTileUrl(radarFrame)]`, `tileSize: 256`,
     **`maxzoom: 7`**, attribution
     `'Weather data © <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>'`.
   - Fallback: the existing `${window.location.origin}/api/rain-tiles/{z}/{x}/{y}?t=${key}`
     with `© OpenWeatherMap` attribution (unchanged).
4. The main layer effect must now also depend on `radarFrame` so the layer is
   (re)added when the frame arrives or changes. When `radarFrame` changes to a
   new frame (new hash path), the existing remove-source/re-add path handles
   the swap — make sure the "skip if same key" guard doesn't block a frame
   change: include the frame path in the guard (e.g. track
   `currentTileUrlRef` instead of only `currentRefreshKeyRef`, or compare
   both).
5. Update the file's stale comments (`// Add OpenWeatherMap precipitation
   raster source` → reflect RainViewer + fallback).

**Verify**: `npx tsc --noEmit` → exit 0; `npx eslint src` → 0 warnings
(watch `react-hooks/exhaustive-deps` on the new effect — fix deps properly,
never disable the rule).

### Step 4: Docs

1. `README.md`:
   - APIs Used table: add
     `| **[RainViewer](https://www.rainviewer.com/api.html)** | Precipitation radar overlay | Free, no key, attribution required |`
     and change the OpenWeatherMap row's Purpose to
     `Precipitation overlay (fallback)`.
   - Credits: add `- Radar data by [RainViewer](https://www.rainviewer.com/)`;
     keep the OWM credit, append `(fallback)`.
   - Getting Started: the OWM key is now **optional** — without it the app
     uses RainViewer; the key only matters if RainViewer is unreachable.
     Adjust the sentence about the missing overlay accordingly.
2. `CLAUDE.md` Environment section: mark `OWM_API_KEY` optional (fallback
   tiles only; primary radar is keyless RainViewer).
3. `.env.example`: update the comment to say the key is optional and only
   used for the fallback overlay. Keep the placeholder line.

**Verify**: `grep -ni rainviewer README.md CLAUDE.md` → hits in both;
no real secret value anywhere in the diff.

### Step 5: Full gate + dev smoke

1. `npx tsc --noEmit && npx eslint src && npm test && npm run build` — all
   exit 0.
2. `npm run dev`; open http://localhost:3000:
   - Network tab: radar tiles load from `tilecache.rainviewer.com`; **zero**
     requests to `/api/rain-tiles`.
   - The overlay renders (multi-colour where there is rain; if your area is
     dry, pan is disabled — check the Network tab for 200s instead).
   - Console: no errors; no `[RainViewer]` warning.
   - Toggle the theme button: overlay survives the style swap (styledata
     re-add works).
3. Fallback drill: in DevTools, block the URL pattern
   `api.rainviewer.com` (Network request blocking), reload:
   - Console shows the `[RainViewer] frame fetch failed…` warning.
   - Tiles now request `/api/rain-tiles/...` (they may 500 locally without
     the env key — the *request path* switching is what's being verified).

**Verify**: all observations above; screenshot not required, report what you saw.

## Test plan

Step 2's unit cases for the boundary validation + URL builder. The layer
lifecycle is verified behaviorally in Step 5 (no jsdom in this repo's test
setup, per plan 004).

## Done criteria

- [ ] `npm test` — all pass, including ≥5 new radarFrames cases
- [ ] `npx tsc --noEmit`, `npx eslint src` (0 warnings), `npm run build` — exit 0
- [ ] `grep -n "maxzoom: 7" src/app/components/RainViewerBackground.tsx` → match
- [ ] `grep -n "api/rain-tiles" src/app/components/RainViewerBackground.tsx` → still present (fallback)
- [ ] `grep -rn "NEXT_PUBLIC_OWM" src` → no matches (must not regress plan 006)
- [ ] Dev smoke incl. fallback drill observed (Step 5)
- [ ] `git status` clean; only in-scope files in the diff

## STOP conditions

Stop and report back (do not improvise) if:

- The frame-index fetch returns a shape that doesn't match the documented one
  (API changed since planning — report the actual payload structure).
- Preserving the styledata re-add requires restructuring beyond
  `RainOverlayLayer` (e.g. lifting state to page.tsx) — the seam is wrong;
  report it.
- Any gate failure you cannot attribute to your own diff.

## Maintenance notes

- If RainViewer re-enables per-request colour schemes, the palette id in
  `rainViewerTileUrl` (currently `2`, ignored) becomes meaningful — that's
  the knob for palette experiments.
- The 13 past frames in the index are the raw material for a zoom.earth-style
  animation loop (deferred); `latestRadarFrame` would generalize to
  `radarFrames(json): RadarFrame[]`.
- Reviewer: check the addRainLayer guard actually re-adds on frame change
  but still skips redundant re-adds (the old bug class this component had).
