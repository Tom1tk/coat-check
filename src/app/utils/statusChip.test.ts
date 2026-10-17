import { describe, it, expect } from 'vitest';
import { chipStatus, ChipInput } from './statusChip';

const MIN = 60_000;
const NOW = 1_800_000_000_000;
const fmt = (ms: number) => `T${(NOW - ms) / MIN}`; // minutes-ago marker

function input(overrides: Partial<ChipInput> = {}): ChipInput {
    return {
        now: NOW,
        online: true,
        forecastLastSuccess: NOW - 5 * MIN,
        forecastFailures: 0,
        forecastMaxAge: 15 * MIN,
        fromCache: false,
        radarFailures: 0,
        formatTime: fmt,
        ...overrides,
    };
}

describe('chipStatus', () => {
    it('is fresh with the update time', () => {
        expect(chipStatus(input())).toEqual({ tone: 'fresh', text: 'Updated T5', radarDown: false });
    });

    it('is stale with minutes ago beyond 2× max age', () => {
        expect(chipStatus(input({ forecastLastSuccess: NOW - 40 * MIN }))).toMatchObject({
            tone: 'stale',
            text: 'Updated 40 min ago',
        });
    });

    it('is offline showing the cached time when the network is down', () => {
        expect(chipStatus(input({ online: false, forecastFailures: 2 }))).toMatchObject({
            tone: 'offline',
            text: 'Offline · showing T5',
        });
    });

    it('is starting from cache before the first live fetch', () => {
        expect(chipStatus(input({ fromCache: true }))).toMatchObject({
            tone: 'starting',
            text: 'Starting · cached T5',
        });
    });

    it('stops claiming to start once the first live fetch has failed', () => {
        expect(chipStatus(input({ fromCache: true, forecastFailures: 1 })).tone).toBe('fresh');
    });

    it('is starting with nothing to show yet', () => {
        expect(chipStatus(input({ forecastLastSuccess: null })).tone).toBe('starting');
    });

    it('flags the radar when its fetches are failing', () => {
        expect(chipStatus(input({ radarFailures: 1 })).radarDown).toBe(true);
    });
});
