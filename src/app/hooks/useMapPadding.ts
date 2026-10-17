import { useEffect, useState } from 'react';
import { mapPadding, MapPadding, NO_PADDING, samePadding } from '../utils/mapPadding';

export type { MapPadding } from '../utils/mapPadding';

// The map padding that keeps the location centred in the free area between
// the panel and whatever runs along the bottom (see utils/mapPadding).
// Measured from the elements themselves (ResizeObserver + window resize), so
// it follows any screen size and either orientation.
export function useMapPadding(panel: HTMLElement | null, bottom: HTMLElement | null, portrait = false): MapPadding {
    const [padding, setPadding] = useState<MapPadding>(NO_PADDING);

    useEffect(() => {
        if (!panel || !bottom) return;
        const measure = () => {
            const box = panel.getBoundingClientRect();
            const next = mapPadding(portrait, portrait ? box.bottom : box.right, bottom.getBoundingClientRect().top, window.innerHeight);
            setPadding((prev) => (samePadding(prev, next) ? prev : next));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(panel);
        observer.observe(bottom);
        window.addEventListener('resize', measure);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [panel, bottom, portrait]);

    return padding;
}
