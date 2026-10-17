export interface RadarFrame {
    host: string;
    path: string;
    time: number; // unix seconds
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

// Never trust external data: every valid entry of radar.past from
// { host: string, radar: { past: [{ path: string, time: number }, ...] } },
// oldest → newest. Malformed entries are skipped; anything else → [].
export function radarFrames(json: unknown): RadarFrame[] {
    if (!isRecord(json) || typeof json.host !== 'string' || !isRecord(json.radar)) return [];
    const { host } = json;
    const { past } = json.radar;
    if (!Array.isArray(past)) return [];
    return past
        .filter(
            (f): f is { path: string; time: number } =>
                isRecord(f) && typeof f.path === 'string' && typeof f.time === 'number' && Number.isFinite(f.time)
        )
        .map(({ path, time }) => ({ host, path, time }))
        .sort((a, b) => a.time - b.time);
}

export function latestRadarFrame(json: unknown): RadarFrame | null {
    return radarFrames(json).at(-1) ?? null;
}

// `${host}${path}/512/{z}/{x}/{y}/2/0_0.png` — literal {z}/{x}/{y}
// placeholders for MapLibre; 512 px tiles; colour id 2; options 0_0 (raw, no
// smoothing, so light showers survive).
export function rainViewerTileUrl(frame: Pick<RadarFrame, 'host' | 'path'>): string {
    return `${frame.host}${frame.path}/512/{z}/{x}/{y}/2/0_0.png`;
}

// Frames to add and remove to go from `prev` to `next`, matched by path.
export function frameDiff(prev: RadarFrame[], next: RadarFrame[]): { add: RadarFrame[]; remove: RadarFrame[] } {
    const prevPaths = new Set(prev.map((f) => f.path));
    const nextPaths = new Set(next.map((f) => f.path));
    return {
        add: next.filter((f) => !prevPaths.has(f.path)),
        remove: prev.filter((f) => !nextPaths.has(f.path)),
    };
}
