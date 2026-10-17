import { describe, it, expect } from 'vitest';
import { contrast, over, parseColour } from './colour';
import { MOODS } from './mood';
import { ALL_PALETTES, DARK_VARIANTS, moodCss, PALETTES } from './moodPalettes';

const name = (p: (typeof ALL_PALETTES)[number]) => `${p.mood}${p.dark && p !== PALETTES[p.mood] ? ' (dark)' : ''}`;

// Every palette, with its panel composited over each of board F's background
// stops (the panel is translucent), checked against WCAG AA.
describe.each(ALL_PALETTES.map((p) => [name(p), p] as const))('%s palette', (_n, p) => {
    const surfaces = p.bg.map((stop) => over(parseColour(p.tokens.surface), parseColour(stop)));
    const ratio = (token: 'ink' | 'ink-muted' | 'ink-sub' | 'accent-coat') =>
        Math.min(...surfaces.map((s) => contrast(parseColour(p.tokens[token]), s)));

    it('ink on surface ≥ 4.5', () => expect(ratio('ink')).toBeGreaterThanOrEqual(4.5));
    it('ink-sub on surface ≥ 4.5', () => expect(ratio('ink-sub')).toBeGreaterThanOrEqual(4.5));
    it('ink-muted on surface ≥ 4.5', () => expect(ratio('ink-muted')).toBeGreaterThanOrEqual(4.5));
    it('accent-coat on surface ≥ 3 (large text)', () => expect(ratio('accent-coat')).toBeGreaterThanOrEqual(3));
});

describe('palettes', () => {
    it('orange means coat: one accent for every light palette, one for every dark one', () => {
        const accents = (dark: boolean) => new Set(ALL_PALETTES.filter((p) => p.dark === dark).map((p) => p.tokens['accent-coat']));
        expect(accents(false).size).toBe(1);
        expect(accents(true).size).toBe(1);
    });

    it('the CSS carries every mood and dark variant', () => {
        const css = moodCss();
        for (const m of MOODS) expect(css).toContain(`:root[data-mood="${m}"]{`);
        for (const m of Object.keys(DARK_VARIANTS)) expect(css).toContain(`:root[data-mood="${m}"][data-dark]{`);
        expect(css).toContain(`--surface:${PALETTES.rain.tokens.surface};`);
    });
});
