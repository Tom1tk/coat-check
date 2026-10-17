import { useState, useEffect, useCallback, useMemo } from 'react';
import { WeatherData, CurrentHourWeather } from '../utils/weatherUtils';
import { Location } from './useLocation';
import { adviceFor, commuteDay, currentHourSummary, verdictFor } from '../utils/coatAdvice';
import { FORECAST_QUERY, Forecast, addDays, localDate, locationNow, parseForecast } from '../utils/forecast';
import { describeCode } from '../utils/weatherCodes';
import {
    FORECAST_CACHE_KEY,
    locationKey,
    parseForecastCache,
    serializeForecastCache,
} from '../utils/forecastCache';

const pad = (n: number) => String(n).padStart(2, '0');

export function deriveCurrentHourWeather(f: Forecast, now: Date): CurrentHourWeather {
    const local = locationNow(f.utcOffsetSeconds, now.getTime());
    const stamp = `${localDate(local)}T${pad(local.getUTCHours())}:00`;
    const i = f.hourly.time.indexOf(stamp);
    const summary = currentHourSummary(f, now);
    if (i === -1 || summary === null) {
        throw new Error(`Current hour ${stamp} not found in forecast data`);
    }
    return {
        currentTemp: f.hourly.temperature[i],
        currentRain: f.hourly.precipitation[i],
        currentCondition: describeCode(f.hourly.code[i]).label,
        currentHour: `${pad(local.getUTCHours())}:00`,
        coatAdvice: adviceFor(verdictFor(summary, []).verdict),
    };
}

// The legacy day card: 08:00/17:00 samples, advice from the Out/Back windows.
// Today's verdict also weighs the current hour; tomorrow's has none yet.
export function deriveDayWeather(f: Forecast, dayOffset: number, now: Date): WeatherData {
    const date = addDays(localDate(locationNow(f.utcOffsetSeconds, now.getTime())), dayOffset);
    const morning = f.hourly.time.indexOf(`${date}T08:00`);
    const afternoon = f.hourly.time.indexOf(`${date}T17:00`);
    const windows = commuteDay(f, date);
    if (morning === -1 || afternoon === -1 || windows.length < 2) {
        throw new Error(`Forecast data missing for ${date}`);
    }
    const nowSummary = dayOffset === 0 ? currentHourSummary(f, now) : null;
    return {
        morningTemp: f.hourly.temperature[morning],
        afternoonTemp: f.hourly.temperature[afternoon],
        morningRain: f.hourly.precipitation[morning],
        afternoonRain: f.hourly.precipitation[afternoon],
        morningCondition: describeCode(f.hourly.code[morning]).label,
        afternoonCondition: describeCode(f.hourly.code[afternoon]).label,
        coatAdvice: adviceFor(verdictFor(nowSummary, windows).verdict),
    };
}

const FETCH_TIMEOUT_MS = 10_000;

// Resolves to the raw JSON (what the cache stores); callers parse it.
export async function fetchForecast(location: { latitude: number; longitude: number }): Promise<unknown> {
    const { latitude, longitude } = location;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&${FORECAST_QUERY}`,
            { signal: controller.signal }
        );
        if (!res.ok) {
            throw new Error(`Weather API returned ${res.status}`);
        }
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

export interface DerivedWeather {
    todayWeather: WeatherData;
    tomorrowWeather: WeatherData;
    currentHourWeather: CurrentHourWeather;
}

// Null when the forecast no longer covers "now" (e.g. a very old cache).
export function deriveAll(f: Forecast, now: Date): DerivedWeather | null {
    try {
        return {
            currentHourWeather: deriveCurrentHourWeather(f, now),
            todayWeather: deriveDayWeather(f, 0, now),
            tomorrowWeather: deriveDayWeather(f, 1, now),
        };
    } catch (err) {
        console.warn('[Weather] forecast does not cover the current time:', err);
        return null;
    }
}

interface Payload {
    key: string;
    savedAt: number;
    live: boolean; // false = restored from the localStorage cache
    forecast: Forecast;
}

// The cache holds raw JSON and is re-checked on every read: an entry from an
// older app version (different request shape) fails to parse and is dropped.
function readCache(location: Location): Payload | null {
    try {
        const cached = parseForecastCache(localStorage.getItem(FORECAST_CACHE_KEY), location);
        if (!cached) return null;
        return { key: locationKey(location), savedAt: cached.savedAt, live: false, forecast: parseForecast(cached.data) };
    } catch (err) {
        console.warn('[Weather] dropping unreadable forecast cache:', err);
        return null;
    }
}

function writeCache(location: Location, savedAt: number, data: unknown): void {
    try {
        localStorage.setItem(
            FORECAST_CACHE_KEY,
            serializeForecastCache({
                savedAt,
                location: { latitude: location.latitude, longitude: location.longitude },
                data,
            })
        );
    } catch (err) {
        console.warn('[Weather] could not write forecast cache:', err);
    }
}

// Holds the last good forecast (live or cached) and derives the displayed
// weather from it for the current minute. The scheduler calls `fetcher`;
// failures throw so it can back off — nothing here retries or blocks the UI.
// `nowMs` (the minute clock) re-derives the cards without a refetch.
export function useWeather(location: Location, nowMs: number) {
    const key = locationKey(location);
    const [payload, setPayload] = useState<Payload | null>(null);

    // Show the cached forecast for this location immediately (in an effect, not
    // a state initializer, so server and client render the same first frame).
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage isn't readable during SSR
        setPayload(readCache(location));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const fetcher = useCallback(async () => {
        const data = await fetchForecast(location);
        const forecast = parseForecast(data);
        if (deriveAll(forecast, new Date()) === null) {
            throw new Error('Forecast response does not cover the current hour');
        }
        const savedAt = Date.now();
        writeCache(location, savedAt, data);
        setPayload({ key: locationKey(location), savedAt, live: true, forecast });
    }, [location]);

    const current = payload?.key === key ? payload : null;
    const derived = useMemo(
        () => (current ? deriveAll(current.forecast, new Date(nowMs)) : null),
        [current, nowMs]
    );

    return {
        forecast: current?.forecast ?? null,
        todayWeather: derived?.todayWeather ?? null,
        tomorrowWeather: derived?.tomorrowWeather ?? null,
        currentHourWeather: derived?.currentHourWeather ?? null,
        fetcher,
        key,
        lastSuccess: current?.savedAt ?? null,
        fromCache: current !== null && !current.live,
    };
}
