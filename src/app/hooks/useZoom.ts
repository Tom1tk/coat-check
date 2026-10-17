import { useState } from 'react';
import { ZOOM_LEVELS } from '../config';

const KEY = 'zoomLevel';
const DEFAULT_ZOOM: number = ZOOM_LEVELS[0];

function storedZoom(): number {
    if (typeof window === 'undefined') return DEFAULT_ZOOM;
    try {
        const n = Number(localStorage.getItem(KEY));
        return (ZOOM_LEVELS as readonly number[]).includes(n) ? n : DEFAULT_ZOOM;
    } catch {
        return DEFAULT_ZOOM; // storage unavailable (private mode)
    }
}

// Map zoom, persisted to localStorage. A `?zoom=` pin wins and isn't saved.
export function useZoom(pinned: number | null): { zoom: number; setZoom: (z: number) => void } {
    const [stored, setStored] = useState(storedZoom);
    const setZoom = (z: number) => {
        setStored(z);
        try {
            localStorage.setItem(KEY, String(z));
        } catch (err) {
            console.warn('Could not save zoom level:', err);
        }
    };
    return { zoom: pinned ?? stored, setZoom };
}
