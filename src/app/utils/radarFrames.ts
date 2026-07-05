export interface RadarFrame {
    host: string;
    path: string;
}

// Never trust external data: returns null unless json has the exact shape
// { host: string, radar: { past: [{ path: string }, ...] } } with a
// non-empty past array. The LAST entry of radar.past is the newest frame.
export function latestRadarFrame(json: unknown): RadarFrame | null {
    if (typeof json !== 'object' || json === null) {
        return null;
    }

    const { host, radar } = json as { host?: unknown; radar?: unknown };

    if (typeof host !== 'string') {
        return null;
    }

    if (typeof radar !== 'object' || radar === null) {
        return null;
    }

    const { past } = radar as { past?: unknown };

    if (!Array.isArray(past) || past.length === 0) {
        return null;
    }

    const lastFrame = past[past.length - 1];

    if (typeof lastFrame !== 'object' || lastFrame === null) {
        return null;
    }

    const { path } = lastFrame as { path?: unknown };

    if (typeof path !== 'string') {
        return null;
    }

    return { host, path };
}

// `${host}${path}/256/{z}/{x}/{y}/2/1_1.png` — literal {z}/{x}/{y}
// placeholders for MapLibre; colour id 2; options 1_1 (smooth + snow).
export function rainViewerTileUrl(frame: RadarFrame): string {
    return `${frame.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
}
