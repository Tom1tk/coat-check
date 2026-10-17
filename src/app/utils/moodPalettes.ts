import { mix, over, parseColour, toHex, withAlpha } from './colour';
import { Mood, MOODS } from './mood';

// The kiosk's colour tokens — the single source for the CSS, which layout.tsx
// renders from moodCss(). The two bases are boards G1 (light) and G2 (dark);
// each mood overrides them with board F's panel, ink and swatch.

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

// Board F, per mood: the screen background (its gradient stops), the panel,
// the ink, and the swatch the basemap is washed with.
interface MoodSpec {
    dark: boolean;
    bg: readonly [string, string];
    panel: string;
    fg: string;
    swatch: string;
    okFg?: string;
}

const CLEAR: MoodSpec = { dark: false, bg: ['#fdf3e1', '#f6d9a8'], panel: 'rgba(255,250,240,0.82)', fg: '#2a1d0e', swatch: '#f2c27b', okFg: '#0f766e' };
const OVERCAST: MoodSpec = { dark: false, bg: ['#e7eaed', '#cbd2d9'], panel: 'rgba(248,249,250,0.82)', fg: '#1e252c', swatch: '#b8c0c8' };
const RAIN: MoodSpec = { dark: true, bg: ['#132538', '#1f3b5b'], panel: 'rgba(12,22,34,0.80)', fg: '#e6eef6', swatch: '#1e3a5a' };
const FROST: MoodSpec = { dark: false, bg: ['#f2f8fc', '#cfe6f6'], panel: 'rgba(250,253,255,0.84)', fg: '#0c2536', swatch: '#bfe0f5' };
const STORM: MoodSpec = { dark: true, bg: ['#1c1828', '#3a2d55'], panel: 'rgba(20,16,30,0.80)', fg: '#ece8f6', swatch: '#3b2f55' };
const NIGHT: MoodSpec = { dark: true, bg: ['#090f1f', '#141d36'], panel: 'rgba(10,14,28,0.78)', fg: '#dfe5f3', swatch: '#141d36' };
// Board F has no night frost: night's panel and ink, washed with frost's swatch.
const FROST_NIGHT: MoodSpec = { ...NIGHT, swatch: FROST.swatch };

const MAP_TINT_ALPHA = 0.12;
const INK_SUB_WEIGHT = 0.82;
const INK_MUTED_WEIGHT = 0.66;

export interface Palette {
    mood: Mood;
    dark: boolean;
    // Board F's background stops, for the contrast test.
    bg: readonly [string, string];
    tokens: Tokens;
}

function palette(mood: Mood, spec: MoodSpec): Palette {
    const ink = parseColour(spec.fg);
    // Secondary inks are the ink faded toward the panel as it reads over
    // board F's background, so every mood keeps the same hierarchy.
    const panel = over(parseColour(spec.panel), parseColour(spec.bg[1]));
    const tokens: Tokens = {
        ...(spec.dark ? DARK_BASE : LIGHT_BASE),
        'map-tint': withAlpha(parseColour(spec.swatch), MAP_TINT_ALPHA),
        surface: spec.panel,
        ink: spec.fg,
        'ink-sub': toHex(mix(ink, panel, INK_SUB_WEIGHT)),
        'ink-muted': toHex(mix(ink, panel, INK_MUTED_WEIGHT)),
        ...(spec.okFg ? { 'ok-fg': spec.okFg } : {}),
    };
    return { mood, dark: spec.dark, bg: spec.bg, tokens };
}

export const PALETTES: Readonly<Record<Mood, Palette>> = {
    clear: palette('clear', CLEAR),
    overcast: palette('overcast', OVERCAST),
    rain: palette('rain', RAIN),
    frost: palette('frost', FROST),
    storm: palette('storm', STORM),
    night: palette('night', NIGHT),
};

// Dark variants of light moods, used after sunset (see isDarkMood).
export const DARK_VARIANTS: Readonly<Partial<Record<Mood, Palette>>> = {
    frost: palette('frost', FROST_NIGHT),
};

export const ALL_PALETTES: readonly Palette[] = [
    ...MOODS.map((m) => PALETTES[m]),
    ...Object.values(DARK_VARIANTS),
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
        ...MOODS.map((m) => `:root[data-mood="${m}"]{${declarations(PALETTES[m].tokens)}}`),
        ...Object.entries(DARK_VARIANTS).map(
            ([m, p]) => `:root[data-mood="${m}"][data-dark]{${declarations(p!.tokens)}}`
        ),
    ].join('\n');
}

export function paletteFor(mood: Mood, dark: boolean): Palette {
    return (dark && DARK_VARIANTS[mood]) || PALETTES[mood];
}
