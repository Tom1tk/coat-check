import React from 'react';
import { CurrentHourWeather } from '../utils/weatherUtils';

interface CurrentWeatherCardProps {
    weather: CurrentHourWeather;
    fade: boolean;
    pageVisible: boolean;
    FADE_DURATION: number;
}

export default function CurrentWeatherCard({
    weather,
    fade,
    pageVisible,
    FADE_DURATION,
}: CurrentWeatherCardProps) {
    return (
        <div
            className={`bg-gray-100/60 shadow-md rounded-2xl p-6 w-full max-w-md text-center text-black mx-auto transition-opacity duration-[${FADE_DURATION}ms] ${pageVisible ? (fade ? 'opacity-0' : 'opacity-100') : 'opacity-0'
                }`}
        >
            <p>
                <strong>Current Hour ({weather.currentHour}):</strong> {weather.currentCondition},{' '}
                {weather.currentTemp}°C, rain {weather.currentRain}mm
            </p>
            <hr className="my-4" />
            <p className="text-xl font-semibold">
                {weather.coatAdvice} right now
            </p>
        </div>
    );
}
