'use client';
import { useEffect, useState, type ReactNode, type Ref } from 'react';
import type { PanelModel } from '@/app/utils/panelModel';
import Clock from './Clock';
import LiveStats from './LiveStats';
import RainStrip from './RainStrip';
import Verdict from './Verdict';
import WindowCard from './WindowCard';
import { RIBBON_HEIGHT, eyebrow, u } from './units';

// The landscape panel stops this far above the full-width week ribbon.
const RIBBON_GAP = 16;

// Landscape: the left panel, above the ribbon. Portrait: a card across the top.
const PLACEMENT = {
    landscape: { left: u(32), top: u(32), bottom: u(32 + RIBBON_HEIGHT + RIBBON_GAP), width: u(440), padding: `${u(30)} ${u(32)}`, gap: u(20) },
    portrait: { left: u(20), top: u(20), right: u(20), padding: `${u(20)} ${u(22)}`, gap: u(14) },
} as const;

// A tap on the cards or strip shows tomorrow's; it flips back on its own.
const TOMORROW_HOLD_MS = 30_000;

const RESET_BUTTON = { padding: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' } as const;

// The glass panel: clock, verdict, live stats, the window cards, today's rain
// strip and the status line at the foot. In portrait it keeps the clock,
// verdict, cards and status, drawn compact so the panel takes about the top
// third; the stats and rain strip don't fit. The cards and strip are one
// button that swaps them for tomorrow's for TOMORROW_HOLD_MS.
export default function Panel({
    model,
    place,
    chip,
    onOpenSettings,
    portrait = false,
    startOnTomorrow = false,
    ref,
}: {
    model: PanelModel;
    place: string;
    chip: ReactNode;
    onOpenSettings?: () => void;
    portrait?: boolean;
    startOnTomorrow?: boolean; // the dev preview's `?tomorrow`
    ref?: Ref<HTMLElement>;
}) {
    const [tomorrow, setTomorrow] = useState(startOnTomorrow);
    useEffect(() => {
        if (!tomorrow) return;
        const id = setTimeout(() => setTomorrow(false), TOMORROW_HOLD_MS);
        return () => clearTimeout(id);
    }, [tomorrow]);

    const day = tomorrow ? model.tomorrow : model;
    const single = day.cards.length === 1;
    const gap = PLACEMENT[portrait ? 'portrait' : 'landscape'].gap;
    return (
        <section
            ref={ref}
            className="kiosk-surface"
            aria-label="Coat forecast"
            style={{
                position: 'absolute',
                ...PLACEMENT[portrait ? 'portrait' : 'landscape'],
                boxSizing: 'border-box',
                borderRadius: u(28),
                display: 'flex',
                flexDirection: 'column',
                lineHeight: 'normal',
                overflow: 'hidden',
            }}
        >
            <Clock time={model.time} date={model.date} place={place} onOpenSettings={onOpenSettings} portrait={portrait} />
            <Verdict heading={model.heading} verdict={model.verdict} text={model.verdictText} compact={portrait} />
            {!portrait && <LiveStats stats={model.stats} change={model.change} />}
            <button
                type="button"
                aria-pressed={tomorrow}
                aria-label={tomorrow ? 'Showing tomorrow — show today' : 'Show tomorrow'}
                onClick={() => setTomorrow((t) => !t)}
                style={{ ...RESET_BUTTON, flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', gap }}
            >
                <span style={{ display: 'flex', flexDirection: 'column', gap: u(8) }}>
                    {tomorrow && (
                        <span style={{ ...eyebrow, display: 'flex', justifyContent: 'space-between', gap: u(12), whiteSpace: 'nowrap' }}>
                            <span style={{ color: 'var(--ink-sub)' }}>TOMORROW · {model.tomorrow.date.toUpperCase()}</span>
                            <span style={{ letterSpacing: 0, fontWeight: 400 }}>tap for today</span>
                        </span>
                    )}
                    {day.cards.length > 0 && (
                        <span style={{ display: 'grid', gridTemplateColumns: `repeat(${day.cards.length}, minmax(0, 1fr))`, gap: u(portrait ? 10 : 14) }}>
                            {day.cards.map((c) => (
                                <WindowCard key={c.label} card={c} single={single} compact={portrait} />
                            ))}
                        </span>
                    )}
                </span>
                {!portrait && <RainStrip day={tomorrow ? model.tomorrow.date.slice(0, 3).toUpperCase() : 'TODAY'} hours={day.rain} shading={day.shading} />}
            </button>
            {chip}
        </section>
    );
}
