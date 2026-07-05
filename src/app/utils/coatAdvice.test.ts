import { describe, it, expect } from 'vitest';
import { getCoatAdvice, COAT_ADVICE, WeatherPeriod } from './coatAdvice';

function period(overrides: Partial<WeatherPeriod> = {}): WeatherPeriod {
    return { temp: 20, rain: 0, condition: 'Clear', ...overrides };
}

describe('getCoatAdvice', () => {
    it('needs a coat when any period has rain > 0', () => {
        expect(getCoatAdvice([period({ rain: 0.1 })])).toBe(COAT_ADVICE.NEEDED);
    });

    it('needs a coat when temp is exactly 0', () => {
        expect(getCoatAdvice([period({ temp: 0 })])).toBe(COAT_ADVICE.NEEDED);
    });

    it('needs a coat when temp is 9.9', () => {
        expect(getCoatAdvice([period({ temp: 9.9 })])).toBe(COAT_ADVICE.NEEDED);
    });

    it('recommends a coat when temp is exactly 10 and cloudy', () => {
        expect(getCoatAdvice([period({ temp: 10, condition: 'Cloudy' })])).toBe(
            COAT_ADVICE.RECOMMENDED
        );
    });

    it('recommends a coat when temp is exactly 15 and cloudy', () => {
        expect(getCoatAdvice([period({ temp: 15, condition: 'Cloudy' })])).toBe(
            COAT_ADVICE.RECOMMENDED
        );
    });

    it('does not need a coat when temp is 15.1 and cloudy', () => {
        expect(getCoatAdvice([period({ temp: 15.1, condition: 'Cloudy' })])).toBe(
            COAT_ADVICE.NOT_NEEDED
        );
    });

    it('does not need a coat at temp 12, Clear, no rain', () => {
        expect(getCoatAdvice([period({ temp: 12, condition: 'Clear', rain: 0 })])).toBe(
            COAT_ADVICE.NOT_NEEDED
        );
    });

    it('needs a coat when only the second of two periods triggers the rain rule', () => {
        expect(
            getCoatAdvice([period({ rain: 0 }), period({ rain: 1 })])
        ).toBe(COAT_ADVICE.NEEDED);
    });

    it('recommends a coat when only the second of two periods triggers the recommend rule', () => {
        expect(
            getCoatAdvice([period(), period({ temp: 12, condition: 'Cloudy' })])
        ).toBe(COAT_ADVICE.RECOMMENDED);
    });

    it('does not need a coat for an empty period array', () => {
        expect(getCoatAdvice([])).toBe(COAT_ADVICE.NOT_NEEDED);
    });
});
