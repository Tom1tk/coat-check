import { ZOOM_LEVELS } from '../config';
import type { Location } from '../hooks/useLocation';

// Kiosk configuration pinned in the URL. Params win over localStorage, so a
// kiosk can be set up once by its URL and never needs input.
export interface KioskParams {
    location: Location | null; // ?lat=&lon=[&name=]
    zoom: number | null; // ?zoom=
    radarStill: boolean; // ?radar=still
    settings: boolean; // ?settings
}

const DEFAULT_NAME = 'Pinned location';

function finite(raw: string | null): number | null {
    if (raw === null || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
}

function parseLocation(q: URLSearchParams, warn: (msg: string) => void): Location | null {
    if (!q.has('lat') && !q.has('lon')) return null;
    const latitude = finite(q.get('lat'));
    const longitude = finite(q.get('lon'));
    if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        warn(`Kiosk params: ignoring lat=${q.get('lat')} lon=${q.get('lon')} (need lat ±90, lon ±180)`);
        return null;
    }
    const name = q.get('name')?.trim() || DEFAULT_NAME;
    return { name, latitude, longitude };
}

function parseZoom(q: URLSearchParams, warn: (msg: string) => void): number | null {
    if (!q.has('zoom')) return null;
    const zoom = finite(q.get('zoom'));
    if (zoom === null || !(ZOOM_LEVELS as readonly number[]).includes(zoom)) {
        warn(`Kiosk params: ignoring zoom=${q.get('zoom')} (expected one of ${ZOOM_LEVELS.join(', ')})`);
        return null;
    }
    return zoom;
}

// Invalid params are ignored with a warning, never fatal.
export function parseKioskParams(search: string, warn: (msg: string) => void = console.warn): KioskParams {
    const q = new URLSearchParams(search);
    return {
        location: parseLocation(q, warn),
        zoom: parseZoom(q, warn),
        radarStill: q.get('radar') === 'still',
        settings: q.has('settings'),
    };
}
