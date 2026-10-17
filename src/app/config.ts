// Every coat-rule threshold lives here; tests import these rather than
// hard-coding numbers, so tuning never breaks them.

// Location-local "HH:MM"; start inclusive, end exclusive.
export const COMMUTE = {
    out: { start: '07:30', end: '09:00' },
    back: { start: '17:00', end: '18:30' },
} as const;

export const WEEKEND_LOOKAHEAD_HOURS = 12;

// A window is wet at or above either threshold (or with a wet weather code).
export const WET = { mm: 0.2, probability: 50 } as const;

export const COLD_FEELS_LIKE_C = 10;
export const LAYER_FEELS_LIKE_C = 15;
export const UMBRELLA_MAX_GUST_MPH = 25;
