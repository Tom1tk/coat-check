import { describe, it, expect } from 'vitest';
import { buildForecast, HourValues } from './__fixtures__/buildForecast';
import { isDaytime } from './forecast';
import { advanceMood, getMood, isDarkMood, Mood, MoodState, stableMood } from './mood';

// 2026-10-19 is a Monday; offset 0 so instants read as local time. The
// builder's sun is up 07:00–18:00.
const DAY = '2026-10-19';
const at = (hhmm: string) => new Date(`${DAY}T${hhmm}:00Z`);

// The given values for the 3 hours from 12:00 (and 21:00), mild elsewhere.
const ahead = (values: Partial<HourValues>) =>
    buildForecast(DAY, {
        hour: (s) =>
            (s >= `${DAY}T12:00` && s < `${DAY}T15:00`) || (s >= `${DAY}T21:00` && s < `${DAY}T24:00`)
                ? values
                : {},
    });

describe('getMood', () => {
    it.each<[string, Partial<HourValues>, string, Mood]>([
        ['thunder → storm', { code: 95 }, '12:10', 'storm'],
        ['gusts ≥ 40 mph → storm', { gusts: 40 }, '12:10', 'storm'],
        ['wet code → rain', { code: 61 }, '12:10', 'rain'],
        ['probability → rain', { probability: 60 }, '12:10', 'rain'],
        ['feels-like ≤ 2 °C → frost', { feelsLike: 2 }, '12:10', 'frost'],
        ['dark and quiet → night', {}, '21:10', 'night'],
        ['overcast code → overcast', { code: 3 }, '12:10', 'overcast'],
        ['fog → overcast', { code: 45 }, '12:10', 'overcast'],
        ['partly cloudy → clear', { code: 2 }, '12:10', 'clear'],
        ['mild and sunny → clear', {}, '12:10', 'clear'],
    ])('%s', (_name, values, time, mood) => {
        expect(getMood(ahead(values), at(time))).toBe(mood);
    });

    it('rain at night stays rain', () => {
        expect(getMood(ahead({ code: 63 }), at('21:10'))).toBe('rain');
    });

    it('thunder and frost together → storm', () => {
        expect(getMood(ahead({ code: 95, feelsLike: -1 }), at('12:10'))).toBe('storm');
    });

    it('snow → rain, because snow codes are wet (014) and rain outranks frost', () => {
        expect(getMood(ahead({ code: 71 }), at('12:10'))).toBe('rain');
    });

    it('looks only 3 hours ahead', () => {
        // Rain from 15:00 is beyond the 12:00–14:59 window.
        const later = buildForecast(DAY, { hour: (s) => (s >= `${DAY}T15:00` ? { code: 63 } : {}) });
        expect(getMood(later, at('12:10'))).toBe('clear');
        expect(getMood(later, at('13:10'))).toBe('rain');
    });

    it('outside the forecast falls back on day/night', () => {
        const f = buildForecast(DAY, { days: 1 });
        const t = new Date('2026-11-01T12:00:00Z');
        expect(getMood(f, t)).toBe(isDaytime(f, t) ? 'clear' : 'night');
    });
});

describe('isDarkMood', () => {
    it('rain, storm and night are dark; frost only after sunset', () => {
        expect(isDarkMood('rain', true)).toBe(true);
        expect(isDarkMood('storm', true)).toBe(true);
        expect(isDarkMood('night', false)).toBe(true);
        expect(isDarkMood('frost', true)).toBe(false);
        expect(isDarkMood('frost', false)).toBe(true);
        expect(isDarkMood('clear', true)).toBe(false);
        expect(isDarkMood('overcast', true)).toBe(false);
    });
});

describe('stableMood', () => {
    const start: MoodState = { mood: 'clear', pending: null, count: 0 };
    const feed = (moods: Mood[]) => moods.reduce(stableMood, start).mood;

    it('A→B once stays A', () => expect(feed(['rain'])).toBe('clear'));
    it('A→B→B switches', () => expect(feed(['rain', 'rain'])).toBe('rain'));
    it('A→B→A stays A', () => expect(feed(['rain', 'clear'])).toBe('clear'));
    it('A→B→C→C switches to C', () => expect(feed(['rain', 'storm', 'storm'])).toBe('storm'));
    it('A→B→A→B stays A', () => expect(feed(['rain', 'clear', 'rain'])).toBe('clear'));
});

describe('advanceMood', () => {
    it('settles on the first mood at once', () => {
        expect(advanceMood(null, 'rain', true).state.mood).toBe('rain');
    });

    it('new data needs two updates to change the mood', () => {
        const a = advanceMood(null, 'clear', true);
        const b = advanceMood(a, 'rain', true);
        expect(b.state.mood).toBe('clear');
        expect(advanceMood(b, 'rain', true).state.mood).toBe('rain');
    });

    it('an unconfirmed blip is not applied by later clock ticks', () => {
        const blip = advanceMood(advanceMood(null, 'clear', true), 'rain', true);
        expect(advanceMood(blip, 'rain', false).state.mood).toBe('clear');
    });

    it('the clock alone changes the mood at once (e.g. sunset)', () => {
        const day = advanceMood(null, 'clear', true);
        expect(advanceMood(day, 'night', false).state.mood).toBe('night');
    });
});
