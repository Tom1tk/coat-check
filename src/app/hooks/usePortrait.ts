import { useSyncExternalStore } from 'react';

// Must match the `@media (orientation: portrait)` rule in globals.css, which
// switches `--u` to the portrait reference at the same moment.
export const PORTRAIT_QUERY = '(orientation: portrait)';

function subscribe(onChange: () => void): () => void {
    const query = window.matchMedia(PORTRAIT_QUERY);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
}

// True on a portrait (or square) screen, where the kiosk stacks into its
// one-screen phone layout. The server render assumes landscape.
export function usePortrait(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(PORTRAIT_QUERY).matches,
        () => false
    );
}
