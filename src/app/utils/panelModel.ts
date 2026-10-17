import { COMMUTE, WET } from '../config';
import { Verdict, WindowSummary, commuteWindows, currentHourSummary, verdictFor } from './coatAdvice';
import { range12 } from './twelveHour';
import { Forecast, localDate, localStamp, localTime, locationNow, parseLocal } from './forecast';
import { describeCode } from './weatherCodes';

// Everything the left panel shows, derived from one forecast and one instant.
// Pure, so the panel components only lay it out.

export type TagKind = 'coat' | 'ok';

export interface PanelCard {
    label: string; // "Out" | "Back" | "Next 12 h"
    range: string; // "7:30–9:00am"
    code: number;
    temp: number;
    feels: number;
    line: string; // "80% · 2.4 mm · gusts 28"
    tag: string; // "Coat on" | "Light layer" | "No coat needed"
    kind: TagKind;
}

export interface RainHour {
    hour: number; // 7..20
    probability: number;
}

export interface PanelModel {
    time: string; // "07:42" location-local
    date: string; // "Monday 19 October"
    mood: string; // current condition, e.g. "Overcast"
    heading: string; // "LEAVING NOW" | "TOMORROW" | "NEXT 12 HOURS"
    verdict: Verdict;
    verdictText: string; // "Coat in bag."
    reason: string;
    umbrella: boolean;
    cards: PanelCard[];
    stats: { temp: number; feels: number; mmNow: number; wind: number; gusts: number };
    change: { time: string; label: string } | null; // "15:00", "rain arrives"
    rain: RainHour[];
    shading: { start: number; end: number }[]; // decimal hours within the strip
}

export const STRIP_START_HOUR = 7;
export const STRIP_END_HOUR = 20; // inclusive
const CHANGE_LOOKAHEAD_HOURS = 12;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const VERDICT_TEXT: Readonly<Record<Verdict, string>> = {
    'coat-on': 'Coat on.',
    'coat-in-bag': 'Coat in bag.',
    'light-layer': 'Light layer.',
    'no-coat': 'No coat.',
};

const TAG: Readonly<Record<Verdict, [string, TagKind]>> = {
    'coat-on': ['Coat on', 'coat'],
    'coat-in-bag': ['Coat on', 'coat'],
    'light-layer': ['Light layer', 'ok'],
    'no-coat': ['No coat needed', 'ok'],
};

const toHours = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h + m / 60;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

function card(w: WindowSummary): PanelCard {
    const [tag, kind] = TAG[verdictFor(null, [w]).verdict];
    return {
        label: w.label,
        range: range12(w.start, w.end),
        code: w.dominantCode,
        temp: Math.round(w.maxTemp),
        feels: Math.round(w.minFeelsLike),
        line: `${w.maxProbability}% · ${round1(w.totalPrecipitation)} mm · gusts ${Math.round(w.maxGust)}`,
        tag,
        kind,
    };
}

function headingFor(windows: WindowSummary[], today: string): string {
    if (windows.length === 0 || windows[0].label === 'Next 12 h') return 'NEXT 12 HOURS';
    return windows[0].startsAt.startsWith(today) ? 'LEAVING NOW' : 'TOMORROW';
}

const hourIsWet = (f: Forecast, i: number) =>
    f.hourly.precipitation[i] >= WET.mm ||
    f.hourly.probability[i] >= WET.probability ||
    describeCode(f.hourly.code[i]).wet;

// The first hour after the current one whose wet/dry state differs from it.
export function nextChange(f: Forecast, now: Date): { time: string; label: string } | null {
    const local = locationNow(f.utcOffsetSeconds, now.getTime());
    local.setUTCMinutes(0, 0, 0);
    const first = f.hourly.time.indexOf(localStamp(local));
    if (first === -1) return null;
    const wetNow = hourIsWet(f, first);
    const last = Math.min(f.hourly.time.length - 1, first + CHANGE_LOOKAHEAD_HOURS);
    for (let i = first + 1; i <= last; i++) {
        if (hourIsWet(f, i) !== wetNow) {
            return { time: f.hourly.time[i].slice(11, 16), label: wetNow ? 'dry from' : 'rain arrives' };
        }
    }
    return null;
}

function rainStrip(f: Forecast, today: string): RainHour[] {
    const hours: RainHour[] = [];
    for (let h = STRIP_START_HOUR; h <= STRIP_END_HOUR; h++) {
        const i = f.hourly.time.indexOf(`${today}T${String(h).padStart(2, '0')}:00`);
        if (i !== -1) hours.push({ hour: h, probability: f.hourly.probability[i] });
    }
    return hours;
}

const isWeekday = (date: string) => {
    const day = parseLocal(date).getUTCDay();
    return day !== 0 && day !== 6;
};

export function panelModel(f: Forecast, now: Date): PanelModel {
    const local = locationNow(f.utcOffsetSeconds, now.getTime());
    const today = localDate(local);
    const windows = commuteWindows(f, now);
    const result = verdictFor(currentHourSummary(f, now), windows);

    return {
        time: localTime(local),
        date: `${DAY_NAMES[local.getUTCDay()]} ${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}`,
        mood: describeCode(f.current.code).label,
        heading: headingFor(windows, today),
        verdict: result.verdict,
        verdictText: VERDICT_TEXT[result.verdict],
        reason: result.umbrella ? `${result.reason} · umbrella OK` : result.reason,
        umbrella: result.umbrella,
        cards: windows.map(card),
        stats: {
            temp: Math.round(f.current.temperature),
            feels: Math.round(f.current.feelsLike),
            mmNow: round1(f.current.precipitation),
            wind: Math.round(f.current.wind),
            gusts: Math.round(f.current.gusts),
        },
        change: nextChange(f, now),
        rain: rainStrip(f, today),
        shading: isWeekday(today)
            ? [COMMUTE.out, COMMUTE.back].map((w) => ({ start: toHours(w.start), end: toHours(w.end) }))
            : [],
    };
}
