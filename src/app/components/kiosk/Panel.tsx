'use client';
import type { ReactNode, Ref } from 'react';
import type { PanelModel } from '@/app/utils/panelModel';
import Clock from './Clock';
import LiveStats from './LiveStats';
import RainStrip from './RainStrip';
import Verdict from './Verdict';
import WindowCard from './WindowCard';
import { RIBBON_HEIGHT, u } from './units';

// The landscape panel stops this far above the full-width week ribbon.
const RIBBON_GAP = 16;

// Landscape: the left panel, above the ribbon. Portrait: a card across the top.
const PLACEMENT = {
    landscape: { left: u(32), top: u(32), bottom: u(32 + RIBBON_HEIGHT + RIBBON_GAP), width: u(440), padding: `${u(30)} ${u(32)}`, gap: u(20) },
    portrait: { left: u(20), top: u(20), right: u(20), padding: `${u(20)} ${u(22)}`, gap: u(14) },
} as const;

// The glass panel: clock, verdict, live stats, the window cards, today's rain
// strip and the status line at the foot. In portrait it keeps the clock,
// verdict, cards and status, drawn compact so the panel takes about the top
// third; the stats and rain strip don't fit.
export default function Panel({
    model,
    place,
    chip,
    onOpenSettings,
    portrait = false,
    ref,
}: {
    model: PanelModel;
    place: string;
    chip: ReactNode;
    onOpenSettings?: () => void;
    portrait?: boolean;
    ref?: Ref<HTMLElement>;
}) {
    const single = model.cards.length === 1;
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
            {model.cards.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${model.cards.length}, minmax(0, 1fr))`, gap: u(portrait ? 10 : 14) }}>
                    {model.cards.map((c) => (
                        <WindowCard key={c.label} card={c} single={single} compact={portrait} />
                    ))}
                </div>
            )}
            {!portrait && <RainStrip hours={model.rain} shading={model.shading} />}
            {chip}
        </section>
    );
}
