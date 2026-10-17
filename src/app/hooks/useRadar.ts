import { useCallback, useRef, useState } from 'react';
import { RadarFrame, radarFrames } from '../utils/radarFrames';

const RAINVIEWER_INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json';
// How long to wait for the RainViewer frame index before counting a failure.
const FRAME_INDEX_TIMEOUT_MS = 8000;
// Re-request the OWM fallback tiles at most this often while RainViewer is down.
const FALLBACK_RESTAMP_MS = 10 * 60_000;

// null = no index fetched yet; frames = the past radar frames, oldest →
// newest; 'fallback' = RainViewer unavailable, use the OWM proxy tiles until
// a later fetch succeeds.
export type RadarSource = RadarFrame[] | 'fallback' | null;

const samePaths = (a: RadarFrame[], b: RadarFrame[]) =>
    a.length === b.length && a.every((f, i) => f.path === b[i].path && f.host === b[i].host);

export function useRadar() {
    const [source, setSource] = useState<RadarSource>(null);
    const [fallbackStamp, setFallbackStamp] = useState(0);
    const sourceRef = useRef<RadarSource>(null);

    const fetcher = useCallback(async () => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FRAME_INDEX_TIMEOUT_MS);
        try {
            const res = await fetch(RAINVIEWER_INDEX_URL, { signal: controller.signal });
            if (!res.ok) throw new Error(`RainViewer index HTTP ${res.status}`);
            const frames = radarFrames(await res.json());
            if (frames.length === 0) throw new Error('RainViewer index malformed or empty');

            const prev = sourceRef.current;
            // Keep the same array when the frames haven't changed so the map
            // doesn't re-diff an identical set.
            if (prev === null || prev === 'fallback' || !samePaths(prev, frames)) {
                sourceRef.current = frames;
                setSource(frames);
            }
        } catch (err) {
            // Never leave the map without rain: with no frame yet, switch to
            // the OWM proxy. Older RainViewer frames are kept otherwise.
            if (sourceRef.current === null || sourceRef.current === 'fallback') {
                if (sourceRef.current === null) {
                    sourceRef.current = 'fallback';
                    setSource('fallback');
                }
                setFallbackStamp((prev) => {
                    const now = Date.now();
                    return now - prev >= FALLBACK_RESTAMP_MS ? now : prev;
                });
            }
            throw err;
        } finally {
            clearTimeout(timer);
        }
    }, []);

    return { source, fallbackStamp, fetcher };
}
