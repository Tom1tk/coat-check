import { useEffect, useRef } from 'react';

// Auto-set theme based on location time - smart behavior:
// - On initial load: set theme to match isDay
// - On sunrise/sunset transition (isDay changes): auto-switch theme
// - Manual toggle works freely; auto-switch only triggers on actual transitions
// - Unknown (null, no forecast yet) changes nothing; a new location whose
//   day/night differs counts as a transition once its forecast arrives
export function useAutoTheme(isDay: boolean | null, setTheme: (t: string) => void): void {
    // Ref to track if initial auto-theme set has happened to avoid double-fades on load
    const initialThemeSet = useRef(false);
    // Track previous isDay value to detect sunrise/sunset transitions
    const prevIsDay = useRef<boolean | null>(null);

    useEffect(() => {
        if (isDay === null) return;
        if (!initialThemeSet.current) {
            // Initial load: set theme to match current time
            setTheme(isDay ? 'light' : 'dark');
            prevIsDay.current = isDay;
            initialThemeSet.current = true;
        } else if (prevIsDay.current !== null && prevIsDay.current !== isDay) {
            // Sunrise/sunset transition detected: auto-switch theme
            // This respects user's manual override until the next transition
            console.log(`[Theme] Auto-switch: ${prevIsDay.current ? 'sunset' : 'sunrise'} detected`);
            setTheme(isDay ? 'light' : 'dark');
            prevIsDay.current = isDay;
        } else {
            // No transition, just update prevIsDay for tracking (e.g., on wake when time is same)
            prevIsDay.current = isDay;
        }
    }, [isDay, setTheme]);
}
