// Data-age scheduling: a source is refetched when its last good data is older
// than its max age, not on clock boundaries. Failures back off exponentially.

export type SourceId = 'forecast' | 'radar';

export const MAX_AGE_MS: Record<SourceId, number> = {
    forecast: 15 * 60_000, // Open-Meteo current/minutely_15 update cadence
    radar: 5 * 60_000, // RainViewer publishes a frame every 10 min
};

export const BACKOFF_MS = [30_000, 60_000, 120_000, 240_000, 600_000]; // cap 10 min

// Stale (amber) beyond this many max-ages; offline (red) beyond the second.
export const STALE_FACTOR = 2;
export const OFFLINE_FACTOR = 6;

export function backoffFor(failures: number): number {
    if (failures <= 0) return 0;
    return BACKOFF_MS[Math.min(failures - 1, BACKOFF_MS.length - 1)];
}

export function isDue(
    now: number,
    lastSuccess: number | null,
    lastAttempt: number | null,
    failures: number,
    maxAge: number
): boolean {
    if (failures > 0 && lastAttempt !== null && now - lastAttempt < backoffFor(failures)) {
        return false;
    }
    return lastSuccess === null || now - lastSuccess > maxAge;
}

export type Freshness = 'fresh' | 'stale' | 'offline';

export function freshness(
    now: number,
    lastSuccess: number | null,
    maxAge: number,
    online: boolean
): Freshness {
    if (!online || lastSuccess === null) return 'offline';
    const age = now - lastSuccess;
    if (age > OFFLINE_FACTOR * maxAge) return 'offline';
    if (age > STALE_FACTOR * maxAge) return 'stale';
    return 'fresh';
}
