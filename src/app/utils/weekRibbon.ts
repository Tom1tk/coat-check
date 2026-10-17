import { WindowSummary, summariseWindow, verdictFor } from './coatAdvice';
import { Forecast, localDate, locationNow, parseLocal } from './forecast';

// One column of the bottom ribbon: today + the next 6 days.
export type CoatKind = 'coat' | 'cold' | 'layer' | 'none';
export type WeekendPart = 'start' | 'end' | 'single' | null;

export interface RibbonDay {
    date: string; // "YYYY-MM-DD" location-local
    day: string; // "Today" | "Tue"
    sub: string; // "Mon 19" for today, else "20"
    code: number;
    max: number;
    min: number;
    probability: number;
    precipitation: number;
    wind: number;
    gust: number;
    coat: CoatKind;
    coatLabel: string; // "COAT", "COAT AM", "COLD PM", "LAYER", ""
    weekend: WeekendPart; // Sat+Sun side by side share one tinted block
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RIBBON_DAYS = 7;
const NOON = '12:00';
const RANK: Readonly<Record<CoatKind, number>> = { coat: 3, cold: 2, layer: 1, none: 0 };
const LABEL: Readonly<Record<CoatKind, string>> = { coat: 'COAT', cold: 'COLD', layer: 'LAYER', none: '' };

const weekday = (date: string) => parseLocal(date).getUTCDay();

function kindOf(w: WindowSummary | null): CoatKind {
    if (!w) return 'none';
    const { verdict } = verdictFor(null, [w]);
    if (verdict === 'coat-on') return w.wet ? 'coat' : 'cold';
    return verdict === 'light-layer' ? 'layer' : 'none';
}

// The coat call over the day's daylight, split at noon so a label can say
// which half needs it. Window labels are internal (never shown).
function coatFor(f: Forecast, row: number): { coat: CoatKind; coatLabel: string } {
    const date = f.daily.date[row];
    const rise = f.daily.sunrise[row].slice(11, 16);
    const set = f.daily.sunset[row].slice(11, 16);
    if (rise >= NOON || set <= NOON) {
        const coat = kindOf(summariseWindow(f, date, rise, set, 'Out'));
        return { coat, coatLabel: LABEL[coat] };
    }
    const am = kindOf(summariseWindow(f, date, rise, NOON, 'Out'));
    const pm = kindOf(summariseWindow(f, date, NOON, set, 'Back'));
    const coat = RANK[am] >= RANK[pm] ? am : pm;
    const needsCoat = (k: CoatKind) => RANK[k] >= RANK.cold;
    if (!needsCoat(coat) || (needsCoat(am) && needsCoat(pm))) return { coat, coatLabel: LABEL[coat] };
    return { coat, coatLabel: `${LABEL[coat]} ${needsCoat(am) ? 'AM' : 'PM'}` };
}

function weekendPart(dates: string[], i: number): WeekendPart {
    const d = weekday(dates[i]);
    if (d === 6) return i + 1 < dates.length ? 'start' : 'single';
    if (d === 0) return i > 0 ? 'end' : 'single';
    return null;
}

// Today (location-local) and the following days the forecast covers, up to 7.
export function weekRibbon(f: Forecast, now: Date): RibbonDay[] {
    const today = localDate(locationNow(f.utcOffsetSeconds, now.getTime()));
    const first = f.daily.date.findIndex((d) => d >= today);
    if (first === -1) return [];
    const rows = f.daily.date.slice(first, first + RIBBON_DAYS).map((_, i) => first + i);
    const dates = rows.map((r) => f.daily.date[r]);

    return rows.map((r, i) => {
        const date = f.daily.date[r];
        const name = DAYS[weekday(date)];
        const dayOfMonth = String(Number(date.slice(8, 10)));
        const isToday = date === today;
        return {
            date,
            day: isToday ? 'Today' : name,
            sub: isToday ? `${name} ${dayOfMonth}` : dayOfMonth,
            code: f.daily.code[r],
            max: f.daily.max[r],
            min: f.daily.min[r],
            probability: f.daily.probabilityMax[r],
            precipitation: f.daily.precipitationSum[r],
            wind: f.daily.windMax[r],
            gust: f.daily.gustMax[r],
            ...coatFor(f, r),
            weekend: weekendPart(dates, i),
        };
    });
}
