import { useSyncExternalStore } from 'react';
import { KioskParams, parseKioskParams } from '../utils/kioskParams';

const NONE: KioskParams = { location: null, zoom: null, radarStill: false, settings: false };

// Parsed once per page load: the kiosk never navigates, and a stable object
// keeps useSyncExternalStore from re-rendering.
let parsed: KioskParams | null = null;
const clientParams = () => (parsed ??= parseKioskParams(window.location.search));
const serverParams = () => NONE;
const subscribe = () => () => {};

// The URL's kiosk config. The server render (and hydration) sees no params;
// the client then re-renders with the real ones, so the two never mismatch.
export function useKioskParams(): KioskParams {
    return useSyncExternalStore(subscribe, clientParams, serverParams);
}
