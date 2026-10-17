import { describe, it, expect } from 'vitest';
import { contrast, over, parseColour } from './colour';
import { MOODS } from './mood';
import { ALL_PALETTES, DAY_PALETTES, moodCss, NIGHT_PALETTES } from './moodPalettes';

const name = (p: (typeof ALL_PALETTES)[number]) => `${p.mood} (${p.dark ? 'night' : 'day'})`;

// Every palette, with its panel composited over each of its background stops
// (the panel is translucent), checked against WCAG AA.
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
    it('orange means coat: one accent per base', () => {
        for (const base of ['light', 'vivid', 'dark'] as const) {
            const accents = new Set(ALL_PALETTES.filter((p) => p.base === base).map((p) => p.tokens['accent-coat']));
            expect(accents.size).toBe(1);
        }
    });

    it('night follows the sun: every mood has a dark night palette', () => {
        for (const m of MOODS) {
            expect(DAY_PALETTES[m].dark).toBe(false);
            expect(NIGHT_PALETTES[m].base).toBe('dark');
        }
    });

    it('every mood has its own colour, by day and by night', () => {
        for (const set of [DAY_PALETTES, NIGHT_PALETTES]) {
            expect(new Set(MOODS.map((m) => set[m].tokens.surface)).size).toBe(MOODS.length);
        }
    });

    it('the CSS carries every mood by day and by night', () => {
        const css = moodCss();
        for (const m of MOODS) {
            expect(css).toContain(`:root[data-mood="${m}"]{`);
            expect(css).toContain(`:root[data-mood="${m}"][data-dark]{`);
        }
        expect(css).toContain(`--surface:${DAY_PALETTES.rain.tokens.surface};`);
    });
});
