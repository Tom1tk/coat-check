// The last good forecast payload, kept in localStorage so a kiosk that boots
// (or loses its network) shows the most recent data instead of nothing.

export const FORECAST_CACHE_KEY = 'forecastCache';

export interface CachedForecast {
    savedAt: number;
    location: { latitude: number; longitude: number };
    data: unknown;
}

export function locationKey(location: { latitude: number; longitude: number }): string {
    return `${location.latitude},${location.longitude}`;
}

export function serializeForecastCache(entry: CachedForecast): string {
    return JSON.stringify(entry);
}

// Never trust stored data: returns null unless `raw` is a cache entry for
// exactly this location.
export function parseForecastCache(
    raw: string | null,
    location: { latitude: number; longitude: number }
): CachedForecast | null {
    if (raw === null) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { savedAt, location: loc, data } = parsed as Partial<CachedForecast>;
    if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null;
    if (typeof loc !== 'object' || loc === null) return null;
    if (loc.latitude !== location.latitude || loc.longitude !== location.longitude) return null;
    if (typeof data !== 'object' || data === null) return null;
    return { savedAt, location: { latitude: loc.latitude, longitude: loc.longitude }, data };
}
