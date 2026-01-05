import { useState, useEffect, useCallback } from 'react';
import { WeatherData, CurrentHourWeather, codeToCondition } from '../utils/weatherUtils';
import { Location } from './useLocation';

export function useWeather(location: Location) {
    const [todayWeather, setTodayWeather] = useState<WeatherData | null>(null);
    const [tomorrowWeather, setTomorrowWeather] = useState<WeatherData | null>(null);
    const [currentHourWeather, setCurrentHourWeather] = useState<CurrentHourWeather | null>(null);

    const fetchCurrentHourWeather = useCallback(async (): Promise<CurrentHourWeather> => {
        const { latitude, longitude } = location;
        // Use timezone=auto to get correct local time data, but we also need to know the offset to calculate "now"
        // Actually, open-meteo returns 'utc_offset_seconds'
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,weathercode&timezone=auto`
        );
        const data = await res.json();
        const utcOffsetSeconds = data.utc_offset_seconds;

        // Calculate location's local time "now"
        const nowUTC = new Date().getTime() + (new Date().getTimezoneOffset() * 60000);
        const locationNow = new Date(nowUTC + (utcOffsetSeconds * 1000));

        const currentHour = locationNow.getHours();
        // Construct ISO string for matching: YYYY-MM-DDThh:00
        const currentHourStr = locationNow.toISOString().split('T')[0] + `T${currentHour.toString().padStart(2, '0')}:00`;
        // Note: locationNow.toISOString() might still display in UTC or system zone if we are not careful? 
        // Wait, toISOString() is always UTC. 
        // We constructed 'locationNow' such that its 'UTC' getters return the shifted time? No, 'new Date(timestamp)' creates a date object.
        // If we want the ISO string representation of the *local* time, we should format manually or trick it.
        // Trick: 
        // The `locationNow` object holds the timestamp that *equals* the local time if interpreted as UTC.
        // No, `new Date(utc + offset)`: if offset is +1h, timestamp is +1h. 
        // If I print this Date object, it prints in System Time (e.g. London).
        // Let's rely on matching by index if possible, OR:
        // Open-Meteo `hourly.time` is ISO8601 strings in the requested timezone (e.g. "2023-10-27T14:00").
        // We need to construct this string "YYYY-MM-DDTHH:00" using the components of `locationNow`.
        // BUT `locationNow` components (getHours()) are based on SYSTEM timeZone if we just used `new Date(...)`.

        // Correct approach:
        // 1. Get current UTC time.
        // 2. Add offset to get "Target Time as UTC".
        // 3. Use getUTCHours(), getUTCDate(), etc. to extract the components.
        const targetTimeAsUTC = new Date(nowUTC + (utcOffsetSeconds * 1000));

        const year = targetTimeAsUTC.getUTCFullYear();
        const month = String(targetTimeAsUTC.getUTCMonth() + 1).padStart(2, '0');
        const day = String(targetTimeAsUTC.getUTCDate()).padStart(2, '0');
        const hour = String(targetTimeAsUTC.getUTCHours()).padStart(2, '0');

        const currentTimeStr = `${year}-${month}-${day}T${hour}:00`;

        const times = data.hourly.time;
        const currentIndex = times.indexOf(currentTimeStr);
        // Fallback to middle if not found (shouldn't happen usually)
        const actualIndex = currentIndex !== -1 ? currentIndex : Math.floor(times.length / 2);

        const { temperature_2m, precipitation, weathercode } = data.hourly;
        const currentTemp = temperature_2m[actualIndex];
        const currentRain = precipitation[actualIndex];
        const currentCondition = codeToCondition(weathercode[actualIndex]);

        let coatAdvice = 'No need to bring a coat';
        if (currentRain > 0 || currentTemp < 10) {
            coatAdvice = 'Bring a coat';
        } else if (currentTemp >= 10 && currentTemp <= 15 && currentCondition === 'Cloudy') {
            coatAdvice = 'Coat recommended but not necessary';
        }

        return {
            currentTemp,
            currentRain,
            currentCondition,
            currentHour: `${hour}:00`,
            coatAdvice,
        };
    }, [location]);

    const fetchWeatherForDay = useCallback(async (dayOffset: number): Promise<WeatherData> => {
        const { latitude, longitude } = location;
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,weathercode&timezone=Europe/London`
        );
        const data = await res.json();

        const dateObj = new Date();
        dateObj.setDate(dateObj.getDate() + dayOffset);
        const dateStr = dateObj.toISOString().split('T')[0];

        const times = data.hourly.time;
        const morningIndex = times.indexOf(`${dateStr}T08:00`);
        const afternoonIndex = times.indexOf(`${dateStr}T17:00`);

        const { temperature_2m, precipitation, weathercode } = data.hourly;
        const morningTemp = temperature_2m[morningIndex];
        const afternoonTemp = temperature_2m[afternoonIndex];
        const morningRain = precipitation[morningIndex];
        const afternoonRain = precipitation[afternoonIndex];
        const morningCondition = codeToCondition(weathercode[morningIndex]);
        const afternoonCondition = codeToCondition(weathercode[afternoonIndex]);

        let coatAdvice = 'No need to bring a coat';
        if (morningRain > 0 || afternoonRain > 0 || morningTemp < 10 || afternoonTemp < 10) {
            coatAdvice = 'Bring a coat';
        } else if (
            (morningTemp >= 10 && morningTemp <= 15 && morningCondition === 'Cloudy') ||
            (afternoonTemp >= 10 && afternoonTemp <= 15 && afternoonCondition === 'Cloudy')
        ) {
            coatAdvice = 'Coat recommended but not necessary';
        }

        return {
            morningTemp,
            afternoonTemp,
            morningRain,
            afternoonRain,
            morningCondition,
            afternoonCondition,
            coatAdvice,
        };
    }, [location]);

    const refresh = useCallback(async () => {
        const current = await fetchCurrentHourWeather();
        const today = await fetchWeatherForDay(0);
        const tomorrow = await fetchWeatherForDay(1);
        setCurrentHourWeather(current);
        setTodayWeather(today);
        setTomorrowWeather(tomorrow);
    }, [fetchCurrentHourWeather, fetchWeatherForDay]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { todayWeather, tomorrowWeather, currentHourWeather, refresh };
}
