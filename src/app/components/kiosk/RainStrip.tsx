'use client';
import type { RainHour } from '@/app/utils/panelModel';
import { STRIP_END_HOUR, STRIP_START_HOUR } from '@/app/utils/panelModel';
import { hour12 } from '@/app/utils/twelveHour';
import { eyebrow, u } from './units';

const SPAN = STRIP_END_HOUR - STRIP_START_HOUR + 1;
const HEIGHT = 110;
const MIN_HEIGHT = 48; // the strip gives way to two window cards (and the tomorrow line) down to this
const BAR_SCALE = 0.9; // a 100% chance fills this much of the strip
const WINDOW_TINTS = ['var(--out-win)', 'var(--back-win)'];

const pct = (n: number) => `${((n / SPAN) * 100).toFixed(2)}%`;

function barColour(probability: number): string {
    if (probability >= 50) return 'var(--rain-hi)';
    if (probability >= 25) return 'var(--rain-mid)';
    return 'var(--rain-lo)';
}

// A day's hourly chance of rain, 07–20, with the commute windows shaded.
export default function RainStrip({ day, hours, shading }: { day: string; hours: RainHour[]; shading: { start: number; end: number }[] }) {
    return (
        <div style={{ marginTop: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap: u(10) }}>
            <div style={{ ...eyebrow, display: 'flex', justifyContent: 'space-between', gap: u(12), whiteSpace: 'nowrap' }}>
                <span>{day} · CHANCE OF RAIN</span>
                {shading.length > 0 && <span style={{ letterSpacing: 0, fontWeight: 400 }}>shaded = your commute</span>}
            </div>
            <div style={{ position: 'relative', height: u(HEIGHT), minHeight: u(MIN_HEIGHT), flexShrink: 1 }}>
                {shading.map((w, i) => (
                    <div
                        key={w.start}
                        style={{
                            position: 'absolute',
                            top: 0,
                            bottom: 0,
                            left: pct(w.start - STRIP_START_HOUR),
                            width: pct(w.end - w.start),
                            borderRadius: u(8),
                            background: WINDOW_TINTS[i % WINDOW_TINTS.length],
                        }}
                    />
                ))}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: u(4), padding: `0 ${u(2)}` }}>
                    {hours.map((h) => (
                        <div
                            key={h.hour}
                            title={`${hour12(h.hour)} · ${h.probability}%`}
                            style={{ flex: '1 1 0', height: `calc(${(h.probability * BAR_SCALE).toFixed(1)}% + ${u(4)})`, borderRadius: `${u(4)} ${u(4)} ${u(2)} ${u(2)}`, background: barColour(h.probability) }}
                        />
                    ))}
                </div>
            </div>
            <div className="tn" style={{ display: 'flex', gap: u(4), padding: `0 ${u(2)}`, fontSize: u(12), color: 'var(--ink-muted)' }}>
                {hours.map((h, i) => (
                    <span key={h.hour} style={{ flex: '1 1 0', textAlign: 'center' }}>
                        {i % 2 === 0 ? hour12(h.hour) : ''}
                    </span>
                ))}
            </div>
        </div>
    );
}
