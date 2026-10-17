import { clock12 } from './twelveHour';
import {
    COLD_FEELS_LIKE_C,
    COMMUTE,
    LAYER_FEELS_LIKE_C,
    UMBRELLA_MAX_GUST_MPH,
    WEEKEND_LOOKAHEAD_HOURS,
    WET,
} from '../config';
import { Forecast, addDays, localDate, locationNow } from './forecast';
import { describeCode } from './weatherCodes';

export type WindowLabel = 'Now' | 'Out' | 'Back' | 'Next 12 h';

export interface WindowSummary {
    label: WindowLabel;
    start: string; // "HH:MM" location-local, as configured
    end: string;
    startsAt: string; // "YYYY-MM-DDTHH:MM" location-local
    endsAt: string;
    minFeelsLike: number;
    maxTemp: number;
    maxProbability: number;
    totalPrecipitation: number;
    maxGust: number;
    wet: boolean;
    dominantCode: number;
}

const toMinutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

const pad = (n: number) => String(n).padStart(2, '0');

// Most frequent code; ties go to the higher (more significant) code.
export function dominant(codes: number[]): number {
    const counts = new Map<number, number>();
    for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
    let best = codes[0];
    for (const [code, count] of counts) {
        const bestCount = counts.get(best) ?? 0;
        if (count > bestCount || (count === bestCount && code > best)) best = code;
    }
    return best;
}

export function isWet(w: Pick<WindowSummary, 'totalPrecipitation' | 'maxProbability' | 'dominantCode'>): boolean {
    return (
        w.totalPrecipitation >= WET.mm ||
        w.maxProbability >= WET.probability ||
        describeCode(w.dominantCode).wet
    );
}

// The hourly slots from the hour containing `start` (inclusive) up to `end`
// (exclusive) on `dateISO`; an end at or before the start means the next day.
// Null when any of those hours is outside the forecast.
export function summariseWindow(
    f: Forecast,
    dateISO: string,
    start: string,
    end: string,
    label: WindowLabel
): WindowSummary | null {
    const startHour = Math.floor(toMinutes(start) / 60);
    let endMinutes = toMinutes(end);
    if (endMinutes <= toMinutes(start)) endMinutes += 24 * 60;
    const hours = Math.ceil(endMinutes / 60) - startHour;

    const first = f.hourly.time.indexOf(`${dateISO}T${pad(startHour)}:00`);
    if (first === -1 || first + hours > f.hourly.time.length) return null;

    const range = <T,>(values: T[]) => values.slice(first, first + hours);
    const totalPrecipitation =
        Math.round(range(f.hourly.precipitation).reduce((sum, mm) => sum + mm, 0) * 100) / 100;
    const summary = {
        label,
        start,
        end,
        startsAt: `${dateISO}T${start}`,
        endsAt: `${endMinutes >= 24 * 60 ? addDays(dateISO, 1) : dateISO}T${end}`,
        minFeelsLike: Math.min(...range(f.hourly.feelsLike)),
        maxTemp: Math.max(...range(f.hourly.temperature)),
        maxProbability: Math.max(...range(f.hourly.probability)),
        totalPrecipitation,
        maxGust: Math.max(...range(f.hourly.gusts)),
        dominantCode: dominant(range(f.hourly.code)),
    };
    return { ...summary, wet: isWet(summary) };
}

// The current location-local hour as a one-hour window.
export function currentHourSummary(f: Forecast, now: Date): WindowSummary | null {
    const local = locationNow(f.utcOffsetSeconds, now.getTime());
    const h = local.getUTCHours();
    return summariseWindow(f, localDate(local), `${pad(h)}:00`, `${pad((h + 1) % 24)}:00`, 'Now');
}

const isWeekend = (local: Date) => local.getUTCDay() === 0 || local.getUTCDay() === 6;

function nextHours(f: Forecast, local: Date): WindowSummary[] {
    const h = local.getUTCHours();
    const end = `${pad((h + WEEKEND_LOOKAHEAD_HOURS) % 24)}:00`;
    const w = summariseWindow(f, localDate(local), `${pad(h)}:00`, end, 'Next 12 h');
    return w ? [w] : [];
}

export function commuteDay(f: Forecast, dateISO: string): WindowSummary[] {
    return [
        summariseWindow(f, dateISO, COMMUTE.out.start, COMMUTE.out.end, 'Out'),
        summariseWindow(f, dateISO, COMMUTE.back.start, COMMUTE.back.end, 'Back'),
    ].filter((w): w is WindowSummary => w !== null);
}

// Weekday → today's [Out, Back] until Back ends, then the next day's.
// Sat/Sun — and a Friday evening, whose next day has no commute — → [Next 12 h].
export function commuteWindows(f: Forecast, now: Date): WindowSummary[] {
    const local = locationNow(f.utcOffsetSeconds, now.getTime());
    if (isWeekend(local)) return nextHours(f, local);

    const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();
    if (minutes < toMinutes(COMMUTE.back.end)) return commuteDay(f, localDate(local));

    const tomorrow = new Date(local.getTime() + 24 * 3600_000);
    return isWeekend(tomorrow) ? nextHours(f, local) : commuteDay(f, localDate(tomorrow));
}

// --- Verdicts --------------------------------------------------------------

export type Verdict = 'coat-on' | 'coat-in-bag' | 'light-layer' | 'no-coat';

export interface VerdictResult {
    verdict: Verdict;
    reason: string;
    umbrella: boolean;
}

const isCold = (w: WindowSummary) => w.minFeelsLike < COLD_FEELS_LIKE_C;
const needsCoat = (w: WindowSummary) => w.wet || isCold(w);

function wetWord(w: WindowSummary): string {
    const condition = describeCode(w.dominantCode);
    return condition.wet ? condition.label.toLowerCase() : 'rain';
}

// One short line, e.g. "Back 17:00 · 70% showers · feels 6°".
function reasonFor(w: WindowSummary): string {
    const when = w.label === 'Now' ? 'Now' : `${w.label} ${clock12(w.start)}`;
    const sky = w.wet ? `${w.maxProbability}% ${wetWord(w)}` : 'dry';
    return `${when} · ${sky} · feels ${Math.round(w.minFeelsLike)}°`;
}

const coldest = (ws: WindowSummary[]) =>
    ws.reduce((a, b) => (b.minFeelsLike < a.minFeelsLike ? b : a));

// `now` is the current hour (null for a day that hasn't started, e.g.
// tomorrow's card). A window that starts within the current hour counts as
// "now"; windows that have ended are ignored. Rules, in order:
// coat-on (wet/cold now) → coat-in-bag (wet/cold later) → light-layer
// (coolest feels-like < LAYER) → no-coat.
export function verdictFor(now: WindowSummary | null, windows: WindowSummary[]): VerdictResult {
    const open = now ? windows.filter((w) => w.endsAt > now.startsAt) : windows;
    const startedNow = (w: WindowSummary) => (now ? w.startsAt < now.endsAt : w === open[0]);
    const current = [...(now ? [now] : []), ...open.filter(startedNow)];
    const later = open.filter((w) => !startedNow(w));
    const relevant = [...current, ...later];

    if (relevant.length === 0) {
        return { verdict: 'no-coat', reason: 'No forecast available', umbrella: false };
    }

    const wetOrColdNow = current.find(needsCoat);
    if (wetOrColdNow) {
        return {
            verdict: 'coat-on',
            reason: reasonFor(wetOrColdNow),
            umbrella: wetOrColdNow.wet && wetOrColdNow.maxGust < UMBRELLA_MAX_GUST_MPH,
        };
    }

    const wetOrColdLater = later.find(needsCoat);
    if (wetOrColdLater) {
        return {
            verdict: 'coat-in-bag',
            reason: reasonFor(wetOrColdLater),
            umbrella: wetOrColdLater.wet && wetOrColdLater.maxGust < UMBRELLA_MAX_GUST_MPH,
        };
    }

    const cool = coldest(relevant);
    return {
        verdict: cool.minFeelsLike < LAYER_FEELS_LIKE_C ? 'light-layer' : 'no-coat',
        reason: reasonFor(cool),
        umbrella: false,
    };
}

// --- Legacy adapter (removed by plan 016 with the old cards) ---------------

export const COAT_ADVICE = {
    NEEDED: 'Bring a coat',
    RECOMMENDED: 'Coat recommended but not necessary',
    NOT_NEEDED: 'No need to bring a coat',
} as const;

export type CoatAdvice = (typeof COAT_ADVICE)[keyof typeof COAT_ADVICE];

const ADVICE: Readonly<Record<Verdict, CoatAdvice>> = {
    'coat-on': COAT_ADVICE.NEEDED,
    'coat-in-bag': COAT_ADVICE.NEEDED,
    'light-layer': COAT_ADVICE.RECOMMENDED,
    'no-coat': COAT_ADVICE.NOT_NEEDED,
};

export function adviceFor(verdict: Verdict): CoatAdvice {
    return ADVICE[verdict];
}
