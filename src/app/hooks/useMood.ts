import { useEffect, useState } from 'react';
import { Forecast, isDaytime } from '../utils/forecast';
import { advanceMood, getMood, isDarkMood, Mood, MoodTrack } from '../utils/mood';

// Once the first mood is on screen, colour changes crossfade (globals.css);
// the first one applies at once so boot doesn't fade in from the default.
const SETTLE_MS = 1000;

export interface ScreenMood {
    mood: Mood;
    dark: boolean;
}

// The screen's mood for the next 3 hours, re-evaluated on each forecast
// update and each clock tick. Null until there is a forecast.
export function useMood(forecast: Forecast | null, nowMs: number): ScreenMood | null {
    const [seen, setSeen] = useState<{ forecast: Forecast | null; nowMs: number; track: MoodTrack | null }>({
        forecast: null,
        nowMs,
        track: null,
    });

    // Derived during render (no effect round trip): advance on a new forecast
    // or a new minute; forget the mood when the forecast goes away.
    let { track } = seen;
    if (seen.forecast !== forecast || seen.nowMs !== nowMs) {
        track = forecast ? advanceMood(seen.track, getMood(forecast, new Date(nowMs)), seen.forecast !== forecast) : null;
        setSeen({ forecast, nowMs, track });
    }

    const screen = track && forecast
        ? { mood: track.state.mood, dark: isDarkMood(track.state.mood, isDaytime(forecast, new Date(nowMs))) }
        : null;
    useMoodAttributes(screen);
    return screen;
}

// Puts the mood on <html data-mood data-dark>, where the palettes apply.
export function useMoodAttributes(screen: ScreenMood | null): void {
    const mood = screen?.mood;
    const dark = screen?.dark ?? false;

    useEffect(() => {
        const root = document.documentElement;
        if (mood) root.dataset.mood = mood;
        else delete root.dataset.mood;
        root.toggleAttribute('data-dark', dark);
    }, [mood, dark]);

    useEffect(() => {
        if (!mood) return;
        const timer = setTimeout(() => document.documentElement.toggleAttribute('data-mood-settled', true), SETTLE_MS);
        return () => clearTimeout(timer);
    }, [mood]);
}
