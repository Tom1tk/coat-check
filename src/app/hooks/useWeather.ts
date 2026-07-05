import { useState, useEffect, useCallback } from 'react';
import { WeatherData, CurrentHourWeather, codeToCondition } from '../utils/weatherUtils';
import { Location } from './useLocation';
import { getCoatAdvice } from '../utils/coatAdvice';

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

export function useWeather(location: Location) {
    const [todayWeather, setTodayWeather] = useState<WeatherData | null>(null);
    const [tomorrowWeather, setTomorrowWeather] = useState<WeatherData | null>(null);
    const [currentHourWeather, setCurrentHourWeather] = useState<CurrentHourWeather | null>(null);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            const { latitude, longitude } = location;
            // Single API call with timezone=auto for accurate local time calculation
            const res = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,weathercode&timezone=auto`
            );
            if (!res.ok) {
                throw new Error(`Weather API returned ${res.status}`);
            }
            const data = await res.json();

            // Derive all weather states from the single response
            const current = deriveCurrentHourWeather(data);
            const today = deriveDayWeather(data, 0);
            const tomorrow = deriveDayWeather(data, 1);

            setCurrentHourWeather(current);
            setTodayWeather(today);
            setTomorrowWeather(tomorrow);
            setError(null);
        } catch (err) {
            console.error('[Weather] fetch failed:', err);
            setError('Could not load weather data. Check your connection and try again.');
        }
    }, [location]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { todayWeather, tomorrowWeather, currentHourWeather, refresh, error };
}
