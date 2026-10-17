import { describe, it, expect } from 'vitest';
import { parseForecastCache, serializeForecastCache, locationKey } from './forecastCache';

const CAMBRIDGE = { latitude: 52.2053, longitude: 0.1218 };
const entry = { savedAt: 1_800_000_000_000, location: CAMBRIDGE, data: { hourly: {} } };

describe('parseForecastCache', () => {
    it('round-trips an entry for the same location', () => {
        expect(parseForecastCache(serializeForecastCache(entry), CAMBRIDGE)).toEqual(entry);
    });

    it('rejects an entry for a different location', () => {
        expect(
            parseForecastCache(serializeForecastCache(entry), { latitude: 51.5, longitude: -0.12 })
        ).toBeNull();
    });

    it('rejects malformed JSON', () => {
        expect(parseForecastCache('{not json', CAMBRIDGE)).toBeNull();
    });

    it('rejects a missing entry', () => {
        expect(parseForecastCache(null, CAMBRIDGE)).toBeNull();
    });

    it('rejects an entry without a numeric savedAt or with no data', () => {
        expect(parseForecastCache(JSON.stringify({ ...entry, savedAt: 'x' }), CAMBRIDGE)).toBeNull();
        expect(parseForecastCache(JSON.stringify({ ...entry, data: null }), CAMBRIDGE)).toBeNull();
    });
});

describe('locationKey', () => {
    it('is stable for the same coordinates', () => {
        expect(locationKey(CAMBRIDGE)).toBe('52.2053,0.1218');
    });
});
