import { describe, it, expect } from 'vitest';
import { BURN_IN_STEP_MS, burnInOffset } from './burnIn';

describe('burnInOffset', () => {
    it('holds still within a 4-minute step', () => {
        expect(burnInOffset(0)).toEqual({ x: 0, y: 0 });
        expect(burnInOffset(BURN_IN_STEP_MS - 1)).toEqual({ x: 0, y: 0 });
    });

    it('walks all nine positions, then repeats', () => {
        const seen = Array.from({ length: 9 }, (_, i) => burnInOffset(i * BURN_IN_STEP_MS));
        expect(new Set(seen.map((p) => `${p.x},${p.y}`)).size).toBe(9);
        expect(burnInOffset(9 * BURN_IN_STEP_MS)).toEqual({ x: 0, y: 0 });
    });

    it('never moves more than 2 px', () => {
        for (let i = 0; i < 50; i++) {
            const { x, y } = burnInOffset(Date.UTC(2026, 9, 17) + i * BURN_IN_STEP_MS);
            expect(Math.max(x, y)).toBeLessThanOrEqual(2);
            expect(Math.min(x, y)).toBeGreaterThanOrEqual(0);
        }
    });
});
