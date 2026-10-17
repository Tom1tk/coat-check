import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/forecast-cambridge.json';
import { buildForecast } from './__fixtures__/buildForecast';
import { parseForecast } from './forecast';
import { commuteWindows, currentHourSummary, summariseWindow } from './coatAdvice';
import { COMMUTE, WET } from '../config';

// 2026-10-19 is a Monday; offset 0 so instants read as local time.
const MONDAY = '2026-10-19';
const at = (stamp: string) => new Date(`${stamp}:00Z`);

describe('summariseWindow', () => {
    const f = buildForecast(MONDAY, {
        hour: (s) => {
            if (s === `${MONDAY}T07:00`) return { feelsLike: 6, gusts: 30 };
            if (s === `${MONDAY}T08:00`) return { feelsLike: 4, probability: 40, code: 3 };
            if (s === `${MONDAY}T09:00`) return { feelsLike: -5, precipitation: 9 }; // outside Out
            if (s === `${MONDAY}T18:00`) return { precipitation: WET.mm, code: 61 };
            return {};
        },
    });

    it('includes the hour containing a half-hour start and excludes the end hour', () => {
        const out = summariseWindow(f, MONDAY, COMMUTE.out.start, COMMUTE.out.end, 'Out')!;
        expect(out.minFeelsLike).toBe(4);
        expect(out.maxGust).toBe(30);
        expect(out.maxProbability).toBe(40);
        expect(out.totalPrecipitation).toBe(0);
        expect(out.wet).toBe(false);
        expect(out.startsAt).toBe(`${MONDAY}T07:30`);
        expect(out.endsAt).toBe(`${MONDAY}T09:00`);
    });

    it('includes the hour containing a half-hour end', () => {
        const back = summariseWindow(f, MONDAY, COMMUTE.back.start, COMMUTE.back.end, 'Back')!;
        expect(back.totalPrecipitation).toBe(WET.mm);
        expect(back.wet).toBe(true);
    });

    it('breaks a dominant-code tie towards the more significant code', () => {
        const back = summariseWindow(f, MONDAY, COMMUTE.back.start, COMMUTE.back.end, 'Back')!;
        expect(back.dominantCode).toBe(61); // 17:00 code 1, 18:00 code 61
    });

    it('wraps past midnight when the end is before the start', () => {
        const w = summariseWindow(f, MONDAY, '20:00', '02:00', 'Next 12 h')!;
        expect(w.endsAt).toBe('2026-10-20T02:00');
    });

    it('returns null, not a throw, when the window runs past the forecast', () => {
        const oneDay = buildForecast(MONDAY, { days: 1 });
        expect(summariseWindow(oneDay, MONDAY, '20:00', '02:00', 'Next 12 h')).toBeNull();
        expect(summariseWindow(oneDay, '2026-11-01', '07:30', '09:00', 'Out')).toBeNull();
    });
});

describe('commuteWindows', () => {
    const f = buildForecast(MONDAY, { days: 7 });

    it('weekday morning → today Out and Back', () => {
        const ws = commuteWindows(f, at(`${MONDAY}T06:00`));
        expect(ws.map((w) => [w.label, w.startsAt])).toEqual([
            ['Out', `${MONDAY}T07:30`],
            ['Back', `${MONDAY}T17:00`],
        ]);
    });

    it('weekday mid-afternoon still shows today', () => {
        expect(commuteWindows(f, at(`${MONDAY}T18:29`))[1].startsAt).toBe(`${MONDAY}T17:00`);
    });

    it('weekday 19:00 rolls to tomorrow', () => {
        const ws = commuteWindows(f, at(`${MONDAY}T19:00`));
        expect(ws.map((w) => w.startsAt)).toEqual(['2026-10-20T07:30', '2026-10-20T17:00']);
    });

    it('Saturday → Next 12 h from the current hour', () => {
        const ws = commuteWindows(f, at('2026-10-24T10:20'));
        expect(ws).toHaveLength(1);
        expect(ws[0].label).toBe('Next 12 h');
        expect(ws[0].startsAt).toBe('2026-10-24T10:00');
        expect(ws[0].endsAt).toBe('2026-10-24T22:00');
    });

    it('Friday evening → Next 12 h (no commute tomorrow)', () => {
        expect(commuteWindows(f, at('2026-10-23T19:00'))[0].label).toBe('Next 12 h');
    });

    it('uses the location clock, not UTC', () => {
        // 23:30 UTC Sunday is 00:30 Monday at UTC+1.
        const bst = buildForecast(MONDAY, { utcOffsetSeconds: 3600 });
        expect(commuteWindows(bst, at('2026-10-18T23:30'))[0].label).toBe('Out');
    });

    it('drops windows the forecast does not cover', () => {
        const oneDay = buildForecast(MONDAY, { days: 1 });
        expect(commuteWindows(oneDay, at(`${MONDAY}T19:00`))).toEqual([]);
    });

    it('live fixture (Saturday 13:30 BST) → a wet Next 12 h', () => {
        const live = parseForecast(fixture);
        const ws = commuteWindows(live, new Date('2026-10-17T12:30:00Z'));
        expect(ws).toHaveLength(1);
        expect(ws[0].startsAt).toBe('2026-10-17T13:00');
        expect(ws[0].endsAt).toBe('2026-10-18T01:00');
        expect(ws[0].wet).toBe(true); // 1.3 mm at 15:00
    });
});

describe('currentHourSummary', () => {
    it('is the location-local current hour', () => {
        const f = buildForecast(MONDAY, { hour: (s) => (s === `${MONDAY}T14:00` ? { feelsLike: 3 } : {}) });
        const now = currentHourSummary(f, at(`${MONDAY}T14:59`))!;
        expect(now.label).toBe('Now');
        expect(now.minFeelsLike).toBe(3);
    });
});
