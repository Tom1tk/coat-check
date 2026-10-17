import { FROST_FEELS_LIKE_C, MOOD_LOOKAHEAD_HOURS, STORM_GUST_MPH } from '../config';
import { dominant, isWet } from './coatAdvice';
import { Forecast, isDaytime, localDate, locationNow } from './forecast';
import { describeCode } from './weatherCodes';

// The screen's palette follows the next few hours (plan 017).
export type Mood = 'clear' | 'overcast' | 'rain' | 'frost' | 'storm' | 'night';

export const MOODS: readonly Mood[] = ['clear', 'overcast', 'rain', 'frost', 'storm', 'night'];

const pad = (n: number) => String(n).padStart(2, '0');

interface Slot {
    precipitation: number;
    probability: number;
    code: number;
    feelsLike: number;
    gusts: number;
}

// The hour containing `now` and the ones after it, clipped to the forecast.
function upcomingSlots(f: Forecast, now: Date): Slot[] {
    const local = locationNow(f.utcOffsetSeconds, now.getTime());
    const first = f.hourly.time.indexOf(`${localDate(local)}T${pad(local.getUTCHours())}:00`);
    if (first === -1) return [];
    const slots: Slot[] = [];
    for (let i = first; i < Math.min(first + MOOD_LOOKAHEAD_HOURS, f.hourly.time.length); i++) {
        slots.push({
            precipitation: f.hourly.precipitation[i],
            probability: f.hourly.probability[i],
            code: f.hourly.code[i],
            feelsLike: f.hourly.feelsLike[i],
            gusts: f.hourly.gusts[i],
        });
    }
    return slots;
}

const groupOf = (s: Slot) => describeCode(s.code).group;

// First matching rule wins: storm, rain, frost, night, overcast, clear.
export function getMood(f: Forecast, now: Date): Mood {
    const slots = upcomingSlots(f, now);
    const daytime = isDaytime(f, now);
    if (slots.length === 0) return daytime ? 'clear' : 'night';

    if (slots.some((s) => groupOf(s) === 'thunder' || s.gusts >= STORM_GUST_MPH)) return 'storm';
    const wet = slots.some((s) =>
        isWet({ totalPrecipitation: s.precipitation, maxProbability: s.probability, dominantCode: s.code })
    );
    if (wet) return 'rain';
    const frosty = slots.some(
        (s) => s.feelsLike <= FROST_FEELS_LIKE_C || groupOf(s) === 'snow' || groupOf(s) === 'freezing'
    );
    if (frosty) return 'frost';
    if (!daytime) return 'night';
    return dominant(slots.map((s) => s.code)) >= 3 ? 'overcast' : 'clear';
}

// Rain, storm and night are dark palettes; frost turns dark after sunset.
export function isDarkMood(mood: Mood, daytime: boolean): boolean {
    return mood === 'rain' || mood === 'storm' || mood === 'night' || (mood === 'frost' && !daytime);
}

export interface MoodState {
    mood: Mood;
    pending: Mood | null;
    count: number;
}

export const MOOD_CONFIRMATIONS = 2;

// Hysteresis: the mood changes only once the same new mood has been seen on
// MOOD_CONFIRMATIONS consecutive updates, so a single odd forecast hour
// doesn't flash the whole screen.
export function stableMood(prev: MoodState, next: Mood): MoodState {
    if (next === prev.mood) return { mood: prev.mood, pending: null, count: 0 };
    const count = next === prev.pending ? prev.count + 1 : 1;
    if (count >= MOOD_CONFIRMATIONS) return { mood: next, pending: null, count: 0 };
    return { mood: prev.mood, pending: next, count };
}
