'use client';
import type { ReactNode, Ref } from 'react';
import type { PanelModel } from '@/app/utils/panelModel';
import Clock from './Clock';
import LiveStats from './LiveStats';
import RainStrip from './RainStrip';
import Verdict from './Verdict';
import WindowCard from './WindowCard';
import { u } from './units';

// The left glass panel of boards G1/G2.
export default function Panel({ model, place, chip, ref }: { model: PanelModel; place: string; chip: ReactNode; ref?: Ref<HTMLElement> }) {
    return (
        <section
            ref={ref}
            className="kiosk-surface"
            aria-label="Coat forecast"
            style={{
                position: 'absolute',
                left: u(32),
                top: u(32),
                bottom: u(32),
                width: u(576),
                boxSizing: 'border-box',
                padding: `${u(34)} ${u(36)}`,
                borderRadius: u(28),
                display: 'flex',
                flexDirection: 'column',
                gap: u(26),
                overflow: 'hidden',
            }}
        >
            <Clock time={model.time} date={model.date} place={place} chip={chip} />
            <Verdict heading={model.heading} verdict={model.verdict} text={model.verdictText} reason={model.reason} />
            {model.cards.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${model.cards.length}, minmax(0, 1fr))`, gap: u(14) }}>
                    {model.cards.map((c) => (
                        <WindowCard key={c.label} card={c} />
                    ))}
                </div>
            )}
            <LiveStats stats={model.stats} change={model.change} />
            <RainStrip hours={model.rain} shading={model.shading} />
        </section>
    );
}
