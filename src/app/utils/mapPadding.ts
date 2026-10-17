export interface MapPadding {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export const NO_PADDING: MapPadding = { top: 0, right: 0, bottom: 0, left: 0 };

// The map padding that keeps the location centred in the free area. On the
// landscape kiosk that is right of the panel and above the ribbon; in
// portrait the panel spans the top, so it is below the panel and above the
// bottom stack. `panelEdge` is the panel's right edge (landscape) or bottom
// edge (portrait); `bottomTop` is the top of whatever sits along the bottom.
export function mapPadding(portrait: boolean, panelEdge: number, bottomTop: number, viewportHeight: number): MapPadding {
    const bottom = Math.max(0, Math.round(viewportHeight - bottomTop));
    const edge = Math.max(0, Math.round(panelEdge));
    return portrait ? { top: edge, right: 0, bottom, left: 0 } : { top: 0, right: 0, bottom, left: edge };
}

export const samePadding = (a: MapPadding, b: MapPadding) =>
    a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
