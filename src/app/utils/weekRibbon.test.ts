import { describe, it, expect } from 'vitest';
import { buildForecast } from './__fixtures__/buildForecast';
import { weekRibbon } from './weekRibbon';
import { COLD_FEELS_LIKE_C, LAYER_FEELS_LIKE_C, WET } from '../config';

// 2026-10-19 is a Monday; offset 0 so instants read as local time.
const MONDAY = '2026-10-19';
const at = (stamp: string) => new Date(`${stamp}:00Z`);

describe('weekRibbon columns', () => {
    const f = buildForecast(MONDAY, { days: 8 });

    it('is today plus six days, from the location-local date', () => {
        const days = weekRibbon(f, at(`${MONDAY}T10:00`));
        expect(days.map((d) => d.day)).toEqual(['Today', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
        expect(days[0].sub).toBe('Mon 19');
        expect(days[1].sub).toBe('20');
    });

    it('starts from the forecast row for today, not row 0', () => {
        expect(weekRibbon(f, at('2026-10-21T10:00'))[0].date).toBe('2026-10-21');
    });

    it('is shorter when the forecast runs out, and empty when it is all past', () => {
        expect(weekRibbon(f, at('2026-10-24T10:00'))).toHaveLength(3);
        expect(weekRibbon(f, at('2026-11-30T10:00'))).toEqual([]);
    });
});

describe('weekRibbon weekend block', () => {
    it('groups Sat + Sun when both are shown', () => {
        const days = weekRibbon(buildForecast(MONDAY, { days: 7 }), at(`${MONDAY}T10:00`));
        expect(days.map((d) => d.weekend)).toEqual([null, null, null, null, null, 'start', 'end']);
    });

    it('a week that starts on Sunday tints only that Sunday (and a lone Saturday at the end)', () => {
        const days = weekRibbon(buildForecast('2026-10-25', { days: 7 }), at('2026-10-25T10:00'));
        expect(days[0].weekend).toBe('single');
        expect(days.slice(1, 6).every((d) => d.weekend === null)).toBe(true);
        expect(days[6].weekend).toBe('single');
    });

    it('a week that starts on Saturday groups the first two days', () => {
        const days = weekRibbon(buildForecast('2026-10-24', { days: 7 }), at('2026-10-24T10:00'));
        expect(days.map((d) => d.weekend).slice(0, 3)).toEqual(['start', 'end', null]);
    });
});

describe('weekRibbon coat labels (daylight 07:00–18:00)', () => {
    const label = (hour: (s: string) => object) =>
        weekRibbon(buildForecast(MONDAY, { days: 1, hour }), at(`${MONDAY}T06:00`))[0].coatLabel;
    const hourOf = (s: string) => Number(s.slice(11, 13));

    it('mild and dry → no label', () => {
        expect(label(() => ({}))).toBe('');
    });

    it('wet all day → COAT', () => {
        expect(label(() => ({ precipitation: WET.mm }))).toBe('COAT');
    });

    it('wet only in the afternoon → COAT PM', () => {
        expect(label((s) => (hourOf(s) === 15 ? { precipitation: 1 } : {}))).toBe('COAT PM');
    });

    it('cold only in the morning → COLD AM', () => {
        expect(label((s) => (hourOf(s) === 8 ? { feelsLike: COLD_FEELS_LIKE_C - 2 } : {}))).toBe('COLD AM');
    });

    it('cool but not cold → LAYER', () => {
        expect(label(() => ({ feelsLike: LAYER_FEELS_LIKE_C - 1 }))).toBe('LAYER');
    });

    it('ignores rain after sunset', () => {
        expect(label((s) => (hourOf(s) === 21 ? { precipitation: 5 } : {}))).toBe('');
    });
});
