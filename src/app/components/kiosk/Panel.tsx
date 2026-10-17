'use client';
import type { ReactNode, Ref } from 'react';
import type { PanelModel } from '@/app/utils/panelModel';
import Clock from './Clock';
import LiveStats from './LiveStats';
import RainStrip from './RainStrip';
import Verdict from './Verdict';
import WindowCard from './WindowCard';
import { u } from './units';

// Landscape: the full-height left panel. Portrait: a card across the top.
const PLACEMENT = {
    landscape: { left: u(32), top: u(32), bottom: u(32), width: u(576), padding: `${u(34)} ${u(36)}`, gap: u(26) },
    portrait: { left: u(20), top: u(20), right: u(20), padding: `${u(28)} ${u(28)}`, gap: u(22) },
} as const;

// The glass panel of boards G1/G2. In portrait (layout B) it keeps the clock,
// verdict and window cards; the live stats and rain strip don't fit.
export default function Panel({
    model,
    place,
    chip,
    onPlaceHold,
    portrait = false,
    ref,
}: {
    model: PanelModel;
    place: string;
    chip: ReactNode;
    onPlaceHold?: () => void;
    portrait?: boolean;
    ref?: Ref<HTMLElement>;
}) {
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
                overflow: 'hidden',
            }}
        >
            <Clock time={model.time} date={model.date} place={place} chip={chip} onPlaceHold={onPlaceHold} portrait={portrait} />
            <Verdict heading={model.heading} verdict={model.verdict} text={model.verdictText} reason={model.reason} />
            {model.cards.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${model.cards.length}, minmax(0, 1fr))`, gap: u(14) }}>
                    {model.cards.map((c) => (
                        <WindowCard key={c.label} card={c} />
                    ))}
                </div>
            )}
            {!portrait && (
                <>
                    <LiveStats stats={model.stats} change={model.change} />
                    <RainStrip hours={model.rain} shading={model.shading} />
                </>
            )}
        </section>
    );
}
