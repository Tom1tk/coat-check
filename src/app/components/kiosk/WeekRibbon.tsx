'use client';
import type { Ref } from 'react';
import WeatherIcon from '../WeatherIcon';
import { Wind } from 'lucide-react';
import type { CoatKind, RibbonDay } from '@/app/utils/weekRibbon';
import { RIBBON_HEIGHT, u } from './units';

const RADIUS = 18;
const GAP = 8;
const WEEKEND_MARGIN = 10;

const round1 = (n: number) => Math.round(n * 10) / 10;
const pctColour = (d: RibbonDay) => (d.probability >= 50 ? 'var(--pct-hi)' : 'var(--ink-sub)');

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

const BADGE: Readonly<Record<CoatKind, { bg: string; fg: string }>> = {
    coat: { bg: 'var(--coat-bg)', fg: 'var(--coat-fg)' },
    cold: { bg: 'var(--coat-bg)', fg: 'var(--coat-fg)' },
    layer: { bg: 'var(--ok-bg)', fg: 'var(--ok-fg)' },
    none: { bg: 'transparent', fg: 'transparent' },
};

function Badge({ d, size }: { d: RibbonDay; size: number }) {
    if (!d.coatLabel) return null;
    const badge = BADGE[d.coat];
    return (
        <span style={{ alignSelf: 'flex-start', fontSize: u(size), fontWeight: 600, letterSpacing: u(1), padding: `${u(3)} ${u(9)}`, borderRadius: 999, background: badge.bg, color: badge.fg, whiteSpace: 'nowrap' }}>
            {d.coatLabel}
        </span>
    );
}

// One day cell: name and date; icon beside the high/low and rain; the wind;
// the coat badge, always bottom-left under its own day.
function Day({ d }: { d: RibbonDay }) {
    return (
        <>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: u(6), minWidth: 0, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: u(18), fontWeight: 600 }}>{d.day}</span>
                <span style={{ fontSize: u(13), color: 'var(--ink-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.sub}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: u(12), minWidth: 0 }}>
                <WeatherIcon code={d.code} size={u(40)} strokeWidth={1.5} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: u(4), minWidth: 0 }}>
                    <span className="tn" style={{ fontSize: u(30), fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {Math.round(d.max)}°
                        <span style={{ fontSize: u(20), fontWeight: 300, color: 'var(--ink-muted)' }}> {Math.round(d.min)}°</span>
                    </span>
                    <span className="tn" style={{ fontSize: u(16), fontWeight: 600, whiteSpace: 'nowrap', color: pctColour(d) }}>
                        {d.probability}%{' '}
                        <span style={{ fontSize: u(14), fontWeight: 400, color: 'var(--ink-muted)' }}>{round1(d.precipitation)} mm</span>
                    </span>
                </span>
            </span>
            <span className="tn" style={{ display: 'flex', alignItems: 'center', gap: u(6), minWidth: 0, fontSize: u(14), color: 'var(--ink-sub)', whiteSpace: 'nowrap' }}>
                <Wind aria-hidden style={{ width: u(15), height: u(15), flexShrink: 0, color: 'var(--ink-muted)' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {Math.round(d.wind)} mph · gusts {Math.round(d.gust)}
                </span>
            </span>
            <Badge d={d} size={12} />
        </>
    );
}

// Portrait: seven narrow columns, so the same facts stack — the date and
// rain amount drop out, the low sits beside the high, wind is "14 g26".
function PortraitDay({ d }: { d: RibbonDay }) {
    return (
        <>
            <span style={{ fontSize: u(18), fontWeight: 600, whiteSpace: 'nowrap' }}>{d.day}</span>
            <WeatherIcon code={d.code} size={u(32)} strokeWidth={1.5} />
            <span className="tn" style={{ fontSize: u(26), fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap' }}>
                {Math.round(d.max)}°
                <span style={{ fontSize: u(18), fontWeight: 300, color: 'var(--ink-muted)' }}> {Math.round(d.min)}°</span>
            </span>
            <span className="tn" style={{ fontSize: u(15), fontWeight: 600, whiteSpace: 'nowrap', color: pctColour(d) }}>{d.probability}%</span>
            <span className="tn" style={{ display: 'flex', alignItems: 'center', gap: u(4), minWidth: 0, fontSize: u(13), color: 'var(--ink-sub)', whiteSpace: 'nowrap' }}>
                <Wind aria-hidden style={{ width: u(14), height: u(14), flexShrink: 0, color: 'var(--ink-muted)' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {Math.round(d.wind)} g{Math.round(d.gust)}
                </span>
            </span>
            <Badge d={d} size={11} />
        </>
    );
}

// Landscape: full width along the bottom, under the panel. Portrait: the
// bottom of the stack, which places it.
const PLACEMENT = {
    landscape: { position: 'absolute', left: u(32), right: u(32), bottom: u(32), height: u(RIBBON_HEIGHT) },
    portrait: { position: 'relative' },
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
                padding: u(portrait ? 8 : 14),
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
                        gap: u(portrait ? 7 : 10),
                        padding: portrait ? `${u(12)} ${u(8)}` : `${u(14)} ${u(16)}`,
                        borderRadius: radius(d),
                        background: background(d, i),
                        marginLeft: marginLeft(days, i, GAP),
                    }}
                >
                    {portrait ? <PortraitDay d={d} /> : <Day d={d} />}
                </div>
            ))}
        </section>
    );
}
