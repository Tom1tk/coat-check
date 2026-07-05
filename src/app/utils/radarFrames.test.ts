import { describe, it, expect } from 'vitest';
import { latestRadarFrame, rainViewerTileUrl } from './radarFrames';

describe('latestRadarFrame', () => {
    it('returns the last (newest) frame from a valid two-frame payload', () => {
        const json = {
            version: '2.0',
            host: 'https://tilecache.rainviewer.com',
            radar: {
                past: [
                    { time: 1783284000, path: '/v2/radar/first' },
                    { time: 1783284600, path: '/v2/radar/second' },
                ],
                nowcast: [],
            },
        };

        expect(latestRadarFrame(json)).toEqual({
            host: 'https://tilecache.rainviewer.com',
            path: '/v2/radar/second',
        });
    });

    it('returns null when radar.past is empty', () => {
        const json = {
            host: 'https://tilecache.rainviewer.com',
            radar: { past: [], nowcast: [] },
        };

        expect(latestRadarFrame(json)).toBeNull();
    });

    it('returns null when the radar key is missing', () => {
        const json = { host: 'https://tilecache.rainviewer.com' };

        expect(latestRadarFrame(json)).toBeNull();
    });

    it('returns null for non-object input', () => {
        expect(latestRadarFrame(null)).toBeNull();
        expect(latestRadarFrame('str')).toBeNull();
    });

    it('returns null when a past entry has a non-string path', () => {
        const json = {
            host: 'https://tilecache.rainviewer.com',
            radar: {
                past: [{ time: 1783284600, path: 123 }],
                nowcast: [],
            },
        };

        expect(latestRadarFrame(json)).toBeNull();
    });
});

describe('rainViewerTileUrl', () => {
    it('builds the exact tile URL template with literal {z}/{x}/{y}', () => {
        expect(
            rainViewerTileUrl({
                host: 'https://tilecache.rainviewer.com',
                path: '/v2/radar/abc123',
            })
        ).toBe('https://tilecache.rainviewer.com/v2/radar/abc123/256/{z}/{x}/{y}/2/1_1.png');
    });
});
