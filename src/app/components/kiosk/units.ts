// A length in 1920×1080 reference pixels, scaled to the screen through the
// `--u` variable that `.kiosk-root` defines in globals.css.
export const u = (px: number) => `calc(${px} * var(--u))`;

// The small spaced capitals used for section labels ("LEAVING NOW").
export const eyebrow = {
    fontSize: u(13),
    fontWeight: 600,
    letterSpacing: u(2),
    color: 'var(--ink-muted)',
} as const;

// The landscape week ribbon's height; the panel ends above it.
export const RIBBON_HEIGHT = 214;
