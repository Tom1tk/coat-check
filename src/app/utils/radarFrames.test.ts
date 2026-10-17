import { describe, it, expect } from 'vitest';
import { RadarFrame, frameDiff, latestRadarFrame, radarFrames, rainViewerTileUrl } from './radarFrames';

const HOST = 'https://tilecache.rainviewer.com';
const T0 = 1792233600;

// The live index shape: 13 past frames 10 min apart, empty nowcast.
function index(count = 13) {
    return {
        version: '2.0',
        host: HOST,
        radar: {
            past: Array.from({ length: count }, (_, i) => ({ time: T0 + i * 600, path: `/v2/radar/f${i}` })),
            nowcast: [],
        },
    };
}

const frame = (i: number): RadarFrame => ({ host: HOST, path: `/v2/radar/f${i}`, time: T0 + i * 600 });

describe('radarFrames', () => {
    it('returns all 13 frames oldest → newest', () => {
        const frames = radarFrames(index());
        expect(frames).toHaveLength(13);
        expect(frames[0]).toEqual(frame(0));
        expect(frames[12]).toEqual(frame(12));
        expect(frames.map((f) => f.time)).toEqual([...frames.map((f) => f.time)].sort((a, b) => a - b));
    });

    it('sorts out-of-order entries by time', () => {
        const json = index(3);
        json.radar.past.reverse();
        expect(radarFrames(json).map((f) => f.path)).toEqual(['/v2/radar/f0', '/v2/radar/f1', '/v2/radar/f2']);
    });

    it('skips malformed entries instead of failing', () => {
        const json = { host: HOST, radar: { past: [{ time: T0, path: 123 }, null, { path: '/x' }, frame(1)] } };
        expect(radarFrames(json)).toEqual([frame(1)]);
    });

    it('empty past → []', () => {
        expect(radarFrames({ host: HOST, radar: { past: [], nowcast: [] } })).toEqual([]);
    });

    it('missing radar, missing host or non-object input → []', () => {
        expect(radarFrames({ host: HOST })).toEqual([]);
        expect(radarFrames({ radar: { past: [frame(0)] } })).toEqual([]);
        expect(radarFrames(null)).toEqual([]);
        expect(radarFrames('str')).toEqual([]);
    });
});

describe('latestRadarFrame', () => {
    it('is the newest frame, or null', () => {
        expect(latestRadarFrame(index())).toEqual(frame(12));
        expect(latestRadarFrame({ host: HOST, radar: { past: [] } })).toBeNull();
    });
});

describe('frameDiff', () => {
    it('adds the new frame and removes the one that aged out, by path', () => {
        const prev = [frame(0), frame(1), frame(2)];
        const next = [frame(1), frame(2), frame(3)];
        expect(frameDiff(prev, next)).toEqual({ add: [frame(3)], remove: [frame(0)] });
    });

    it('no change → nothing to do', () => {
        const frames = [frame(0), frame(1)];
        expect(frameDiff(frames, [...frames.map((f) => ({ ...f }))])).toEqual({ add: [], remove: [] });
    });

    it('from nothing → add all', () => {
        expect(frameDiff([], [frame(0), frame(1)])).toEqual({ add: [frame(0), frame(1)], remove: [] });
    });
});

describe('rainViewerTileUrl', () => {
    it('builds the exact 512 px, raw-smoothing URL with literal {z}/{x}/{y}', () => {
        expect(rainViewerTileUrl(frame(0))).toBe(`${HOST}/v2/radar/f0/512/{z}/{x}/{y}/2/0_0.png`);
    });
});
