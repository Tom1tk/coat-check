import SunCalc from 'suncalc';
import { useMemo } from 'react';

export interface SunTime {
    sunrise: Date;
    sunset: Date;
    isDay: boolean;
}

export function useSunCalc(latitude: number, longitude: number): SunTime {
    const sunTime = useMemo(() => {
        const now = new Date();
        const times = SunCalc.getTimes(now, latitude, longitude);

        // SunCalc.getTimes returns dates. We compare directly.
        // If now is between sunrise and sunset, it's day.
        const isDay = now >= times.sunrise && now < times.sunset;

        return {
            sunrise: times.sunrise,
            sunset: times.sunset,
            isDay
        };
    }, [latitude, longitude]); // Recalculate if location changes

    return sunTime;
}

// Helper utility to convert lat/lon/zoom to tile coordinates
// Useful for pre-loading tiles
export function latLonToTile(lat: number, lon: number, zoom: number): { x: number, y: number } {
    const x = Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    return { x, y };
}
