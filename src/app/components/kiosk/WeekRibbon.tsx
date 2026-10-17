'use client';
import type { Ref } from 'react';
import WeatherIcon from '../WeatherIcon';
import type { RibbonDay } from '@/app/utils/weekRibbon';
import { u } from './units';

const RADIUS = 18;
const GAP = 8;
const WEEKEND_MARGIN = 10;

const round1 = (n: number) => Math.round(n * 10) / 10;

function background(d: RibbonDay, i: number): string {
    if (d.weekend) return 'var(--weekend-tint)';
    return i === 0 ? 'var(--today-tint)' : 'transparent';
}

function radius(d: RibbonDay): string {
    if (d.weekend === 'start') return `${u(RADIUS)} 0 0 ${u(RADIUS)}`;
    if (d.weekend === 'end') return `0 ${u(RADIUS)} ${u(RADIUS)} 0`;
    return u(RADIUS);
}

// 'end' cancels the gap so Sat+Sun read as one block; the block gets a little
// air on each side.
function marginLeft(days: RibbonDay[], i: number, gap: number): string {
    const d = days[i];
    if (d.weekend === 'end') return u(-gap);
    const afterWeekend = i > 0 && (days[i - 1].weekend === 'end' || days[i - 1].weekend === 'single');
    const opensWeekend = i > 0 && (d.weekend === 'start' || d.weekend === 'single');
    return afterWeekend || opensWeekend ? u(WEEKEND_MARGIN) : '0';
}

// Landscape: the full day column. Portrait: narrow columns, so the date,
// rain amount and wind drop out and the low sits under the high.
function Day({ d, portrait }: { d: RibbonDay; portrait: boolean }) {
    const pct = (
        <span className="tn" style={{ fontSize: u(portrait ? 15 : 17), fontWeight: 600, whiteSpace: 'nowrap', color: d.probability >= 50 ? 'var(--pct-hi)' : 'var(--ink-sub)' }}>
            {d.probability}%
            {!portrait && (
                <>
                    {' '}
                    <span style={{ fontSize: u(14), fontWeight: 400, color: 'var(--ink-muted)' }}>{round1(d.precipitation)} mm</span>
                </>
            )}
        </span>
    );
    const coat = (
        <span
            style={{
                marginTop: 'auto',
                fontSize: u(portrait ? 11 : 12),
                fontWeight: 600,
                letterSpacing: u(1),
                whiteSpace: 'nowrap',
                color: d.coatLabel ? 'var(--accent-coat)' : 'transparent',
            }}
        >
            {d.coatLabel || '—'}
        </span>
    );
    if (portrait) {
        return (
            <>
                <span style={{ fontSize: u(17), fontWeight: 600 }}>{d.day}</span>
                <WeatherIcon code={d.code} size={u(32)} strokeWidth={1.5} />
                <span className="tn" style={{ fontSize: u(26), fontWeight: 500, lineHeight: 1 }}>{Math.round(d.max)}°</span>
                <span className="tn" style={{ fontSize: u(18), fontWeight: 300, lineHeight: 1, color: 'var(--ink-muted)' }}>{Math.round(d.min)}°</span>
                {pct}
                {coat}
            </>
        );
    }
    return (
        <>
            <span style={{ fontSize: u(18), fontWeight: 600 }}>{d.day}</span>
            <span style={{ fontSize: u(13), color: 'var(--ink-muted)' }}>{d.sub}</span>
            <WeatherIcon code={d.code} size={u(40)} strokeWidth={1.5} />
            <span className="tn" style={{ fontSize: u(30), fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap' }}>
                {Math.round(d.max)}°
                <span style={{ fontSize: u(20), fontWeight: 300, color: 'var(--ink-muted)' }}> {Math.round(d.min)}°</span>
            </span>
            {pct}
            <span className="tn" style={{ fontSize: u(14), color: 'var(--ink-sub)', whiteSpace: 'nowrap' }}>
                {Math.round(d.wind)} · g{Math.round(d.gust)}
            </span>
            {coat}
        </>
    );
}

// Landscape: along the bottom, right of the panel. Portrait: the bottom of
// the stack, which places it.
const PLACEMENT = {
    landscape: { position: 'absolute', left: u(632), right: u(32), bottom: u(32), height: u(280), padding: u(18) },
    portrait: { position: 'relative', padding: u(10) },
} as const;

// Today + 6 days.
export default function WeekRibbon({ days, portrait = false, ref }: { days: RibbonDay[]; portrait?: boolean; ref?: Ref<HTMLElement> }) {
    return (
        <section
            ref={ref}
            className="kiosk-surface"
            aria-label="Week ahead"
            style={{
                ...PLACEMENT[portrait ? 'portrait' : 'landscape'],
                boxSizing: 'border-box',
                borderRadius: u(28),
                display: 'flex',
                gap: u(portrait ? 4 : GAP),
            }}
        >
            {days.map((d, i) => (
                <div
                    key={d.date}
                    style={{
                        flex: '1 1 0',
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: u(portrait ? 6 : 8),
                        padding: portrait ? `${u(12)} 0` : `${u(14)} ${u(8)}`,
                        borderRadius: radius(d),
                        background: background(d, i),
                        marginLeft: marginLeft(days, i, portrait ? 4 : GAP),
                    }}
                >
                    <Day d={d} portrait={portrait} />
                </div>
            ))}
        </section>
    );
}
