import { describe, expect, it } from 'vitest';
import { mapPadding, samePadding } from './mapPadding';

describe('mapPadding', () => {
    it('pads left of the panel and below the ribbon on the landscape kiosk', () => {
        expect(mapPadding(false, 608.4, 768, 1080)).toEqual({ top: 0, right: 0, bottom: 312, left: 608 });
    });

    it('pads below the top panel and above the bottom stack in portrait', () => {
        expect(mapPadding(true, 420.6, 600, 844)).toEqual({ top: 421, right: 0, bottom: 244, left: 0 });
    });

    it('never pads negatively when a panel sits off-screen', () => {
        expect(mapPadding(true, -10, 900, 844)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    });

    it('compares paddings by value', () => {
        expect(samePadding(mapPadding(false, 1, 2, 3), mapPadding(false, 1, 2, 3))).toBe(true);
        expect(samePadding(mapPadding(false, 1, 2, 3), mapPadding(true, 1, 2, 3))).toBe(false);
    });
});
