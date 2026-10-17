'use client';
import type { ReactNode } from 'react';
import type { NowcastSlot } from '@/app/utils/nowcast';
import { clock12, twelveHour } from '@/app/utils/twelveHour';
import { eyebrow, u } from './units';

const BAR_MAX = 64; // tallest bar; the portrait row draws them at half height
const PORTRAIT_SCALE = 0.5;
const FULL_SCALE_MM = 0.5; // per 15 min; heavier slots draw at full height

function barColour(mm: number): string {
    if (mm >= 0.3) return 'var(--rain-hi)';
    if (mm >= 0.01) return 'var(--rain-mid)';
    return 'var(--rain-lo)';
}

const barHeight = (mm: number, max: number) => Math.min(max, Math.max(3, Math.round((mm / FULL_SCALE_MM) * max)));

function Bars({ slots, labels, max }: { slots: NowcastSlot[]; labels: boolean; max: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: u(8), flex: '1 1 0', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: u(8), height: u(max + 6) }}>
                {slots.map((s) => (
                    <div
                        key={s.time}
                        title={`${clock12(s.time)} · ${s.mm} mm`}
                        style={{ flex: '1 1 0', height: u(barHeight(s.mm, max)), borderRadius: `${u(4)} ${u(4)} ${u(2)} ${u(2)}`, background: barColour(s.mm) }}
                    />
                ))}
            </div>
            {labels && (
                <div className="tn" style={{ display: 'flex', gap: u(8), fontSize: u(12), color: 'var(--ink-muted)' }}>
                    {slots.map((s) => (
                        <span key={s.time} style={{ flex: '1 1 0', textAlign: 'center' }}>
                            {twelveHour(s.time).time}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// The next two hours in 15-minute bars, with the radar legend (children) as
// its last row. Landscape: a card top right. Portrait: a slim card in the
// bottom stack, summary beside the bars.
export default function NowcastCard({
    slots,
    summary,
    portrait = false,
    children,
}: {
    slots: NowcastSlot[];
    summary: string;
    portrait?: boolean;
    children?: ReactNode;
}) {
    if (portrait) {
        return (
            <section
                className="kiosk-surface"
                aria-label="Next 2 hours"
                style={{ boxSizing: 'border-box', padding: `${u(14)} ${u(20)}`, borderRadius: u(22), display: 'flex', flexDirection: 'column', gap: u(12), lineHeight: 'normal' }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: u(18) }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: u(4), flex: '0 1 auto', minWidth: 0 }}>
                        <span style={eyebrow}>NEXT 2 HOURS</span>
                        <span style={{ fontSize: u(18), fontWeight: 500 }}>{summary}</span>
                    </div>
                    {slots.length > 0 && <Bars slots={slots} labels={false} max={BAR_MAX * PORTRAIT_SCALE} />}
                </div>
                {children}
            </section>
        );
    }
    return (
        <section
            className="kiosk-surface"
            aria-label="Next 2 hours"
            style={{ position: 'absolute', top: u(32), right: u(32), width: u(400), boxSizing: 'border-box', padding: `${u(20)} ${u(22)}`, borderRadius: u(22), display: 'flex', flexDirection: 'column', gap: u(12), lineHeight: 'normal' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={eyebrow}>NEXT 2 HOURS</span>
                <span style={{ fontSize: u(13), color: 'var(--ink-muted)' }}>rain per 15 min</span>
            </div>
            <span style={{ fontSize: u(22), fontWeight: 500 }}>{summary}</span>
            {slots.length > 0 && <Bars slots={slots} labels max={BAR_MAX} />}
            {children}
        </section>
    );
}
