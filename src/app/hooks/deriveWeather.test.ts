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

    it('BUG documented, fixed by plan 005: current hour missing from times falls back to the midpoint index', () => {
        vi.useFakeTimers();
        // Local time computed from this instant (offset 0) is 2026-08-01T00:00,
        // entirely outside the fixture's 2026-07-05..07-11 range, so no entry
        // in `times` matches and indexOf returns -1.
        vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));

        const data = buildFixture('2026-07-05', 0);
        const midpoint = Math.floor(data.hourly.time.length / 2); // -> day 3, hour 12

        const current = deriveCurrentHourWeather(data);
        expect(current.currentTemp).toBe(data.hourly.temperature_2m[midpoint]);
        expect(current.currentTemp).toBe(14.2);
    });

    it('BUG documented, fixed by plan 005: deriveDayWeather with a date missing from times yields undefined numeric fields', () => {
        vi.useFakeTimers();
        // Browser UTC date (2026-09-01) is outside the fixture's date range,
        // so both the morning and afternoon indexOf lookups return -1.
        vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));

        const data = buildFixture('2026-07-05', 0);
        const today = deriveDayWeather(data, 0);

        expect(today.morningTemp).toBeUndefined();
        expect(today.afternoonTemp).toBeUndefined();
        expect(today.morningRain).toBeUndefined();
        expect(today.afternoonRain).toBeUndefined();
    });

    it('BUG documented, fixed by plan 005: deriveDayWeather uses the browser UTC date, not the location-local date', () => {
        vi.useFakeTimers();
        // Browser at 2026-07-06T01:00 UTC; location is UTC-7, so it is still
        // 2026-07-05 (18:00) at the location. deriveDayWeather nonetheless
        // derives dateStr from the browser's UTC clock, landing on 2026-07-06
        // — the wrong day. This is the exact regression test plan 005 inverts.
        vi.setSystemTime(new Date('2026-07-06T01:00:00Z'));

        const data = buildFixture('2026-07-05', -25200); // UTC-7
        const today = deriveDayWeather(data, 0);

        // day 1 (2026-07-06) values, NOT day 0 (2026-07-05).
        expect(today.morningTemp).toBe(11.8); // day 1, 08:00
        expect(today.afternoonTemp).toBe(12.7); // day 1, 17:00
    });
});
