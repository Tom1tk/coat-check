import { contrast, mix, over, parseColour, Rgba, toHex, withAlpha } from './colour';
import { Mood, MOODS } from './mood';

// The kiosk's colour tokens — the single source for the CSS, which layout.tsx
// renders from moodCss(). "Sun and Sky": the sun picks day or night, the
// weather picks the colour. Days are saturated, Apple-Weather-like panels
// with white ink (VIVID_BASE), except overcast, which stays pale (board G1);
// nights are board G2 tinted with each mood's hue.

export type Token =
    | 'map-tint' | 'surface' | 'surface-border' | 'surface-shadow'
    | 'ink' | 'ink-sub' | 'ink-muted'
    | 'accent-coat' | 'coat-bg' | 'coat-fg' | 'coat-card'
    | 'ok-bg' | 'ok-fg' | 'card'
    | 'rain-hi' | 'rain-mid' | 'rain-lo' | 'pct-hi'
    | 'weekend-tint' | 'today-tint' | 'divider'
    | 'icon' | 'rain-icon' | 'sun-icon' | 'out-win' | 'back-win';

export type Tokens = Readonly<Record<Token, string>>;

export const LIGHT_BASE: Tokens = {
    'map-tint': 'rgba(100, 116, 139, 0.10)',
    surface: 'rgba(255, 255, 255, 0.82)',
    'surface-border': 'rgba(255, 255, 255, 0.7)',
    'surface-shadow': '0 20px 60px rgba(20, 24, 29, 0.16)',
    ink: '#14181d',
    'ink-sub': '#3c434a',
    'ink-muted': '#5b636c',
    'accent-coat': '#b4400b',
    'coat-bg': 'rgba(180, 64, 11, 0.14)',
    'coat-fg': '#8a3008',
    'coat-card': 'rgba(180, 64, 11, 0.08)',
    'ok-bg': 'rgba(15, 118, 110, 0.12)',
    'ok-fg': '#0d5e58',
    card: 'rgba(20, 24, 29, 0.045)',
    'rain-hi': '#2f7fd6',
    'rain-mid': '#8bbbe8',
    'rain-lo': 'rgba(20, 24, 29, 0.16)',
    'pct-hi': '#1d4ed8',
    'weekend-tint': 'rgba(37, 99, 235, 0.08)',
    'today-tint': 'rgba(20, 24, 29, 0.045)',
    divider: 'rgba(20, 24, 29, 0.08)',
    icon: '#3c434a',
    'rain-icon': '#1d4ed8',
    'sun-icon': '#b45309',
    'out-win': 'rgba(15, 118, 110, 0.10)',
    'back-win': 'rgba(180, 64, 11, 0.12)',
};

// White ink on a saturated panel: the clear, rain, frost and storm days.
export const VIVID_BASE: Tokens = {
    'map-tint': 'rgba(255, 255, 255, 0)',
    surface: 'rgba(255, 255, 255, 0.18)',
    'surface-border': 'rgba(255, 255, 255, 0.28)',
    'surface-shadow': '0 20px 60px rgba(0, 0, 0, 0.18)',
    ink: '#ffffff',
    'ink-sub': '#ffffff',
    'ink-muted': '#ffffff',
    'accent-coat': '#ffc48a',
    'coat-bg': 'rgba(255, 196, 138, 0.22)',
    'coat-fg': '#ffe0c2',
    'coat-card': 'rgba(255, 255, 255, 0.12)',
    'ok-bg': 'rgba(255, 255, 255, 0.18)',
    'ok-fg': '#d5fbf3',
    card: 'rgba(255, 255, 255, 0.12)',
    'rain-hi': '#ffffff',
    'rain-mid': 'rgba(255, 255, 255, 0.6)',
    'rain-lo': 'rgba(255, 255, 255, 0.28)',
    'pct-hi': '#d6efff',
    'weekend-tint': 'rgba(255, 255, 255, 0.08)',
    'today-tint': 'rgba(255, 255, 255, 0.14)',
    divider: 'rgba(255, 255, 255, 0.18)',
    icon: '#ffffff',
    'rain-icon': '#d6efff',
    'sun-icon': '#ffd66b',
    'out-win': 'rgba(167, 243, 228, 0.16)',
    'back-win': 'rgba(255, 196, 138, 0.18)',
};

export const DARK_BASE: Tokens = {
    'map-tint': 'rgba(30, 58, 90, 0.14)',
    surface: 'rgba(14, 24, 36, 0.82)',
    'surface-border': 'rgba(125, 211, 252, 0.14)',
    'surface-shadow': '0 20px 60px rgba(0, 0, 0, 0.35)',
    ink: '#e6eef6',
    'ink-sub': '#cfdbe6',
    'ink-muted': '#93a6b8',
    'accent-coat': '#fdba74',
    'coat-bg': 'rgba(253, 186, 116, 0.16)',
    'coat-fg': '#fdba74',
    'coat-card': 'rgba(253, 186, 116, 0.10)',
    'ok-bg': 'rgba(94, 234, 212, 0.14)',
    'ok-fg': '#5eead4',
    card: 'rgba(255, 255, 255, 0.05)',
    'rain-hi': '#2fa7e0',
    'rain-mid': 'rgba(47, 167, 224, 0.5)',
    'rain-lo': 'rgba(255, 255, 255, 0.14)',
    'pct-hi': '#7dd3fc',
    'weekend-tint': 'rgba(125, 211, 252, 0.10)',
    'today-tint': 'rgba(255, 255, 255, 0.05)',
    divider: 'rgba(255, 255, 255, 0.08)',
    icon: '#cfdbe6',
    'rain-icon': '#7dd3fc',
    'sun-icon': '#fcd34d',
    'out-win': 'rgba(94, 234, 212, 0.12)',
    'back-win': 'rgba(253, 186, 116, 0.14)',
};

export type Base = 'light' | 'vivid' | 'dark';

const BASES: Readonly<Record<Base, Tokens>> = { light: LIGHT_BASE, vivid: VIVID_BASE, dark: DARK_BASE };

// One mood at one time of day: the screen background (its gradient stops),
// the panel, the ink, and the swatch the basemap is washed with.
interface MoodSpec {
    base: Base;
    bg: readonly [string, string];
    panel: string;
    fg: string;
    swatch: string;
}

// The basemap wash: strong on vivid days so the map reads as the sky's
// colour, lighter on pale overcast, in between at night.
const MAP_TINT_ALPHA: Readonly<Record<Base, number>> = { light: 0.12, vivid: 0.45, dark: 0.3 };

const DAY: Readonly<Record<Mood, MoodSpec>> = {
    clear: { base: 'vivid', bg: ['#1e8cff', '#86ccff'], panel: 'rgba(10,96,210,0.86)', fg: '#ffffff', swatch: '#2a9bff' },
    overcast: { base: 'light', bg: ['#dfe4ea', '#b4bec9'], panel: 'rgba(244,246,249,0.86)', fg: '#1e252c', swatch: '#aab4bf' },
    rain: { base: 'vivid', bg: ['#4f6277', '#7a8ca0'], panel: 'rgba(52,68,86,0.82)', fg: '#ffffff', swatch: '#5b7088' },
    frost: { base: 'vivid', bg: ['#2a9fb5', '#8fd6e2'], panel: 'rgba(10,86,104,0.86)', fg: '#ffffff', swatch: '#3fb0c4' },
    storm: { base: 'vivid', bg: ['#4a3d6e', '#7d6ca6'], panel: 'rgba(66,50,104,0.84)', fg: '#ffffff', swatch: '#6a5596' },
};

const NIGHT: Readonly<Record<Mood, MoodSpec>> = {
    clear: { base: 'dark', bg: ['#081a44', '#143a80'], panel: 'rgba(8,24,62,0.80)', fg: '#e3ecff', swatch: '#2f62c8' },
    overcast: { base: 'dark', bg: ['#1a1f27', '#343c48'], panel: 'rgba(26,31,40,0.82)', fg: '#e6eaf0', swatch: '#6b7686' },
    rain: { base: 'dark', bg: ['#16273a', '#2b4560'], panel: 'rgba(18,30,44,0.80)', fg: '#e6eef6', swatch: '#4a6684' },
    frost: { base: 'dark', bg: ['#05262e', '#0e4c58'], panel: 'rgba(4,34,42,0.80)', fg: '#ddf6fa', swatch: '#1fa3b6' },
    storm: { base: 'dark', bg: ['#1e1436', '#432a72'], panel: 'rgba(28,16,50,0.80)', fg: '#eee6ff', swatch: '#7048b8' },
};

// How far the secondary inks fade toward the panel, at most; on a saturated
// panel they fade less, so they never drop below AA (CONTRAST_FLOOR).
const INK_SUB_WEIGHT = 0.82;
const INK_MUTED_WEIGHT = 0.66;
const CONTRAST_FLOOR = 4.5;
const WEIGHT_STEP = 0.02;

export interface Palette {
    mood: Mood;
    dark: boolean;
    base: Base;
    // The screen background's stops, for the contrast test.
    bg: readonly [string, string];
    tokens: Tokens;
}

// Ink faded toward the panel by `weight`, or less if that would read below
// the floor over either background stop.
function secondaryInk(ink: Rgba, spec: MoodSpec, weight: number): string {
    const panel = parseColour(spec.panel);
    const surfaces = spec.bg.map((stop) => over(panel, parseColour(stop)));
    const faded = (w: number) => mix(ink, surfaces[1], w);
    const readable = (w: number) => surfaces.every((s) => contrast(faded(w), s) >= CONTRAST_FLOOR);
    let w = weight;
    while (w < 1 && !readable(w)) w = Math.min(1, w + WEIGHT_STEP);
    return toHex(faded(w));
}

function palette(mood: Mood, dark: boolean): Palette {
    const spec = (dark ? NIGHT : DAY)[mood];
    const ink = parseColour(spec.fg);
    const tokens: Tokens = {
        ...BASES[spec.base],
        'map-tint': withAlpha(parseColour(spec.swatch), MAP_TINT_ALPHA[spec.base]),
        surface: spec.panel,
        ink: spec.fg,
        'ink-sub': secondaryInk(ink, spec, INK_SUB_WEIGHT),
        'ink-muted': secondaryInk(ink, spec, INK_MUTED_WEIGHT),
    };
    return { mood, dark, base: spec.base, bg: spec.bg, tokens };
}

const build = (dark: boolean) =>
    Object.fromEntries(MOODS.map((m) => [m, palette(m, dark)])) as Record<Mood, Palette>;

export const DAY_PALETTES: Readonly<Record<Mood, Palette>> = build(false);
export const NIGHT_PALETTES: Readonly<Record<Mood, Palette>> = build(true);

export const ALL_PALETTES: readonly Palette[] = [
    ...MOODS.map((m) => DAY_PALETTES[m]),
    ...MOODS.map((m) => NIGHT_PALETTES[m]),
];

const declarations = (tokens: Tokens) =>
    Object.entries(tokens)
        .map(([name, value]) => `--${name}:${value};`)
        .join('');

// Board G1 until the first forecast, then one block per mood, picked by
// `<html data-mood="…" data-dark>` (useMood). Every selector outranks a bare
// `:root`, so shadcn's `--card` in globals.css never wins, whatever the order.
export function moodCss(): string {
    return [
        `:root:not([data-mood]){${declarations(LIGHT_BASE)}}`,
        ...MOODS.map((m) => `:root[data-mood="${m}"]{${declarations(DAY_PALETTES[m].tokens)}}`),
        ...MOODS.map((m) => `:root[data-mood="${m}"][data-dark]{${declarations(NIGHT_PALETTES[m].tokens)}}`),
    ].join('\n');
}

export function paletteFor(mood: Mood, dark: boolean): Palette {
    return (dark ? NIGHT_PALETTES : DAY_PALETTES)[mood];
}
