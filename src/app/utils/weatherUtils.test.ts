import { describe, it, expect } from 'vitest';
import { codeToCondition } from './weatherUtils';

describe('codeToCondition', () => {
    it('maps code 0 to Clear', () => {
        expect(codeToCondition(0)).toBe('Clear');
    });

    it('maps code 1 to Cloudy', () => {
        expect(codeToCondition(1)).toBe('Cloudy');
    });

    it('maps code 2 to Cloudy', () => {
        expect(codeToCondition(2)).toBe('Cloudy');
    });

    it('maps code 3 to Cloudy', () => {
        expect(codeToCondition(3)).toBe('Cloudy');
    });

    it('maps code 45 to Fog', () => {
        expect(codeToCondition(45)).toBe('Fog');
    });

    it('maps code 48 to Fog', () => {
        expect(codeToCondition(48)).toBe('Fog');
    });

    it('maps code 51 to Rain', () => {
        expect(codeToCondition(51)).toBe('Rain');
    });

    it('maps code 61 to Rain', () => {
        expect(codeToCondition(61)).toBe('Rain');
    });

    it('maps code 65 to Rain', () => {
        expect(codeToCondition(65)).toBe('Rain');
    });

    it('maps code 71 (snow) to Other', () => {
        expect(codeToCondition(71)).toBe('Other');
    });

    it('maps code 95 (thunderstorm) to Other', () => {
        expect(codeToCondition(95)).toBe('Other');
    });
});
