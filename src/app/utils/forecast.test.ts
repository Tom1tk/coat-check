import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/forecast-cambridge.json';
import { addDays, localStamp, locationNow, parseForecast, parseLocal } from './forecast';

function clone(): Record<string, Record<string, unknown>> {
    return JSON.parse(JSON.stringify(fixture));
}

describe('parseForecast', () => {
    it('parses the live Cambridge fixture', () => {
        const f = parseForecast(fixture);
        expect(f.utcOffsetSeconds).toBe(3600);
        expect(f.hourly.time).toHaveLength(192);
        expect(f.hourly.feelsLike).toHaveLength(192);
        expect(f.minutely15.time).toHaveLength(12);
        expect(f.daily.date).toHaveLength(8);
        expect(f.daily.sunrise[0]).toBe('2026-10-17T07:27');
        expect(f.current.code).toBe(2);
    });

    it('names the field when hourly.time is missing', () => {
        const json = clone();
        delete json.hourly.time;
        expect(() => parseForecast(json)).toThrow('hourly.time');
    });

    it('throws when an hourly array is out of step with its time array', () => {
        const json = clone();
        (json.hourly.temperature_2m as number[]).pop();
        expect(() => parseForecast(json)).toThrow('hourly.temperature_2m has 191 entries, expected 192');
    });

    it('turns null precipitation probability and gusts into 0', () => {
        const json = clone();
        (json.hourly.precipitation_probability as (number | null)[])[5] = null;
        (json.hourly.wind_gusts_10m as (number | null)[])[6] = null;
        const f = parseForecast(json);
        expect(f.hourly.probability[5]).toBe(0);
        expect(f.hourly.gusts[6]).toBe(0);
    });

    it('rejects null in a field that must be present', () => {
        const json = clone();
        (json.hourly.temperature_2m as (number | null)[])[3] = null;
        expect(() => parseForecast(json)).toThrow('hourly.temperature_2m[3] is not a number');
    });

    it('rejects an error payload from the API', () => {
        expect(() => parseForecast({ error: true, reason: 'The service is overloaded' })).toThrow('current');
    });

    it('rejects a non-object', () => {
        expect(() => parseForecast(null)).toThrow('response');
    });
});

describe('location-local time helpers', () => {
    it('locationNow reads as the location wall clock', () => {
        const local = locationNow(3600, Date.parse('2026-10-17T12:34:00Z'));
        expect(localStamp(local)).toBe('2026-10-17T13:34');
    });

    it('parseLocal round-trips an API stamp and a bare date', () => {
        expect(localStamp(parseLocal('2026-10-17T07:27'))).toBe('2026-10-17T07:27');
        expect(localStamp(parseLocal('2026-10-17'))).toBe('2026-10-17T00:00');
    });

    it('addDays crosses month boundaries', () => {
        expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    });
});
