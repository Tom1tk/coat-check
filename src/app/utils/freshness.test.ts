import { describe, it, expect } from 'vitest';
import { isDue, freshness, backoffFor, BACKOFF_MS } from './freshness';

const MIN = 60_000;
const NOW = 1_800_000_000_000;

describe('isDue', () => {
    it('is due when the source has never succeeded', () => {
        expect(isDue(NOW, null, null, 0, 5 * MIN)).toBe(true);
    });

    it('is not due when data is younger than max age', () => {
        expect(isDue(NOW, NOW - 1 * MIN, NOW - 1 * MIN, 0, 5 * MIN)).toBe(false);
    });

    it('is due when data is older than max age', () => {
        expect(isDue(NOW, NOW - 6 * MIN, NOW - 6 * MIN, 0, 5 * MIN)).toBe(true);
    });

    it('waits out the 30 s backoff after one failure', () => {
        expect(isDue(NOW, NOW - 10 * MIN, NOW - 10_000, 1, 5 * MIN)).toBe(false);
        expect(isDue(NOW, NOW - 10 * MIN, NOW - 31_000, 1, 5 * MIN)).toBe(true);
    });

    it('backs off even when the source never succeeded', () => {
        expect(isDue(NOW, null, NOW - 10_000, 1, 5 * MIN)).toBe(false);
    });

    it('caps the backoff at 10 minutes beyond the table length', () => {
        expect(backoffFor(50)).toBe(BACKOFF_MS[BACKOFF_MS.length - 1]);
        expect(isDue(NOW, null, NOW - 9 * MIN, 50, 5 * MIN)).toBe(false);
        expect(isDue(NOW, null, NOW - 10 * MIN - 1, 50, 5 * MIN)).toBe(true);
    });
});

describe('freshness', () => {
    const maxAge = 15 * MIN;

    it('is fresh at 1× max age', () => {
        expect(freshness(NOW, NOW - maxAge, maxAge, true)).toBe('fresh');
    });

    it('is stale beyond 2× max age', () => {
        expect(freshness(NOW, NOW - 2.1 * maxAge, maxAge, true)).toBe('stale');
    });

    it('is offline beyond 6× max age', () => {
        expect(freshness(NOW, NOW - 6.1 * maxAge, maxAge, true)).toBe('offline');
    });

    it('is offline when the browser reports offline', () => {
        expect(freshness(NOW, NOW, maxAge, false)).toBe('offline');
    });

    it('is offline when nothing has ever loaded', () => {
        expect(freshness(NOW, null, maxAge, true)).toBe('offline');
    });
});
