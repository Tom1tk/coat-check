import SunCalc from 'suncalc';
import { useMemo } from 'react';

export interface SunTime {
    sunrise: Date;
    sunset: Date;
    isDay: boolean;
}

export function useSunCalc(latitude: number, longitude: number, refreshTrigger?: number): SunTime {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [latitude, longitude, refreshTrigger]); // Recalculate if location changes or refresh triggered

    return sunTime;
}
