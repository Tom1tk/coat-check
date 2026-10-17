import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/forecast-cambridge.json';
import { buildForecast } from './__fixtures__/buildForecast';
import { parseForecast } from './forecast';
import { NowcastSlot, nextTwoHours, nowcastSummary } from './nowcast';
import { NOWCAST_HEAVY_MM, NOWCAST_MODERATE_MM, NOWCAST_RAIN_MM } from '../config';

const DAY = '2026-10-19';
const minutes = (from: string, n: number) =>
    Array.from({ length: n }, (_, i) => {
        const d = new Date(`${DAY}T${from}:00Z`);
        d.setUTCMinutes(d.getUTCMinutes() + i * 15);
        return d.toISOString().slice(0, 16);
    });

function slots(mm: number[]): NowcastSlot[] {
    return mm.map((v, i) => ({ time: minutes('13:00', 8)[i].slice(11), mm: v }));
}

describe('nextTwoHours', () => {
    const time = minutes('13:00', 12);
    const f = buildForecast(DAY, { minutely15: { time, precipitation: time.map((_, i) => i / 10) } });

    it('starts from the slot containing now when now falls between slots', () => {
        const s = nextTwoHours(f, new Date(`${DAY}T13:37:00Z`));
        expect(s).toHaveLength(8);
        expect(s[0]).toEqual({ time: '13:30', mm: 0.2 });
        expect(s[7].time).toBe('15:15');
    });

    it('returns fewer slots near the end of the data', () => {
        expect(nextTwoHours(f, new Date(`${DAY}T15:30:00Z`))).toHaveLength(2);
    });

    it('returns nothing once the data is exhausted', () => {
        expect(nextTwoHours(f, new Date(`${DAY}T18:00:00Z`))).toEqual([]);
    });

    it('uses the location clock (live fixture, 13:40 BST)', () => {
        const s = nextTwoHours(parseForecast(fixture), new Date('2026-10-17T12:40:00Z'));
        expect(s[0].time).toBe('13:30');
        expect(s).toHaveLength(8);
    });
});

describe('nowcastSummary', () => {
    const r = NOWCAST_RAIN_MM;

    it('dry throughout', () => {
        expect(nowcastSummary(slots([0, 0, 0, 0, 0, 0, 0, 0]))).toBe('Dry for the next 2 hours');
    });

    it('dry then light rain', () => {
        expect(nowcastSummary(slots([0, 0, r - 0.01, r, r, 0, 0, 0]))).toBe('Dry for 45 min, then light rain');
    });

    it('dry then heavy rain', () => {
        expect(nowcastSummary(slots([0, 0, 0, 0, NOWCAST_HEAVY_MM, 0, 0, 0]))).toBe('Dry for 60 min, then heavy rain');
    });

    it('raining now and easing', () => {
        expect(nowcastSummary(slots([1, NOWCAST_MODERATE_MM, 0, 0, 0, 0, 0, 0]))).toBe('Rain easing by 13:30');
    });

    it('raining throughout', () => {
        expect(nowcastSummary(slots([1, 1, 1, 1, 1, 1, 1, 1]))).toBe('Rain for the next 2 hours');
    });

    it('a short horizon says how long it covers', () => {
        expect(nowcastSummary(slots([0, 0, 0]))).toBe('Dry for the next 45 min');
    });

    it('no data', () => {
        expect(nowcastSummary([])).toBe('Short-range forecast unavailable');
    });

    it('live fixture: dry 13:30–14:00, then rain at 14:15', () => {
        const s = nextTwoHours(parseForecast(fixture), new Date('2026-10-17T12:30:00Z'));
        expect(nowcastSummary(s)).toBe('Dry for 45 min, then light rain');
    });
});
