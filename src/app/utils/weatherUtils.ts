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
