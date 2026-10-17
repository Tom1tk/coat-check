import { useEffect, useState } from 'react';

// Wall-clock time, re-rendered on each minute boundary (and on wake, since
// timers are throttled in hidden tabs).
export function useClock(): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const schedule = () => {
            const current = Date.now();
            setNow(current);
            timer = setTimeout(schedule, 60_000 - (current % 60_000) + 50);
        };
        schedule();
        const onVisible = () => {
            if (document.visibilityState === 'visible') {
                clearTimeout(timer);
                schedule();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    return now;
}
