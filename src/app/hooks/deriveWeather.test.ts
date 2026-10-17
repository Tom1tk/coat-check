import { describe, it, expect } from 'vitest';
import { deriveCurrentHourWeather, deriveDayWeather } from './useWeather';
import { buildForecast } from '../utils/__fixtures__/buildForecast';
import { COAT_ADVICE } from '../utils/coatAdvice';
import { parseLocal } from '../utils/forecast';

/**
 * A Forecast of `days` days x 24 LOCATION-LOCAL hours (the API shape with
 * `timezone=auto`) from local midnight of `startDate`. Each slot gets a
 * unique temperature (10 + dayIndex + hour * 0.1) so tests can assert
 * exactly which slot was picked. The derivations take the instant
 * explicitly, so the machine's own timezone never enters.
 */
function fixture(startDate: string, utcOffsetSeconds: number, days = 7) {
    const start = parseLocal(startDate).getTime();
    return buildForecast(startDate, {
        days,
        utcOffsetSeconds,
        hour: (stamp) => {
            const elapsedHours = (parseLocal(stamp).getTime() - start) / 3_600_000;
            const d = Math.floor(elapsedHours / 24);
            const h = elapsedHours % 24;
            return { temperature: Number((10 + d + h * 0.1).toFixed(1)) };
        },
    });
}

describe('deriveCurrentHourWeather / deriveDayWeather (characterization)', () => {
    it('happy path: offset-0 location — picks the current hour and correct dates', () => {
        const now = new Date('2026-07-05T10:30:00Z');
        const data = fixture('2026-07-05', 0);

        const current = deriveCurrentHourWeather(data, now);
        expect(current.currentHour).toBe('10:00');
        expect(current.currentTemp).toBe(11.0); // day 0, hour 10
        expect(current.currentRain).toBe(0);
        expect(current.currentCondition).toBe('Mainly clear');
        expect(current.coatAdvice).toBe(COAT_ADVICE.NOT_NEEDED);

        const today = deriveDayWeather(data, 0, now);
        expect(today.morningTemp).toBe(10.8); // day 0, 08:00
        expect(today.afternoonTemp).toBe(11.7); // day 0, 17:00

        const tomorrow = deriveDayWeather(data, 1, now);
        expect(tomorrow.morningTemp).toBe(11.8); // day 1, 08:00
        expect(tomorrow.afternoonTemp).toBe(12.7); // day 1, 17:00
    });

    it('current hour missing from times throws instead of falling back to the midpoint index', () => {
        // 2026-08-01T00:00 is outside the fixture's 2026-07-05..07-11 range.
        const data = fixture('2026-07-05', 0);
        expect(() => deriveCurrentHourWeather(data, new Date('2026-08-01T00:00:00Z'))).toThrow(
            'Current hour 2026-08-01T00:00 not found in forecast data'
        );
    });

    it('deriveDayWeather with a date missing from times throws instead of yielding undefined fields', () => {
        const data = fixture('2026-07-05', 0);
        expect(() => deriveDayWeather(data, 0, new Date('2026-09-01T00:00:00Z'))).toThrow(
            'Forecast data missing for 2026-09-01'
        );
    });

    it('deriveDayWeather uses the location-local date, not the UTC date', () => {
        // 2026-07-06T01:00 UTC is still 2026-07-05 (18:00) at UTC-7.
        const data = fixture('2026-07-05', -25200);
        const today = deriveDayWeather(data, 0, new Date('2026-07-06T01:00:00Z'));
        expect(today.morningTemp).toBe(10.8); // day 0, 08:00
        expect(today.afternoonTemp).toBe(11.7); // day 0, 17:00
    });

    it('location UTC+13 (Auckland-like) is a day ahead of UTC', () => {
        // 2026-07-05T23:00Z is 2026-07-06T12:00 at UTC+13.
        const data = fixture('2026-07-05', 46800);
        const today = deriveDayWeather(data, 0, new Date('2026-07-05T23:00:00Z'));
        expect(today.morningTemp).toBe(11.8); // day 1, 08:00
        expect(today.afternoonTemp).toBe(12.7); // day 1, 17:00
    });

    it('current hour matches the location wall clock', () => {
        const data = fixture('2026-07-05', -25200); // UTC-7
        const current = deriveCurrentHourWeather(data, new Date('2026-07-05T20:15:00Z')); // 13:15 local
        expect(current.currentHour).toBe('13:00');
        expect(current.currentTemp).toBe(11.3); // day 0, hour 13
    });

    it('dayOffset = 1 crossing a month boundary rolls the date over correctly', () => {
        const data = fixture('2026-07-31', 0, 2);
        const tomorrow = deriveDayWeather(data, 1, new Date('2026-07-31T12:00:00Z'));
        expect(data.hourly.time).toContain('2026-08-01T08:00');
        expect(tomorrow.morningTemp).toBe(11.8); // day 1 (2026-08-01), 08:00
        expect(tomorrow.afternoonTemp).toBe(12.7); // day 1 (2026-08-01), 17:00
    });

    it('advice comes from the commute windows, not just the 08:00/17:00 samples', () => {
        // Rain at 18:00 (inside Back 17:00–18:30) but dry at 08:00 and 17:00.
        const data = buildForecast('2026-10-19', {
            hour: (s) => (s === '2026-10-19T18:00' ? { precipitation: 1, code: 61 } : {}),
        });
        const today = deriveDayWeather(data, 0, new Date('2026-10-19T06:00:00Z'));
        expect(today.afternoonRain).toBe(0);
        expect(today.coatAdvice).toBe(COAT_ADVICE.NEEDED);
    });
});
