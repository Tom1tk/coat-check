import { FROST_FEELS_LIKE_C, MOOD_LOOKAHEAD_HOURS, STORM_GUST_MPH } from '../config';
import { dominant, isWet } from './coatAdvice';
import { Forecast, isDaytime, localDate, locationNow } from './forecast';
import { describeCode } from './weatherCodes';

// The screen's tint follows the current hour's weather (plan 017); whether
// it is the day or night palette follows the sun (isDaytime), not the mood.
export type Mood = 'clear' | 'overcast' | 'rain' | 'frost' | 'storm';

export const MOODS: readonly Mood[] = ['clear', 'overcast', 'rain', 'frost', 'storm'];

const pad = (n: number) => String(n).padStart(2, '0');

interface Slot {
    precipitation: number;
    probability: number;
    code: number;
    feelsLike: number;
    gusts: number;
}

// The hour containing `now` (and any after it, up to MOOD_LOOKAHEAD_HOURS),
// clipped to the forecast.
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

// First matching rule wins: storm, rain, frost, overcast, clear.
export function getMood(f: Forecast, now: Date): Mood {
    const slots = upcomingSlots(f, now);
    if (slots.length === 0) return 'clear';

    if (slots.some((s) => groupOf(s) === 'thunder' || s.gusts >= STORM_GUST_MPH)) return 'storm';
    const wet = slots.some((s) =>
        isWet({ totalPrecipitation: s.precipitation, maxProbability: s.probability, dominantCode: s.code })
    );
    if (wet) return 'rain';
    const frosty = slots.some(
        (s) => s.feelsLike <= FROST_FEELS_LIKE_C || groupOf(s) === 'snow' || groupOf(s) === 'freezing'
    );
    if (frosty) return 'frost';
    return dominant(slots.map((s) => s.code)) >= 3 ? 'overcast' : 'clear';
}

// Every mood has a day and a night palette; the night one runs sunset to sunrise.
export function isNight(f: Forecast, now: Date): boolean {
    return !isDaytime(f, now);
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

export interface MoodTrack {
    state: MoodState;
    // The mood the forecast gave on the last evaluation, before hysteresis.
    raw: Mood;
}

const settled = (mood: Mood): MoodState => ({ mood, pending: null, count: 0 });

// One evaluation of the on-screen mood. New forecast data goes through
// stableMood's hysteresis; when only the clock has moved (rain
// already in the forecast reaching the current hour) and that changes the
// answer, the change is real and applies at once.
export function advanceMood(prev: MoodTrack | null, raw: Mood, newData: boolean): MoodTrack {
    if (prev === null) return { state: settled(raw), raw };
    if (newData) return { state: stableMood(prev.state, raw), raw };
    if (raw === prev.raw) return prev;
    return { state: settled(raw), raw };
}
