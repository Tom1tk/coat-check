export interface WeatherPeriod {
    temp: number;
    rain: number;
    condition: string;
}

export const COAT_ADVICE = {
    NEEDED: 'Bring a coat',
    RECOMMENDED: 'Coat recommended but not necessary',
    NOT_NEEDED: 'No need to bring a coat',
} as const;

export type CoatAdvice = (typeof COAT_ADVICE)[keyof typeof COAT_ADVICE];

// A coat is needed if any period is rainy or below 10°C; recommended if any
// period is 10–15°C and cloudy.
export function getCoatAdvice(periods: WeatherPeriod[]): CoatAdvice {
    if (periods.some((p) => p.rain > 0 || p.temp < 10)) {
        return COAT_ADVICE.NEEDED;
    }
    if (periods.some((p) => p.temp >= 10 && p.temp <= 15 && p.condition === 'Cloudy')) {
        return COAT_ADVICE.RECOMMENDED;
    }
    return COAT_ADVICE.NOT_NEEDED;
}
