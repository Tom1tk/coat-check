'use client';
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
function marginLeft(days: RibbonDay[], i: number): string {
    const d = days[i];
    if (d.weekend === 'end') return u(-GAP);
    const afterWeekend = i > 0 && (days[i - 1].weekend === 'end' || days[i - 1].weekend === 'single');
    const opensWeekend = i > 0 && (d.weekend === 'start' || d.weekend === 'single');
    return afterWeekend || opensWeekend ? u(WEEKEND_MARGIN) : '0';
}

// Today + 6 days along the bottom of the screen.
export default function WeekRibbon({ days }: { days: RibbonDay[] }) {
    return (
        <section
            className="kiosk-surface"
            aria-label="Week ahead"
            style={{
                position: 'absolute',
                left: u(632),
                right: u(32),
                bottom: u(32),
                height: u(280),
                boxSizing: 'border-box',
                padding: u(18),
                borderRadius: u(28),
                display: 'flex',
                gap: u(GAP),
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
                        gap: u(8),
                        padding: `${u(14)} ${u(8)}`,
                        borderRadius: radius(d),
                        background: background(d, i),
                        marginLeft: marginLeft(days, i),
                    }}
                >
                    <span style={{ fontSize: u(18), fontWeight: 600 }}>{d.day}</span>
                    <span style={{ fontSize: u(13), color: 'var(--ink-muted)' }}>{d.sub}</span>
                    <WeatherIcon code={d.code} size={u(40)} strokeWidth={1.5} />
                    <span className="tn" style={{ fontSize: u(30), fontWeight: 500, lineHeight: 1, whiteSpace: 'nowrap' }}>
                        {Math.round(d.max)}°
                        <span style={{ fontSize: u(20), fontWeight: 300, color: 'var(--ink-muted)' }}> {Math.round(d.min)}°</span>
                    </span>
                    <span className="tn" style={{ fontSize: u(17), fontWeight: 600, whiteSpace: 'nowrap', color: d.probability >= 50 ? 'var(--pct-hi)' : 'var(--ink-sub)' }}>
                        {d.probability}%{' '}
                        <span style={{ fontSize: u(14), fontWeight: 400, color: 'var(--ink-muted)' }}>{round1(d.precipitation)} mm</span>
                    </span>
                    <span className="tn" style={{ fontSize: u(14), color: 'var(--ink-sub)', whiteSpace: 'nowrap' }}>
                        {Math.round(d.wind)} · g{Math.round(d.gust)}
                    </span>
                    <span
                        style={{
                            marginTop: 'auto',
                            fontSize: u(12),
                            fontWeight: 600,
                            letterSpacing: u(1),
                            whiteSpace: 'nowrap',
                            color: d.coatLabel ? 'var(--accent-coat)' : 'transparent',
                        }}
                    >
                        {d.coatLabel || '—'}
                    </span>
                </div>
            ))}
        </section>
    );
}
