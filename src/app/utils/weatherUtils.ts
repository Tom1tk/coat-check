export interface WeatherData {
    morningTemp: number;
    afternoonTemp: number;
    morningRain: number;
    afternoonRain: number;
    morningCondition: string;
    afternoonCondition: string;
    coatAdvice: string;
}

export interface CurrentHourWeather {
    currentTemp: number;
    currentRain: number;
    currentCondition: string;
    currentHour: string;
    coatAdvice: string;
}

export const codeToCondition = (code: number): string => {
    if ([0].includes(code)) return 'Clear';
    if ([1, 2, 3].includes(code)) return 'Cloudy';
    if ([45, 48].includes(code)) return 'Fog';
    if ([51, 53, 55, 61, 63, 65].includes(code)) return 'Rain';
    return 'Other';
};
