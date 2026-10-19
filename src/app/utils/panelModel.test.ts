import { describe, it, expect } from 'vitest';
import fixture from './__fixtures__/forecast-cambridge.json';
import { buildForecast } from './__fixtures__/buildForecast';
import { parseForecast } from './forecast';
import { nextChange, panelModel } from './panelModel';

// 2026-10-19 is a Monday; offset 0 so instants read as local time.
const MONDAY = '2026-10-19';
const at = (stamp: string) => new Date(`${stamp}:00Z`);

const wetBack = buildForecast(MONDAY, {
    days: 7,
    hour: (s) =>
        s >= `${MONDAY}T15:00` && s < `${MONDAY}T20:00`
            ? { probability: 80, precipitation: 0.6, code: 80, gusts: 28 }
            : { feelsLike: 16 },
});

describe('panelModel', () => {
    it('weekday morning: coat in bag, Out/Back cards, shaded strip', () => {
        const m = panelModel(wetBack, at(`${MONDAY}T07:42`));
        expect(m.time).toBe('07:42');
        expect(m.date).toBe('Monday 19 October');
        expect(m.heading).toBe('LEAVING NOW');
        expect(m.verdictText).toBe('Coat in bag.');
        expect(m.cards.map((c) => [c.label, c.range, c.tag, c.kind])).toEqual([
            ['Out', '7:30–9:00am', 'No coat needed', 'ok'],
            ['Back', '5:00–6:30pm', 'Coat on', 'coat'],
        ]);
        expect(m.cards[1].line).toBe('80% · 1.2 mm · gusts 28');
        expect(m.rain).toHaveLength(14);
        expect(m.rain[0]).toEqual({ hour: 7, probability: 0 });
        expect(m.shading).toEqual([
            { start: 7.5, end: 9 },
            { start: 17, end: 18.5 },
        ]);
        expect(m.change).toEqual({ time: '15:00', label: 'rain arrives' });
    });

    it('weekday evening looks at tomorrow', () => {
        expect(panelModel(wetBack, at(`${MONDAY}T19:10`)).heading).toBe('TOMORROW');
    });

    it('weekday cards give the coldest feels-like', () => {
        expect(panelModel(wetBack, at(`${MONDAY}T07:42`)).cards[0].sub).toBe('feels 16°');
    });

    it('weekend: one whole-day card and no commute shading', () => {
        const m = panelModel(wetBack, at('2026-10-24T10:00'));
        expect(m.heading).toBe('TODAY');
        expect(m.cards.map((c) => [c.label, c.range])).toEqual([['Today', '7am–7pm']]);
        expect(m.cards[0].sub).toMatch(/^low -?\d+°$/);
        expect(m.shading).toEqual([]);
    });

    it('weekend evening looks at tomorrow\'s day', () => {
        const m = panelModel(wetBack, at('2026-10-24T19:30'));
        expect(m.heading).toBe('TOMORROW');
        expect(m.cards.map((c) => c.label)).toEqual(['Tomorrow']);
    });

    it('tomorrow: the next day\'s Out/Back cards and its own rain strip', () => {
        const { tomorrow } = panelModel(wetBack, at(`${MONDAY}T07:42`));
        expect(tomorrow.date).toBe('Tue 20 Oct');
        expect(tomorrow.cards.map((c) => [c.label, c.range, c.tag])).toEqual([
            ['Out', '7:30–9:00am', 'No coat needed'],
            ['Back', '5:00–6:30pm', 'No coat needed'],
        ]);
        expect(tomorrow.rain).toHaveLength(14);
        expect(tomorrow.rain.every((h) => h.probability === 0)).toBe(true);
        expect(tomorrow.shading).toHaveLength(2);
    });

    it('tomorrow from a Friday is Saturday\'s whole day, unshaded', () => {
        const { tomorrow } = panelModel(wetBack, at('2026-10-23T10:00'));
        expect(tomorrow.date).toBe('Sat 24 Oct');
        expect(tomorrow.cards.map((c) => [c.label, c.range])).toEqual([['Tomorrow', '7am–7pm']]);
        expect(tomorrow.shading).toEqual([]);
    });

    it('live fixture (Saturday 13:30 BST) derives without throwing', () => {
        const m = panelModel(parseForecast(fixture), new Date('2026-10-17T12:30:00Z'));
        expect(m.time).toBe('13:30');
        expect(m.date).toBe('Saturday 17 October');
        expect(m.cards).toHaveLength(1);
    });
});

describe('nextChange', () => {
    it('reports when rain stops', () => {
        expect(nextChange(wetBack, at(`${MONDAY}T16:20`))).toEqual({ time: '20:00', label: 'dry from' });
    });

    it('is null when nothing changes within 12 hours', () => {
        expect(nextChange(buildForecast(MONDAY), at(`${MONDAY}T01:00`))).toBeNull();
    });

    it('is null outside the forecast', () => {
        expect(nextChange(buildForecast(MONDAY, { days: 1 }), at('2026-11-01T01:00'))).toBeNull();
    });
});
