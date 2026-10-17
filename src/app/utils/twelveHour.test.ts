import { describe, it, expect } from 'vitest';
import { clock12, hour12, range12, twelveHour } from './twelveHour';

describe('twelveHour', () => {
    it.each([
        ['00:05', '12:05am'],
        ['09:00', '9:00am'],
        ['12:00', '12:00pm'],
        ['14:05', '2:05pm'],
        ['23:59', '11:59pm'],
    ])('%s → %s', (hhmm, out) => expect(clock12(hhmm)).toBe(out));

    it('splits the period off for the big clock', () => {
        expect(twelveHour('13:20')).toEqual({ time: '1:20', period: 'pm' });
    });

    it('ranges name the period once when it does not change', () => {
        expect(range12('07:30', '09:00')).toBe('7:30–9:00am');
        expect(range12('17:00', '18:30')).toBe('5:00–6:30pm');
        expect(range12('11:30', '13:00')).toBe('11:30am–1:00pm');
    });

    it('hour labels', () => {
        expect([0, 7, 12, 19].map(hour12)).toEqual(['12am', '7am', '12pm', '7pm']);
    });
});
