import { useMemo } from 'react';
import { Forecast, isDaytime } from '../utils/forecast';

// Day/night from the forecast's sunrise/sunset for the location. Null until
// a forecast is available (boot, or right after a location change).
export function useSunCalc(forecast: Forecast | null, nowMs: number): { isDay: boolean | null } {
    return useMemo(
        () => ({ isDay: forecast ? isDaytime(forecast, new Date(nowMs)) : null }),
        [forecast, nowMs]
    );
}
