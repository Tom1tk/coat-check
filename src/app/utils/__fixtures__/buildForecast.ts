// Test-only builder: a dry, mild, valid Forecast covering `days` days of
// location-local hours from `startDate`, with per-hour overrides.
import { Forecast, addDays } from '../forecast';

export interface HourValues {
    temperature: number;
    feelsLike: number;
    precipitation: number;
    probability: number;
    code: number;
    wind: number;
    gusts: number;
}

export const MILD: HourValues = {
    temperature: 18,
    feelsLike: 18,
    precipitation: 0,
    probability: 0,
    code: 1,
    wind: 5,
    gusts: 10,
};

export function buildForecast(
    startDate: string,
    options: {
        days?: number;
        utcOffsetSeconds?: number;
        hour?: (stamp: string) => Partial<HourValues>;
        minutely15?: { time: string[]; precipitation: number[] };
    } = {}
): Forecast {
    const { days = 3, utcOffsetSeconds = 0, hour = () => ({}), minutely15 } = options;
    const hourly: Forecast['hourly'] = {
        time: [], temperature: [], feelsLike: [], precipitation: [], probability: [], code: [], wind: [], gusts: [],
    };
    const dates: string[] = [];
    for (let d = 0; d < days; d++) {
        const date = addDays(startDate, d);
        dates.push(date);
        for (let h = 0; h < 24; h++) {
            const stamp = `${date}T${String(h).padStart(2, '0')}:00`;
            const v = { ...MILD, ...hour(stamp) };
            hourly.time.push(stamp);
            hourly.temperature.push(v.temperature);
            hourly.feelsLike.push(v.feelsLike);
            hourly.precipitation.push(v.precipitation);
            hourly.probability.push(v.probability);
            hourly.code.push(v.code);
            hourly.wind.push(v.wind);
            hourly.gusts.push(v.gusts);
        }
    }
    const perDay = <T,>(value: T) => dates.map(() => value);
    return {
        utcOffsetSeconds,
        current: { time: `${startDate}T00:00`, temperature: 18, feelsLike: 18, precipitation: 0, code: 1, wind: 5, gusts: 10 },
        minutely15: minutely15 ?? { time: [], precipitation: [] },
        hourly,
        daily: {
            date: dates,
            code: perDay(1),
            max: perDay(20),
            min: perDay(10),
            precipitationSum: perDay(0),
            probabilityMax: perDay(0),
            windMax: perDay(10),
            gustMax: perDay(20),
            sunrise: dates.map((d) => `${d}T07:00`),
            sunset: dates.map((d) => `${d}T18:00`),
            uvMax: perDay(2),
        },
    };
}
