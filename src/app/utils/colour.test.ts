import { describe, it, expect } from 'vitest';
import { contrast, mix, over, parseColour, toHex, withAlpha } from './colour';

describe('colour', () => {
    it('parses hex and rgba', () => {
        expect(parseColour('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
        expect(parseColour('#14181d')).toEqual({ r: 20, g: 24, b: 29, a: 1 });
        expect(parseColour('rgba(12,22,34,0.80)')).toEqual({ r: 12, g: 22, b: 34, a: 0.8 });
        expect(() => parseColour('oklch(1 0 0)')).toThrow(/Unsupported/);
    });

    it('composites and mixes', () => {
        expect(toHex(over(parseColour('rgba(0,0,0,0.5)'), parseColour('#ffffff')))).toBe('#808080');
        expect(toHex(mix(parseColour('#000'), parseColour('#fff'), 0.25))).toBe('#bfbfbf');
        expect(withAlpha(parseColour('#f2c27b'), 0.12)).toBe('rgba(242, 194, 123, 0.12)');
    });

    it('computes WCAG contrast', () => {
        expect(contrast(parseColour('#000'), parseColour('#fff'))).toBeCloseTo(21, 5);
        expect(contrast(parseColour('#777'), parseColour('#fff'))).toBeCloseTo(4.48, 2);
    });
});
