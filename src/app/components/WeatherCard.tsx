import React from 'react';
import { WeatherData } from '../utils/weatherUtils';
import SpotlightCard from './SpotlightCard';

interface WeatherCardProps {
    weather: WeatherData;
    displayDay: 'today' | 'tomorrow';
    fade: boolean;
    pageVisible: boolean;
    FADE_DURATION: number;
}

export default function WeatherCard({
    weather,
    displayDay,
    fade,
    pageVisible,
    FADE_DURATION,
}: WeatherCardProps) {
    return (
        <SpotlightCard
            className={`glass-panel rounded-2xl p-6 w-full max-w-md text-center text-black mx-auto mb-4 transition-opacity duration-[${FADE_DURATION}ms] ${pageVisible ? (fade ? 'opacity-0' : 'opacity-100') : 'opacity-0'
                }`}
        >
            <p>
                <strong>Morning (8:00am):</strong> {weather.morningCondition},{' '}
                {weather.morningTemp}°C, rain {weather.morningRain}mm
            </p>
            <p>
                <strong>Afternoon (5pm):</strong> {weather.afternoonCondition},{' '}
                {weather.afternoonTemp}°C, rain {weather.afternoonRain}mm
            </p>
            <hr className="my-4" />
            <p className="text-xl font-semibold">
                {weather.coatAdvice} {displayDay}
            </p>
        </SpotlightCard>
    );
}
