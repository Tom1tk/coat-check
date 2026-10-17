import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/forecast-cambridge.json';
import { buildForecast } from './__fixtures__/buildForecast';
import { parseForecast } from './forecast';
import {
    COAT_ADVICE,
    WindowSummary,
    adviceFor,
    commuteWindows,
    currentHourSummary,
    isWet,
    summariseWindow,
    verdictFor,
} from './coatAdvice';
import { COLD_FEELS_LIKE_C, COMMUTE, LAYER_FEELS_LIKE_C, UMBRELLA_MAX_GUST_MPH, WET } from '../config';

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
        const w = summariseWindow(f, MONDAY, '20:00', '02:00', 'Day')!;
        expect(w.endsAt).toBe('2026-10-20T02:00');
    });

    it('returns null, not a throw, when the window runs past the forecast', () => {
        const oneDay = buildForecast(MONDAY, { days: 1 });
        expect(summariseWindow(oneDay, MONDAY, '20:00', '02:00', 'Day')).toBeNull();
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

    it('Saturday → the daytime window, 7am–7pm', () => {
        const ws = commuteWindows(f, at('2026-10-24T10:20'));
        expect(ws.map((w) => [w.label, w.startsAt, w.endsAt])).toEqual([['Day', '2026-10-24T07:00', '2026-10-24T19:00']]);
    });

    it('Saturday 19:00 rolls to Sunday daytime', () => {
        expect(commuteWindows(f, at('2026-10-24T19:00'))[0].startsAt).toBe('2026-10-25T07:00');
    });

    it('Friday evening → Saturday daytime (no commute tomorrow)', () => {
        const ws = commuteWindows(f, at('2026-10-23T19:00'));
        expect(ws.map((w) => [w.label, w.startsAt])).toEqual([['Day', '2026-10-24T07:00']]);
    });

    it('Sunday evening → Monday Out and Back', () => {
        const ws = commuteWindows(buildForecast(MONDAY, { days: 8 }), at('2026-10-25T19:30'));
        expect(ws.map((w) => [w.label, w.startsAt])).toEqual([
            ['Out', '2026-10-26T07:30'],
            ['Back', '2026-10-26T17:00'],
        ]);
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

    it('live fixture (Saturday 13:30 BST) → a wet day', () => {
        const live = parseForecast(fixture);
        const ws = commuteWindows(live, new Date('2026-10-17T12:30:00Z'));
        expect(ws).toHaveLength(1);
        expect(ws[0].startsAt).toBe('2026-10-17T07:00');
        expect(ws[0].endsAt).toBe('2026-10-17T19:00');
        expect(ws[0].wet).toBe(true); // 1.3 mm at 15:00
        expect(ws[0].minTemp).toBeLessThanOrEqual(ws[0].maxTemp);
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

// --- verdictFor ------------------------------------------------------------

function win(overrides: Partial<WindowSummary> = {}): WindowSummary {
    const base = {
        label: 'Out' as const,
        start: '07:30',
        end: '09:00',
        startsAt: `${MONDAY}T07:30`,
        endsAt: `${MONDAY}T09:00`,
        minFeelsLike: 18,
        minTemp: 18,
        maxTemp: 18,
        maxProbability: 0,
        totalPrecipitation: 0,
        maxGust: 10,
        dominantCode: 1,
        ...overrides,
    };
    return { ...base, wet: overrides.wet ?? isWet(base) };
}

const back = (o: Partial<WindowSummary> = {}) =>
    win({ label: 'Back', start: '17:00', end: '18:30', startsAt: `${MONDAY}T17:00`, endsAt: `${MONDAY}T18:30`, ...o });
const nowAt = (hh: string, o: Partial<WindowSummary> = {}) =>
    win({ label: 'Now', start: `${hh}:00`, startsAt: `${MONDAY}T${hh}:00`, endsAt: `${MONDAY}T${String(Number(hh) + 1).padStart(2, '0')}:00`, ...o });

describe('verdictFor rules', () => {
    it('coat-on when it is wet now', () => {
        const r = verdictFor(nowAt('06', { totalPrecipitation: 1, dominantCode: 81, maxProbability: 70 }), [win(), back()]);
        expect(r.verdict).toBe('coat-on');
        expect(r.reason).toBe('Now · 70% showers · feels 18°');
    });

    it('coat-on when the Out window has started and is cold', () => {
        const r = verdictFor(nowAt('07'), [win({ minFeelsLike: 6 }), back()]);
        expect(r.verdict).toBe('coat-on');
        expect(r.reason).toBe('Out 7:30am · dry · feels 6°');
    });

    it('coat-in-bag when dry now but Back is wet', () => {
        const r = verdictFor(nowAt('10'), [win(), back({ maxProbability: 70, dominantCode: 80 })]);
        expect(r.verdict).toBe('coat-in-bag');
        expect(r.reason).toBe('Back 5:00pm · 70% light showers · feels 18°');
    });

    it('ignores a window that has already ended', () => {
        const r = verdictFor(nowAt('10'), [win({ totalPrecipitation: 5 }), back()]);
        expect(r.verdict).toBe('no-coat');
    });

    it('light-layer when dry and cool', () => {
        const r = verdictFor(nowAt('06'), [win({ minFeelsLike: 12 }), back()]);
        expect(r.verdict).toBe('light-layer');
        expect(r.reason).toBe('Out 7:30am · dry · feels 12°');
        expect(r.umbrella).toBe(false);
    });

    it('no-coat when dry and warm', () => {
        expect(verdictFor(nowAt('06'), [win(), back()]).verdict).toBe('no-coat');
    });

    it('without a current hour, the first window is "now" (tomorrow card)', () => {
        expect(verdictFor(null, [win({ minFeelsLike: 5 }), back()]).verdict).toBe('coat-on');
        expect(verdictFor(null, [win(), back({ minFeelsLike: 5 })]).verdict).toBe('coat-in-bag');
    });

    it('no-coat with nothing to judge', () => {
        expect(verdictFor(null, [])).toEqual({ verdict: 'no-coat', reason: 'No forecast available', umbrella: false });
    });
});

describe('verdictFor boundaries', () => {
    const verdictOut = (o: Partial<WindowSummary>) => verdictFor(null, [win(o)]).verdict;

    it.each([
        [WET.mm - 0.01, 'no-coat'],
        [WET.mm, 'coat-on'],
    ])('%f mm → %s', (mm, verdict) => {
        expect(verdictOut({ totalPrecipitation: mm })).toBe(verdict);
    });

    it.each([
        [WET.probability - 1, 'no-coat'],
        [WET.probability, 'coat-on'],
    ])('%i%% → %s', (p, verdict) => {
        expect(verdictOut({ maxProbability: p })).toBe(verdict);
    });

    it.each([
        [COLD_FEELS_LIKE_C - 0.1, 'coat-on'],
        [COLD_FEELS_LIKE_C, 'light-layer'],
        [LAYER_FEELS_LIKE_C - 0.1, 'light-layer'],
        [LAYER_FEELS_LIKE_C, 'no-coat'],
    ])('feels %f° → %s', (feels, verdict) => {
        expect(verdictOut({ minFeelsLike: feels })).toBe(verdict);
    });

    it.each([
        [UMBRELLA_MAX_GUST_MPH - 1, true],
        [UMBRELLA_MAX_GUST_MPH, false],
    ])('gust %i mph → umbrella %s', (gust, umbrella) => {
        expect(verdictFor(null, [win({ totalPrecipitation: 1, maxGust: gust })]).umbrella).toBe(umbrella);
    });
});

describe('adviceFor (legacy cards)', () => {
    it.each([
        ['coat-on', COAT_ADVICE.NEEDED],
        ['coat-in-bag', COAT_ADVICE.NEEDED],
        ['light-layer', COAT_ADVICE.RECOMMENDED],
        ['no-coat', COAT_ADVICE.NOT_NEEDED],
    ] as const)('%s → %s', (verdict, advice) => {
        expect(adviceFor(verdict)).toBe(advice);
    });
});
