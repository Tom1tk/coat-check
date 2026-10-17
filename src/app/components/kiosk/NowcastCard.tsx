'use client';
import type { ReactNode } from 'react';
import type { NowcastSlot } from '@/app/utils/nowcast';
import { eyebrow, u } from './units';

const BAR_AREA = 70;
const BAR_MAX = 64;
const FULL_SCALE_MM = 0.5; // per 15 min; heavier slots draw at full height

function barColour(mm: number): string {
    if (mm >= 0.3) return 'var(--rain-hi)';
    if (mm >= 0.01) return 'var(--rain-mid)';
    return 'var(--rain-lo)';
}

const barHeight = (mm: number) => Math.min(BAR_MAX, Math.max(3, Math.round((mm / FULL_SCALE_MM) * BAR_MAX)));

function Bars({ slots, labels }: { slots: NowcastSlot[]; labels: boolean }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: u(8), flex: '1 1 0', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: u(8), height: u(BAR_AREA) }}>
                {slots.map((s) => (
                    <div
                        key={s.time}
                        title={`${s.time} · ${s.mm} mm`}
                        style={{ flex: '1 1 0', height: u(barHeight(s.mm)), borderRadius: `${u(4)} ${u(4)} ${u(2)} ${u(2)}`, background: barColour(s.mm) }}
                    />
                ))}
            </div>
            {labels && (
                <div className="tn" style={{ display: 'flex', gap: u(8), fontSize: u(12), color: 'var(--ink-muted)' }}>
                    {slots.map((s) => (
                        <span key={s.time} style={{ flex: '1 1 0', textAlign: 'center' }}>
                            {s.time}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

// The next two hours in 15-minute bars, with whatever sits beneath it (the
// radar legend) as children. Landscape: a card top right. Portrait: a slim
// bar in the bottom stack, summary beside the bars and the legend above.
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: u(12) }}>
                {children}
                <section
                    className="kiosk-surface"
                    aria-label="Next 2 hours"
                    style={{ width: '100%', boxSizing: 'border-box', padding: `${u(16)} ${u(20)}`, borderRadius: u(22), display: 'flex', alignItems: 'center', gap: u(18) }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: u(4), flex: '0 1 auto', minWidth: 0 }}>
                        <span style={eyebrow}>NEXT 2 HOURS</span>
                        <span style={{ fontSize: u(20), fontWeight: 500 }}>{summary}</span>
                    </div>
                    {slots.length > 0 && <Bars slots={slots} labels={false} />}
                </section>
            </div>
        );
    }
    return (
        <div style={{ position: 'absolute', top: u(32), right: u(32), width: u(400), display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: u(14) }}>
            <section
                className="kiosk-surface"
                aria-label="Next 2 hours"
                style={{ width: '100%', boxSizing: 'border-box', padding: `${u(20)} ${u(22)}`, borderRadius: u(22), display: 'flex', flexDirection: 'column', gap: u(12) }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={eyebrow}>NEXT 2 HOURS</span>
                    <span style={{ fontSize: u(13), color: 'var(--ink-muted)' }}>rain per 15 min</span>
                </div>
                <span style={{ fontSize: u(22), fontWeight: 500 }}>{summary}</span>
                {slots.length > 0 && <Bars slots={slots} labels />}
            </section>
            {children}
        </div>
    );
}
