'use client';
import type { ReactNode } from 'react';
import { useLongPress } from '@/app/hooks/useLongPress';
import { twelveHour } from '@/app/utils/twelveHour';
import { u } from './units';

const SETTINGS_HOLD_MS = 3000; // hold the place name this long to open settings

// Large clock, the date and place beneath it, and the status chip on the
// right. Portrait is shorter: a smaller clock with the chip beside it, and the
// date line on its own row beneath both.
export default function Clock({
    time,
    date,
    place,
    chip,
    onPlaceHold,
    portrait = false,
}: {
    time: string;
    date: string;
    place: string;
    chip: ReactNode;
    onPlaceHold?: () => void;
    portrait?: boolean;
}) {
    const clock = twelveHour(time);
    const period = (size: number) => (
        <span style={{ fontSize: u(size), letterSpacing: 0, marginLeft: u(4), color: 'var(--ink-sub)' }}>{clock.period}</span>
    );
    const hold = useLongPress(() => onPlaceHold?.(), SETTINGS_HOLD_MS);
    const dateLine = (
        <span style={{ fontSize: u(portrait ? 15 : 17), color: 'var(--ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {date} · <span {...hold} style={{ touchAction: 'none', userSelect: 'none' }}>{place}</span>
        </span>
    );
    if (portrait) {
        return (
            <header style={{ display: 'flex', flexDirection: 'column', gap: u(4) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: u(12) }}>
                    <time className="tn" style={{ fontSize: u(46), fontWeight: 300, lineHeight: 1, letterSpacing: u(-1.5) }}>
                        {clock.time}
                        {period(17)}
                    </time>
                    {chip}
                </div>
                {dateLine}
            </header>
        );
    }
    return (
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: u(12) }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: u(2), minWidth: 0 }}>
                <time className="tn" style={{ fontSize: u(64), fontWeight: 300, lineHeight: 1, letterSpacing: u(-2) }}>
                    {clock.time}
                    {period(22)}
                </time>
                {dateLine}
            </div>
            {chip}
        </header>
    );
}
