import { describe, it, expect, vi } from 'vitest';
import { parseKioskParams } from './kioskParams';

describe('parseKioskParams', () => {
    it('reads a pinned location, zoom, still radar and settings', () => {
        const warn = vi.fn();
        expect(parseKioskParams('?lat=51.5&lon=-0.12&name=London&zoom=6&radar=still&settings', warn)).toEqual({
            location: { name: 'London', latitude: 51.5, longitude: -0.12 },
            zoom: 6,
            radarStill: true,
            settings: true,
        });
        expect(warn).not.toHaveBeenCalled();
    });

    it('defaults everything when params are missing', () => {
        expect(parseKioskParams('')).toEqual({ location: null, zoom: null, radarStill: false, settings: false });
    });

    it('names an unnamed pin', () => {
        expect(parseKioskParams('?lat=0&lon=0').location?.name).toBe('Pinned location');
    });

    it.each([
        ['?lat=91&lon=0', 'latitude out of range'],
        ['?lat=0&lon=-180.5', 'longitude out of range'],
        ['?lat=abc&lon=0', 'NaN'],
        ['?lat=Infinity&lon=0', 'infinite'],
        ['?lat=52', 'missing lon'],
        ['?lat=&lon=0', 'empty lat'],
    ])('ignores %s (%s) with a warning', (search) => {
        const warn = vi.fn();
        expect(parseKioskParams(search, warn).location).toBeNull();
        expect(warn).toHaveBeenCalledOnce();
    });

    it.each(['?zoom=12', '?zoom=6.5', '?zoom=x'])('ignores %s with a warning', (search) => {
        const warn = vi.fn();
        expect(parseKioskParams(search, warn).zoom).toBeNull();
        expect(warn).toHaveBeenCalledOnce();
    });

    it('only radar=still turns the loop off', () => {
        expect(parseKioskParams('?radar=loop').radarStill).toBe(false);
    });
});
