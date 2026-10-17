import { useCallback, useRef, useState } from 'react';
import { RadarFrame, latestRadarFrame } from '../utils/radarFrames';

const RAINVIEWER_INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json';
// How long to wait for the RainViewer frame index before counting a failure.
const FRAME_INDEX_TIMEOUT_MS = 8000;
// Re-request the OWM fallback tiles at most this often while RainViewer is down.
const FALLBACK_RESTAMP_MS = 10 * 60_000;

// null = no index fetched yet; 'fallback' = RainViewer unavailable, use the
// OWM proxy tiles until a later fetch succeeds.
export type RadarSource = RadarFrame | 'fallback' | null;

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
            const frame = latestRadarFrame(await res.json());
            if (frame === null) throw new Error('RainViewer index malformed or empty');

            const prev = sourceRef.current;
            // Keep the same object when the frame hasn't changed so the map
            // doesn't tear down and re-add an identical layer.
            if (prev === null || prev === 'fallback' || prev.path !== frame.path || prev.host !== frame.host) {
                sourceRef.current = frame;
                setSource(frame);
            }
        } catch (err) {
            // Never leave the map without rain: with no frame yet, switch to
            // the OWM proxy. An older RainViewer frame is kept otherwise.
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
