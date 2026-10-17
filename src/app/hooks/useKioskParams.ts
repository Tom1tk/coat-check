import { useState } from 'react';
import { KioskParams, parseKioskParams } from '../utils/kioskParams';

const NONE: KioskParams = { location: null, zoom: null, radarStill: false, settings: false };

// The URL's kiosk config, read once at mount (the kiosk never navigates).
export function useKioskParams(): KioskParams {
    const [params] = useState(() => (typeof window === 'undefined' ? NONE : parseKioskParams(window.location.search)));
    return params;
}
