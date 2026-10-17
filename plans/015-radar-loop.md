# Plan 015: Sharper radar and an animated 2-hour loop

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. The reviewer maintains `plans/README.md` — do
> not edit it.
>
> **Drift check (run first)**: `git log --oneline -1` → on branch
> `advisor/015-radar-loop`, cut from `staging` **after plan 013 merged**.
> `grep -n "radarTick" src/app/components/RainViewerBackground.tsx` → must
> match (013's seam). `grep -n "/256/{z}/{x}/{y}/2/1_1.png"
> src/app/utils/radarFrames.ts` → must match. On mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (rate limit: 100 requests/IP/minute; animation on a kiosk GPU)
- **Depends on**: 013 (scheduler drives `radarTick`)
- **Category**: feature / rain map
- **Planned at**: commit `d7af640`, 2026-10-17
- **Source**: `plans/2026-10-audit.md` §3 (R2, R3)

## Why this matters

One still frame can't tell you whether rain is coming towards you or moving
away. The last 13 frames (2 h) are free and show this. 512 px tiles double the
detail at the z7 cap for the same number of requests, and raw smoothing (`0_0`)
keeps the light showers that `1_1` blurs away.

## Verified facts (2026-10-17, live API)

- `radar.past` has 13 frames 10 min apart; `radar.nowcast` is empty.
- Colour id is ignored (schemes 1/2/4 are byte-identical): keep `/2/`.
- z8 returns a "Zoom Level Not Supported" image → `maxzoom: 7` **must stay**.
- `/512/` tiles work at z7.
- 100 requests/IP/minute. At 1920×1080 with 512 tiles, a frame is ~12 tiles,
  so 13 frames ≈ 156 requests.

## Design (decided — do not re-derive)

```ts
// utils/radarFrames.ts
export function radarFrames(json: unknown): RadarFrame[]      // all valid past frames, oldest→newest, each { host, path, time }
export function rainViewerTileUrl(frame: RadarFrame): string  // `${host}${path}/512/{z}/{x}/{y}/2/0_0.png`
export function frameDiff(prev: RadarFrame[], next: RadarFrame[]): { add: RadarFrame[]; remove: RadarFrame[] }  // by path
// keep latestRadarFrame as radarFrames(json).at(-1) ?? null
```

- **One raster source + layer per frame**: `rain-src-<time>` / `rain-lyr-<time>`,
  `tileSize: 512`, `maxzoom: 7`, `raster-opacity: 0`,
  `raster-opacity-transition: { duration: 0 }`, `raster-fade-duration: 0`.
  Only the visible frame has opacity 0.8. Never call `setTiles`; new frames are
  new sources, so tiles already loaded stay cached.
- **Gradual boot**: add the newest frame at once, then one older frame every
  10 s (13 frames over ~2 min, ≤ ~72 requests/min peak). The loop plays only
  the frames whose source has `isSourceLoaded`.
- **Loop**: 600 ms per frame, 2 s hold on the newest. One `setInterval`,
  cleared on unmount. Pause it while `document.hidden`.
- **Update**: on each `radarTick`, refetch the index → `frameDiff` → add the new
  frame(s), remove those that have aged out.
- **Timestamp chip**: the visible frame's time as "HH:MM" plus "−40 min" /
  "now"; plan 016 positions it beside the legend.
- **Fallback**: the OWM path stays a single static layer (no loop).
- **Reduced motion / kiosk config**: `?radar=still` shows only the newest frame.
  Also honour `prefers-reduced-motion`.

## Commands you will need

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Typecheck | `npx tsc --noEmit` | exit 0              |
| Lint      | `npx eslint src`   | exit 0, 0 warnings  |
| Tests     | `npm test`         | all pass            |
| Build     | `npm run build`    | exit 0              |
| Tile probe | `curl -sI "$(curl -s https://api.rainviewer.com/public/weather-maps.json \| python3 -c 'import sys,json;d=json.load(sys.stdin);print(d["host"]+d["radar"]["past"][-1]["path"]+"/512/7/63/42/2/0_0.png")')"` | `HTTP/2 200`, `image/png` |

## Scope

**In scope**:
- `src/app/utils/radarFrames.ts` + `radarFrames.test.ts`
- `src/app/components/RainViewerBackground.tsx` (multi-frame layers, loop)
- `src/app/components/RadarTimestamp.tsx` (create, small)

**Out of scope**:
- Changing `maxzoom`, or adding a forecast rain overlay (R5 is a separate spike).
- `src/components/ui/map.tsx` (vendored).
- Layout and placement (plan 016).

## Git workflow

Branch `advisor/015-radar-loop` from `staging`. Commit per step. Do NOT push
or open a PR.

## Steps

### Step 1: `radarFrames` / `frameDiff` / 512 + `0_0` URL
Tests: 13-frame fixture → 13 frames in order; malformed entries are skipped,
not fatal; empty past → `[]`; `frameDiff` add/remove by path; the URL string
matches exactly.
**Verify**: `npm test`; run the tile probe → 200.

### Step 2: Multi-frame layers + gradual boot
Replace `addRainLayer` with `ensureFrameLayer(frame)` / `removeFrameLayer(frame)`.
Insert layers beneath labels, as now. Clean up every frame layer on unmount
and on the OWM switch.
**Verify**: dev server; after ~2 min `map.getStyle().layers.filter(l => l.id.startsWith('rain-lyr-')).length` → 13.

### Step 3: The loop + timestamp
**Verify**: the frames visibly advance, with a hold on the newest; with the tab
hidden, the CPU timeline shows no interval work; `?radar=still` → no loop.

### Step 4: Rate-limit drill
DevTools Network, filter `tilecache.rainviewer.com`, cleared cache, reload:
count requests in the first 60 s (**must be < 90**) and the total after 3 min.
Pan the map once: the increase is bounded by visible tiles × loaded frames.
Report the numbers.

### Step 5: Gate
`npx tsc --noEmit && npx eslint src && npm test && npm run build`.

## Done criteria

- [ ] Gate passes; ≥6 new radar tests
- [ ] First-minute tile requests < 90, reported
- [ ] `maxzoom: 7` still present for RainViewer sources
- [ ] No `setTiles` calls; frame sources removed when frames age out (layer count stays ≤ 13 after 30 min)
- [ ] Only in-scope files in the diff

## STOP conditions

- RainViewer returns 429 during the drill → report the count; don't tune by guesswork.
- Frame switching flickers (tiles blank between frames) even with fade 0 → report and fall back to `?radar=still` behaviour as the default.
- The kiosk's GPU (if tested) drops below ~30 fps during the loop.

## Maintenance notes

- If RainViewer restores `nowcast`, `radarFrames` can append those frames with
  a "forecast" flag and a different timestamp style.
- LibreWXR (audit §3) speaks the same API; swapping hosts means changing only
  the index URL.
