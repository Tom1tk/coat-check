'use client';
import type { ReactNode } from 'react';
import { useLongPress } from '@/app/hooks/useLongPress';
import { u } from './units';

const SETTINGS_HOLD_MS = 3000; // hold the place name this long to open settings

// Large clock, the date and place beneath it, and the status chip on the
// right. In portrait the chip takes more of the width, so the date line wraps
// rather than cutting off the place name.
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
    const hold = useLongPress(() => onPlaceHold?.(), SETTINGS_HOLD_MS);
    return (
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: u(12) }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: u(2), minWidth: 0 }}>
                <time className="tn" style={{ fontSize: u(64), fontWeight: 300, lineHeight: 1, letterSpacing: u(-2) }}>
                    {time}
                </time>
                <span style={{ fontSize: u(17), color: 'var(--ink-muted)', ...(portrait ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }) }}>
                    {date} · <span {...hold} style={{ touchAction: 'none', userSelect: 'none' }}>{place}</span>
                </span>
            </div>
            {chip}
        </header>
    );
}
