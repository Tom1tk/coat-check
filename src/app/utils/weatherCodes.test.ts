import { describe, it, expect } from 'vitest';
import { KNOWN_CODES, describeCode } from './weatherCodes';

const EMITTED = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];

describe('describeCode', () => {
    it('covers exactly the codes Open-Meteo emits', () => {
        expect([...KNOWN_CODES].sort((a, b) => a - b)).toEqual(EMITTED);
    });

    it.each(EMITTED)('code %i has a real label', (code) => {
        expect(describeCode(code).label).not.toBe('Unknown');
    });

    it.each([80, 81, 82, 61, 95, 66, 51, 71])('code %i is wet', (code) => {
        expect(describeCode(code).wet).toBe(true);
    });

    it.each([0, 1, 2, 3, 45, 48])('code %i is dry', (code) => {
        expect(describeCode(code).wet).toBe(false);
    });

    it('groups showers, freezing rain and thunder separately', () => {
        expect(describeCode(81).group).toBe('showers');
        expect(describeCode(67).group).toBe('freezing');
        expect(describeCode(96).group).toBe('thunder');
    });

    it('maps an unknown code to a dry Unknown cloud', () => {
        expect(describeCode(999)).toEqual({ label: 'Unknown', icon: 'cloud', wet: false, group: 'cloud' });
    });
});
