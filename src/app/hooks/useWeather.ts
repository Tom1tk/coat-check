import { useState, useEffect, useCallback } from 'react';
import { WeatherData, CurrentHourWeather, codeToCondition } from '../utils/weatherUtils';
import { Location } from './useLocation';

export function useWeather(location: Location) {
    const [todayWeather, setTodayWeather] = useState<WeatherData | null>(null);
    const [tomorrowWeather, setTomorrowWeather] = useState<WeatherData | null>(null);
    const [currentHourWeather, setCurrentHourWeather] = useState<CurrentHourWeather | null>(null);

    const fetchCurrentHourWeather = useCallback(async (): Promise<CurrentHourWeather> => {
        const { latitude, longitude } = location;
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,weathercode&timezone=Europe/London`
        );
        const data = await res.json();

        const now = new Date();
        const currentHour = now.getHours();
        const currentTimeStr = now.toISOString().split('T')[0] + `T${currentHour.toString().padStart(2, '0')}:00`;

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
            currentHour: `${currentHour}:00`,
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

    useEffect(() => {
        const fetchAllWeather = async () => {
            const current = await fetchCurrentHourWeather();
            const today = await fetchWeatherForDay(0);
            const tomorrow = await fetchWeatherForDay(1);
            setCurrentHourWeather(current);
            setTodayWeather(today);
            setTomorrowWeather(tomorrow);
        };
        fetchAllWeather();
    }, [fetchCurrentHourWeather, fetchWeatherForDay]);

    return { todayWeather, tomorrowWeather, currentHourWeather };
}
