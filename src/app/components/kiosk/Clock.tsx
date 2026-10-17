'use client';
import type { ReactNode } from 'react';
import { u } from './units';

// Large clock, the date and place beneath it, and the status chip on the right.
export default function Clock({ time, date, place, chip }: { time: string; date: string; place: string; chip: ReactNode }) {
    return (
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: u(12) }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: u(2), minWidth: 0 }}>
                <time className="tn" style={{ fontSize: u(64), fontWeight: 300, lineHeight: 1, letterSpacing: u(-2) }}>
                    {time}
                </time>
                <span style={{ fontSize: u(17), color: 'var(--ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {date} · {place}
                </span>
            </div>
            {chip}
        </header>
    );
}
