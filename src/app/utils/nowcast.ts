import { NOWCAST_HEAVY_MM, NOWCAST_MODERATE_MM, NOWCAST_RAIN_MM } from '../config';
import { Forecast, localStamp, locationNow } from './forecast';

export interface NowcastSlot {
    time: string; // "HH:MM" location-local
    mm: number;
}

const SLOTS = 8;
const SLOT_MINUTES = 15;

// 8 × 15-minute slots starting from the one that contains `now`. Fewer (or
// none) when the minutely data doesn't reach that far.
export function nextTwoHours(f: Forecast, now: Date): NowcastSlot[] {
    const local = locationNow(f.utcOffsetSeconds, now.getTime());
    local.setUTCMinutes(Math.floor(local.getUTCMinutes() / SLOT_MINUTES) * SLOT_MINUTES, 0, 0);
    const slotStamp = localStamp(local);

    const first = f.minutely15.time.findIndex((t) => t >= slotStamp);
    if (first === -1) return [];
    return f.minutely15.time.slice(first, first + SLOTS).map((t, i) => ({
        time: t.slice(11, 16),
        mm: f.minutely15.precipitation[first + i],
    }));
}

const isRain = (s: NowcastSlot) => s.mm >= NOWCAST_RAIN_MM;

function intensity(slots: NowcastSlot[]): string {
    const peak = Math.max(...slots.map((s) => s.mm));
    if (peak >= NOWCAST_HEAVY_MM) return 'heavy rain';
    if (peak >= NOWCAST_MODERATE_MM) return 'rain';
    return 'light rain';
}

// One sentence for the "Next 2 hours" card.
export function nowcastSummary(slots: NowcastSlot[]): string {
    if (slots.length === 0) return 'Short-range forecast unavailable';
    const span = slots.length * SLOT_MINUTES;
    const horizon = span === 120 ? 'the next 2 hours' : `the next ${span} min`;

    if (!isRain(slots[0])) {
        const start = slots.findIndex(isRain);
        if (start === -1) return `Dry for ${horizon}`;
        return `Dry for ${start * SLOT_MINUTES} min, then ${intensity(slots.slice(start))}`;
    }

    const stop = slots.findIndex((s) => !isRain(s));
    if (stop === -1) return `${capitalise(intensity(slots))} for ${horizon}`;
    return `Rain easing by ${slots[stop].time}`;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
