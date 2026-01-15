import { useState, useEffect, useCallback } from 'react';
import { WeatherData, CurrentHourWeather, codeToCondition } from '../utils/weatherUtils';
import { Location } from './useLocation';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenMeteoResponse = any;

function deriveCurrentHourWeather(data: OpenMeteoResponse): CurrentHourWeather {
    const utcOffsetSeconds = data.utc_offset_seconds;

    // Calculate location's local time "now"
    const nowUTC = new Date().getTime() + (new Date().getTimezoneOffset() * 60000);
    const targetTimeAsUTC = new Date(nowUTC + (utcOffsetSeconds * 1000));

    const year = targetTimeAsUTC.getUTCFullYear();
    const month = String(targetTimeAsUTC.getUTCMonth() + 1).padStart(2, '0');
    const day = String(targetTimeAsUTC.getUTCDate()).padStart(2, '0');
    const hour = String(targetTimeAsUTC.getUTCHours()).padStart(2, '0');

    const currentTimeStr = `${year}-${month}-${day}T${hour}:00`;

    const times = data.hourly.time;
    const currentIndex = times.indexOf(currentTimeStr);
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
}

function deriveDayWeather(data: OpenMeteoResponse, dayOffset: number): WeatherData {
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
}

export function useWeather(location: Location) {
    const [todayWeather, setTodayWeather] = useState<WeatherData | null>(null);
    const [tomorrowWeather, setTomorrowWeather] = useState<WeatherData | null>(null);
    const [currentHourWeather, setCurrentHourWeather] = useState<CurrentHourWeather | null>(null);

    const refresh = useCallback(async () => {
        const { latitude, longitude } = location;
        // Single API call with timezone=auto for accurate local time calculation
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,weathercode&timezone=auto`
        );
        const data = await res.json();

        // Derive all weather states from the single response
        const current = deriveCurrentHourWeather(data);
        const today = deriveDayWeather(data, 0);
        const tomorrow = deriveDayWeather(data, 1);

        setCurrentHourWeather(current);
        setTodayWeather(today);
        setTomorrowWeather(tomorrow);
    }, [location.latitude, location.longitude]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { todayWeather, tomorrowWeather, currentHourWeather, refresh };
}
