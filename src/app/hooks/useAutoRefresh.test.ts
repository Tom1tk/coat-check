// Force the process timezone to UTC before any Date is constructed in this
// worker, matching the convention in deriveWeather.test.ts, so the countdown
// math is deterministic regardless of the machine running the tests.
process.env.TZ = 'UTC';

import { describe, it, expect } from 'vitest';
import { minutesUntilNextRefresh } from './useAutoRefresh';

describe('minutesUntilNextRefresh (characterization)', () => {
  it('at HH:30:00 returns 31 minutes until minute-1 of the next hour', () => {
    const now = new Date('2026-07-05T10:30:00');
    expect(minutesUntilNextRefresh(now)).toBe(31);
  });

  it('at HH:00:30 returns 0 (already past minute 1 boundary target this hour)', () => {
    const now = new Date('2026-07-05T10:00:30');
    expect(minutesUntilNextRefresh(now)).toBe(0);
  });

  it('at HH:01:00 exactly returns 59, not the old "0:60" overflow', () => {
    const now = new Date('2026-07-05T10:01:00');
    expect(minutesUntilNextRefresh(now)).toBe(59);
  });

  it('at HH:59:59 returns 1', () => {
    const now = new Date('2026-07-05T10:59:59');
    expect(minutesUntilNextRefresh(now)).toBe(1);
  });
});
