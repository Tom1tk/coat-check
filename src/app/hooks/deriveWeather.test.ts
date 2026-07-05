// Force the process timezone to UTC before any Date is constructed in this
// worker. deriveCurrentHourWeather reads `new Date().getTimezoneOffset()`,
// whose value otherwise depends on the machine running the tests. Setting
// TZ here (ahead of any Date/Intl use) makes that offset deterministically 0
// so the fixtures below behave the same on every machine/CI runner.
process.env.TZ = 'UTC';

import { describe, it, expect, vi, afterEach } from 'vitest';
import { deriveCurrentHourWeather, deriveDayWeather } from './useWeather';

interface OpenMeteoFixture {
    utc_offset_seconds: number;
    hourly: {
        time: string[];
        temperature_2m: number[];
        precipitation: number[];
        weathercode: number[];
    };
}

/**
 * Builds a realistic Open-Meteo `hourly` response: `days` days x 24 hours of
 * LOCATION-LOCAL timestamps (no UTC conversion applied to the strings
 * themselves — this matches the real API shape when the app requests
 * `timezone=auto`), starting at local midnight of `startDate`.
 *
 * Each slot gets a unique, deterministic temperature (10 + dayIndex +
 * hour * 0.1) so tests can assert exactly which slot was picked.
 */
function buildFixture(startDate: string, utcOffsetSeconds: number, days = 7): OpenMeteoFixture {
    const [year, month, day] = startDate.split('-').map(Number);
    const time: string[] = [];
    const temperature_2m: number[] = [];
    const precipitation: number[] = [];
    const weathercode: number[] = [];

    for (let d = 0; d < days; d++) {
        for (let h = 0; h < 24; h++) {
            // Date.UTC handles month/day rollover; used purely as a calendar
            // calculator here, not as a real UTC<->local conversion.
            const wallClock = new Date(Date.UTC(year, month - 1, day + d, h));
            const dateStr = wallClock.toISOString().split('T')[0];
            const hourStr = String(h).padStart(2, '0');
            time.push(`${dateStr}T${hourStr}:00`);
            temperature_2m.push(Number((10 + d + h * 0.1).toFixed(1)));
            precipitation.push(0);
            weathercode.push(1); // Cloudy
        }
    }

    return {
        utc_offset_seconds: utcOffsetSeconds,
        hourly: { time, temperature_2m, precipitation, weathercode },
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe('deriveCurrentHourWeather / deriveDayWeather (characterization)', () => {
    it('happy path: UTC browser clock, offset-0 location — picks the current hour and correct dates', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-05T10:30:00Z'));

        const data = buildFixture('2026-07-05', 0);

        const current = deriveCurrentHourWeather(data);
        expect(current.currentHour).toBe('10:00');
        expect(current.currentTemp).toBe(11.0); // day 0, hour 10
        expect(current.currentRain).toBe(0);
        expect(current.currentCondition).toBe('Cloudy');

        const today = deriveDayWeather(data, 0);
        expect(today.morningTemp).toBe(10.8); // day 0, 08:00
        expect(today.afternoonTemp).toBe(11.7); // day 0, 17:00

        const tomorrow = deriveDayWeather(data, 1);
        expect(tomorrow.morningTemp).toBe(11.8); // day 1, 08:00
        expect(tomorrow.afternoonTemp).toBe(12.7); // day 1, 17:00
    });

    it('current hour missing from times throws instead of falling back to the midpoint index', () => {
        vi.useFakeTimers();
        // Local time computed from this instant (offset 0) is 2026-08-01T00:00,
        // entirely outside the fixture's 2026-07-05..07-11 range, so no entry
        // in `times` matches and indexOf returns -1.
        vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));

        const data = buildFixture('2026-07-05', 0);

        expect(() => deriveCurrentHourWeather(data)).toThrow(
            'Current hour 2026-08-01T00:00 not found in forecast data'
        );
    });

    it('deriveDayWeather with a date missing from times throws instead of yielding undefined numeric fields', () => {
        vi.useFakeTimers();
        // Location-local date (2026-09-01) is outside the fixture's date range,
        // so both the morning and afternoon indexOf lookups return -1.
        vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));

        const data = buildFixture('2026-07-05', 0);

        expect(() => deriveDayWeather(data, 0)).toThrow('Forecast data missing for 2026-09-01');
    });

    it('deriveDayWeather uses the location-local date, not the browser UTC date', () => {
        vi.useFakeTimers();
        // Browser/instant at 2026-07-06T01:00 UTC; location is UTC-7, so it is
        // still 2026-07-05 (18:00) at the location. deriveDayWeather must land
        // on the location's date (day 0), not the UTC date (day 1). This is
        // the exact regression test plan 005 inverts.
        vi.setSystemTime(new Date('2026-07-06T01:00:00Z'));

        const data = buildFixture('2026-07-05', -25200); // UTC-7
        const today = deriveDayWeather(data, 0);

        // day 0 (2026-07-05) values, NOT day 1 (2026-07-06).
        expect(today.morningTemp).toBe(10.8); // day 0, 08:00
        expect(today.afternoonTemp).toBe(11.7); // day 0, 17:00
    });

    it('location UTC+13 (Auckland-like) is a day ahead of a UTC browser', () => {
        vi.useFakeTimers();
        // Instant is 2026-07-05T23:00:00Z. At UTC+13 that is
        // 2026-07-06T12:00 local — already tomorrow relative to UTC's date.
        vi.setSystemTime(new Date('2026-07-05T23:00:00Z'));

        const data = buildFixture('2026-07-05', 46800); // UTC+13
        const today = deriveDayWeather(data, 0);

        // day 1 (2026-07-06) values: the location's "today", one ahead of UTC.
        expect(today.morningTemp).toBe(11.8); // day 1, 08:00
        expect(today.afternoonTemp).toBe(12.7); // day 1, 17:00
    });

    it('current hour matches the location wall clock regardless of what the browser TZ would have been', () => {
        // Structural note: after the fix, `locationNow` is built from
        // `Date.now()` (an absolute instant) plus only the location's UTC
        // offset — the browser/machine's own timezone offset never enters
        // the computation (see `grep -n getTimezoneOffset` returning no
        // matches in useWeather.ts). So there is no "browser in UTC+2" case
        // to construct separately: for a fixed instant, the result is
        // identical no matter what timezone the process/browser is in. This
        // test picks a UTC instant and asserts the UTC-7 location's current
        // hour matches that location's own wall clock at that instant,
        // which is the regression test for the old browser-offset
        // double-count.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-05T20:15:00Z')); // 13:15 at UTC-7

        const data = buildFixture('2026-07-05', -25200); // UTC-7
        const current = deriveCurrentHourWeather(data);

        expect(current.currentHour).toBe('13:00');
        expect(current.currentTemp).toBe(11.3); // day 0, hour 13
    });

    it('dayOffset = 1 crossing a month boundary rolls the date over correctly', () => {
        vi.useFakeTimers();
        // Location-local "now" is 2026-07-31; tomorrow must be 2026-08-01.
        vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));

        // days=2 covers 2026-07-31 (day 0) and 2026-08-01 (day 1) so the
        // rollover date has matching timestamps to look up.
        const data = buildFixture('2026-07-31', 0, 2);

        const tomorrow = deriveDayWeather(data, 1);

        expect(data.hourly.time).toContain('2026-08-01T08:00');
        expect(tomorrow.morningTemp).toBe(11.8); // day 1 (2026-08-01), 08:00
        expect(tomorrow.afternoonTemp).toBe(12.7); // day 1 (2026-08-01), 17:00
    });
});
