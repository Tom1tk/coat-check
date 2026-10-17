// The Open-Meteo response the app requests (see FORECAST_QUERY), checked and
// renamed into one typed shape. Times are location-local "YYYY-MM-DDTHH:MM"
// strings because the request uses timezone=auto.

export const FORECAST_QUERY =
    'current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m' +
    '&minutely_15=precipitation&forecast_minutely_15=12' +
    '&hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset,uv_index_max' +
    '&forecast_days=8&timezone=auto&wind_speed_unit=mph';

export interface Forecast {
    utcOffsetSeconds: number;
    current: {
        time: string;
        temperature: number;
        feelsLike: number;
        precipitation: number;
        code: number;
        wind: number;
        gusts: number;
    };
    minutely15: { time: string[]; precipitation: number[] };
    hourly: {
        time: string[];
        temperature: number[];
        feelsLike: number[];
        precipitation: number[];
        probability: number[];
        code: number[];
        wind: number[];
        gusts: number[];
    };
    daily: {
        date: string[];
        code: number[];
        max: number[];
        min: number[];
        precipitationSum: number[];
        probabilityMax: number[];
        windMax: number[];
        gustMax: number[];
        sunrise: string[];
        sunset: string[];
        uvMax: number[];
    };
}

type Obj = Record<string, unknown>;

function obj(value: unknown, field: string): Obj {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error(`Forecast: ${field} is missing or not an object`);
    }
    return value as Obj;
}

function num(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`Forecast: ${field} is not a number`);
    }
    return value;
}

function str(value: unknown, field: string): string {
    if (typeof value !== 'string') throw new Error(`Forecast: ${field} is not a string`);
    return value;
}

function strings(block: Obj, key: string, field: string): string[] {
    const value = block[key];
    if (!Array.isArray(value)) throw new Error(`Forecast: ${field}.${key} is missing or not an array`);
    return value.map((v, i) => str(v, `${field}.${key}[${i}]`));
}

// `nullAsZero` is for fields some models leave out (probability, gusts).
function numbers(block: Obj, key: string, field: string, length: number, nullAsZero = false): number[] {
    const value = block[key];
    if (!Array.isArray(value)) throw new Error(`Forecast: ${field}.${key} is missing or not an array`);
    if (value.length !== length) {
        throw new Error(`Forecast: ${field}.${key} has ${value.length} entries, expected ${length}`);
    }
    return value.map((v, i) => (v === null && nullAsZero ? 0 : num(v, `${field}.${key}[${i}]`)));
}

// Never trust external data: throws a descriptive Error naming the first
// field that is missing, mistyped, or out of step with its time array.
export function parseForecast(json: unknown): Forecast {
    const root = obj(json, 'response');
    const current = obj(root.current, 'current');
    const minutely = obj(root.minutely_15, 'minutely_15');
    const hourly = obj(root.hourly, 'hourly');
    const daily = obj(root.daily, 'daily');

    const minutelyTime = strings(minutely, 'time', 'minutely_15');
    const hourlyTime = strings(hourly, 'time', 'hourly');
    const dailyTime = strings(daily, 'time', 'daily');
    const h = (key: string, nullAsZero = false) => numbers(hourly, key, 'hourly', hourlyTime.length, nullAsZero);
    const d = (key: string, nullAsZero = false) => numbers(daily, key, 'daily', dailyTime.length, nullAsZero);
    const dailyStrings = (key: string) => {
        const value = strings(daily, key, 'daily');
        if (value.length !== dailyTime.length) {
            throw new Error(`Forecast: daily.${key} has ${value.length} entries, expected ${dailyTime.length}`);
        }
        return value;
    };

    return {
        utcOffsetSeconds: num(root.utc_offset_seconds, 'utc_offset_seconds'),
        current: {
            time: str(current.time, 'current.time'),
            temperature: num(current.temperature_2m, 'current.temperature_2m'),
            feelsLike: num(current.apparent_temperature, 'current.apparent_temperature'),
            precipitation: num(current.precipitation, 'current.precipitation'),
            code: num(current.weather_code, 'current.weather_code'),
            wind: num(current.wind_speed_10m, 'current.wind_speed_10m'),
            gusts: current.wind_gusts_10m === null ? 0 : num(current.wind_gusts_10m, 'current.wind_gusts_10m'),
        },
        minutely15: {
            time: minutelyTime,
            precipitation: numbers(minutely, 'precipitation', 'minutely_15', minutelyTime.length),
        },
        hourly: {
            time: hourlyTime,
            temperature: h('temperature_2m'),
            feelsLike: h('apparent_temperature'),
            precipitation: h('precipitation'),
            probability: h('precipitation_probability', true),
            code: h('weather_code'),
            wind: h('wind_speed_10m'),
            gusts: h('wind_gusts_10m', true),
        },
        daily: {
            date: dailyTime,
            code: d('weather_code'),
            max: d('temperature_2m_max'),
            min: d('temperature_2m_min'),
            precipitationSum: d('precipitation_sum'),
            probabilityMax: d('precipitation_probability_max', true),
            windMax: d('wind_speed_10m_max'),
            gustMax: d('wind_gusts_10m_max', true),
            sunrise: dailyStrings('sunrise'),
            sunset: dailyStrings('sunset'),
            uvMax: d('uv_index_max', true),
        },
    };
}

// --- Location-local time ---------------------------------------------------
// A Date whose getUTC* fields read as the location's wall clock.

export function locationNow(utcOffsetSeconds: number, nowMs: number = Date.now()): Date {
    return new Date(nowMs + utcOffsetSeconds * 1000);
}

const pad = (n: number) => String(n).padStart(2, '0');

// "YYYY-MM-DD" of a location-local Date.
export function localDate(local: Date): string {
    return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`;
}

// "HH:MM" of a location-local Date.
export function localTime(local: Date): string {
    return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

// "YYYY-MM-DDTHH:MM" (the API's time format) of a location-local Date.
export function localStamp(local: Date): string {
    return `${localDate(local)}T${localTime(local)}`;
}

// Parses an API time string as a location-local Date (no offset applied).
export function parseLocal(stamp: string): Date {
    return new Date(`${stamp.length === 10 ? `${stamp}T00:00` : stamp}:00Z`);
}

// Adds whole days to a "YYYY-MM-DD" string.
export function addDays(dateISO: string, days: number): string {
    const d = parseLocal(dateISO);
    d.setUTCDate(d.getUTCDate() + days);
    return localDate(d);
}
