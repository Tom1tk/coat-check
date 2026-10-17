// Every WMO weather code Open-Meteo emits. `wet` means "precipitation you
// would want a coat for" (rain, showers, snow, freezing, thunder) — the coat
// rules and plan 017's moods read it, so showers (80–82) are not "Other".

export type ConditionGroup =
    | 'clear'
    | 'cloud'
    | 'fog'
    | 'drizzle'
    | 'rain'
    | 'showers'
    | 'snow'
    | 'freezing'
    | 'thunder';

// Mapped to lucide icons in the UI (plan 016), not here.
export type IconKey =
    | 'sun'
    | 'cloud-sun'
    | 'cloud'
    | 'fog'
    | 'drizzle'
    | 'rain'
    | 'showers'
    | 'snow'
    | 'sleet'
    | 'thunder';

export interface Condition {
    label: string;
    icon: IconKey;
    wet: boolean;
    group: ConditionGroup;
}

const c = (label: string, icon: IconKey, group: ConditionGroup, wet: boolean): Condition => ({
    label,
    icon,
    group,
    wet,
});

const CODES: Readonly<Record<number, Condition>> = {
    0: c('Clear sky', 'sun', 'clear', false),
    1: c('Mainly clear', 'sun', 'clear', false),
    2: c('Partly cloudy', 'cloud-sun', 'cloud', false),
    3: c('Overcast', 'cloud', 'cloud', false),
    45: c('Fog', 'fog', 'fog', false),
    48: c('Rime fog', 'fog', 'fog', false),
    51: c('Light drizzle', 'drizzle', 'drizzle', true),
    53: c('Drizzle', 'drizzle', 'drizzle', true),
    55: c('Heavy drizzle', 'drizzle', 'drizzle', true),
    56: c('Light freezing drizzle', 'sleet', 'freezing', true),
    57: c('Freezing drizzle', 'sleet', 'freezing', true),
    61: c('Light rain', 'rain', 'rain', true),
    63: c('Rain', 'rain', 'rain', true),
    65: c('Heavy rain', 'rain', 'rain', true),
    66: c('Light freezing rain', 'sleet', 'freezing', true),
    67: c('Freezing rain', 'sleet', 'freezing', true),
    71: c('Light snow', 'snow', 'snow', true),
    73: c('Snow', 'snow', 'snow', true),
    75: c('Heavy snow', 'snow', 'snow', true),
    77: c('Snow grains', 'snow', 'snow', true),
    80: c('Light showers', 'showers', 'showers', true),
    81: c('Showers', 'showers', 'showers', true),
    82: c('Heavy showers', 'showers', 'showers', true),
    85: c('Snow showers', 'snow', 'snow', true),
    86: c('Heavy snow showers', 'snow', 'snow', true),
    95: c('Thunderstorm', 'thunder', 'thunder', true),
    96: c('Thunderstorm with hail', 'thunder', 'thunder', true),
    99: c('Thunderstorm with heavy hail', 'thunder', 'thunder', true),
};

const UNKNOWN: Condition = c('Unknown', 'cloud', 'cloud', false);

export const KNOWN_CODES: readonly number[] = Object.keys(CODES).map(Number);

export function describeCode(code: number): Condition {
    return CODES[code] ?? UNKNOWN;
}
