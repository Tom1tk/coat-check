import { useState, useEffect, useCallback, useMemo } from 'react';
import { WeatherData, CurrentHourWeather, codeToCondition } from '../utils/weatherUtils';
import { Location } from './useLocation';
import { getCoatAdvice } from '../utils/coatAdvice';
import {
    FORECAST_CACHE_KEY,
    locationKey,
    parseForecastCache,
    serializeForecastCache,
} from '../utils/forecastCache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenMeteoResponse = any;

// The API returns hourly.time in the location's local time; represent the
// location's "now" as a Date whose getUTC* fields read as location-local.
export function locationNow(utcOffsetSeconds: number): Date {
    return new Date(Date.now() + utcOffsetSeconds * 1000);
}

export function deriveCurrentHourWeather(data: OpenMeteoResponse): CurrentHourWeather {
    const utcOffsetSeconds = data.utc_offset_seconds;

    // Calculate location's local time "now"
    const targetTimeAsUTC = locationNow(utcOffsetSeconds);

    const year = targetTimeAsUTC.getUTCFullYear();
    const month = String(targetTimeAsUTC.getUTCMonth() + 1).padStart(2, '0');
    const day = String(targetTimeAsUTC.getUTCDate()).padStart(2, '0');
    const hour = String(targetTimeAsUTC.getUTCHours()).padStart(2, '0');

    const currentTimeStr = `${year}-${month}-${day}T${hour}:00`;

    const times = data.hourly.time;
    const currentIndex = times.indexOf(currentTimeStr);
    if (currentIndex === -1) {
        throw new Error(`Current hour ${currentTimeStr} not found in forecast data`);
    }

    const { temperature_2m, precipitation, weathercode } = data.hourly;
    const currentTemp = temperature_2m[currentIndex];
    const currentRain = precipitation[currentIndex];
    const currentCondition = codeToCondition(weathercode[currentIndex]);

    const coatAdvice = getCoatAdvice([
        { temp: currentTemp, rain: currentRain, condition: currentCondition },
    ]);

    return {
        currentTemp,
        currentRain,
        currentCondition,
        currentHour: `${hour}:00`,
        coatAdvice,
    };
}

export function deriveDayWeather(data: OpenMeteoResponse, dayOffset: number): WeatherData {
    const dateObj = locationNow(data.utc_offset_seconds);
    dateObj.setUTCDate(dateObj.getUTCDate() + dayOffset);

    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const times = data.hourly.time;
    const morningIndex = times.indexOf(`${dateStr}T08:00`);
    const afternoonIndex = times.indexOf(`${dateStr}T17:00`);
    if (morningIndex === -1 || afternoonIndex === -1) {
        throw new Error(`Forecast data missing for ${dateStr}`);
    }

    const { temperature_2m, precipitation, weathercode } = data.hourly;
    const morningTemp = temperature_2m[morningIndex];
    const afternoonTemp = temperature_2m[afternoonIndex];
    const morningRain = precipitation[morningIndex];
    const afternoonRain = precipitation[afternoonIndex];
    const morningCondition = codeToCondition(weathercode[morningIndex]);
    const afternoonCondition = codeToCondition(weathercode[afternoonIndex]);

    const coatAdvice = getCoatAdvice([
        { temp: morningTemp, rain: morningRain, condition: morningCondition },
        { temp: afternoonTemp, rain: afternoonRain, condition: afternoonCondition },
    ]);

    return {
        morningTemp,
        afternoonTemp,
        morningRain,
        afternoonRain,
        morningCondition,
        afternoonCondition,
        coatAdvice,
    };
}

const FETCH_TIMEOUT_MS = 10_000;

export async function fetchForecast(location: { latitude: number; longitude: number }): Promise<OpenMeteoResponse> {
    const { latitude, longitude } = location;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        // Single API call with timezone=auto for accurate local time calculation
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,weathercode&timezone=auto`,
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

// Null when the payload no longer covers "now" (e.g. a very old cache).
export function deriveAll(data: OpenMeteoResponse): DerivedWeather | null {
    try {
        return {
            currentHourWeather: deriveCurrentHourWeather(data),
            todayWeather: deriveDayWeather(data, 0),
            tomorrowWeather: deriveDayWeather(data, 1),
        };
    } catch (err) {
        console.warn('[Weather] payload does not cover the current time:', err);
        return null;
    }
}

interface Payload {
    key: string;
    savedAt: number;
    live: boolean; // false = restored from the localStorage cache
    data: OpenMeteoResponse;
}

function readCache(location: Location): Payload | null {
    try {
        const cached = parseForecastCache(localStorage.getItem(FORECAST_CACHE_KEY), location);
        return cached && { key: locationKey(location), savedAt: cached.savedAt, live: false, data: cached.data };
    } catch (err) {
        console.warn('[Weather] could not read forecast cache:', err);
        return null;
    }
}

function writeCache(location: Location, savedAt: number, data: OpenMeteoResponse): void {
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

// Holds the last good payload (live or cached) and derives the displayed
// weather from it for the current hour. The scheduler calls `fetcher`;
// failures throw so it can back off — nothing here retries or blocks the UI.
// `hourKey` changes at least hourly so derivation rolls over without a refetch.
export function useWeather(location: Location, hourKey: string) {
    const key = locationKey(location);
    const [payload, setPayload] = useState<Payload | null>(null);

    // Show the cached payload for this location immediately (in an effect, not
    // a state initializer, so server and client render the same first frame).
    useEffect(() => {
        setPayload(readCache(location));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const fetcher = useCallback(async () => {
        const data = await fetchForecast(location);
        if (deriveAll(data) === null) {
            throw new Error('Forecast response does not cover the current hour');
        }
        const savedAt = Date.now();
        writeCache(location, savedAt, data);
        setPayload({ key: locationKey(location), savedAt, live: true, data });
    }, [location]);

    const current = payload?.key === key ? payload : null;
    const derived = useMemo(
        () => (current ? deriveAll(current.data) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [current, hourKey]
    );

    return {
        todayWeather: derived?.todayWeather ?? null,
        tomorrowWeather: derived?.tomorrowWeather ?? null,
        currentHourWeather: derived?.currentHourWeather ?? null,
        fetcher,
        key,
        lastSuccess: current?.savedAt ?? null,
        fromCache: current !== null && !current.live,
    };
}
