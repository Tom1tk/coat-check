import { useEffect, useState } from 'react';

export interface MapPadding {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

const NONE: MapPadding = { top: 0, right: 0, bottom: 0, left: 0 };

const same = (a: MapPadding, b: MapPadding) =>
    a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;

// The map padding that keeps the location centred in the free area: right of
// the panel and above the ribbon. Measured from the elements themselves
// (ResizeObserver + window resize), so it follows any screen size.
export function useMapPadding(panel: HTMLElement | null, ribbon: HTMLElement | null): MapPadding {
    const [padding, setPadding] = useState<MapPadding>(NONE);

    useEffect(() => {
        if (!panel || !ribbon) return;
        const measure = () => {
            const next = {
                top: 0,
                right: 0,
                left: Math.round(panel.getBoundingClientRect().right),
                bottom: Math.round(window.innerHeight - ribbon.getBoundingClientRect().top),
            };
            setPadding((prev) => (same(prev, next) ? prev : next));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(panel);
        observer.observe(ribbon);
        window.addEventListener('resize', measure);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [panel, ribbon]);

    return padding;
}
