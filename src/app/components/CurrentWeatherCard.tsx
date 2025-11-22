import React from 'react';
import { CurrentHourWeather } from '../utils/weatherUtils';
import SpotlightCard from './SpotlightCard';

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
        <SpotlightCard
            className={`glass-panel rounded-2xl p-6 w-full max-w-md text-center text-black mx-auto transition-opacity duration-[${FADE_DURATION}ms] ${pageVisible ? (fade ? 'opacity-0' : 'opacity-100') : 'opacity-0'
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
        </SpotlightCard>
    );
}
