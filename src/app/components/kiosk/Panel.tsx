'use client';
import type { ReactNode, Ref } from 'react';
import type { PanelModel } from '@/app/utils/panelModel';
import Clock from './Clock';
import DaySwitch from './DaySwitch';
import LiveStats from './LiveStats';
import Verdict from './Verdict';
import { RIBBON_HEIGHT, u } from './units';

// The landscape panel stops this far above the full-width week ribbon.
const RIBBON_GAP = 16;

// Landscape: the left panel, above the ribbon. Portrait: a card across the top.
const PLACEMENT = {
    landscape: { left: u(32), top: u(32), bottom: u(32 + RIBBON_HEIGHT + RIBBON_GAP), width: u(440), padding: `${u(30)} ${u(32)}`, gap: u(20) },
    portrait: { left: u(20), top: u(20), right: u(20), padding: `${u(20)} ${u(22)}`, gap: u(14) },
} as const;

// The glass panel: clock, verdict, live stats, the window cards, the day's rain
// strip and the status line at the foot. In portrait it keeps the clock,
// verdict, cards and status, drawn compact so the panel takes about the top
// third; the stats and rain strip don't fit. The cards and strip are the
// DaySwitch, which a tap turns to tomorrow's.
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
            <DaySwitch shown={model.shown} next={model.next} gap={gap} portrait={portrait} startOnNext={startOnTomorrow} />
            {chip}
        </section>
    );
}
