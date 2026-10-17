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

// Per 15-minute slot: at or above this counts as rain in the 2-hour nowcast,
// and the intensity bands (mm per 15 min ≈ ¼ of the usual mm/h bands).
export const NOWCAST_RAIN_MM = 0.1;
export const NOWCAST_MODERATE_MM = 0.6;
export const NOWCAST_HEAVY_MM = 2;

// Map zoom levels the kiosk offers (settings sheet, `?zoom=`).
export const ZOOM_LEVELS = [8, 7, 6, 5] as const;
export const DEFAULT_ZOOM = 8;

// Weather moods (plan 017): how many forecast hours the palette looks at
// (just the current one), and the storm and frost thresholds.
export const MOOD_LOOKAHEAD_HOURS = 1;
export const STORM_GUST_MPH = 40;
export const FROST_FEELS_LIKE_C = 2;
