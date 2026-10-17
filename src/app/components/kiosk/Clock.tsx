'use client';
import type { ReactNode } from 'react';
import { Settings } from 'lucide-react';
import { twelveHour } from '@/app/utils/twelveHour';
import { u } from './units';

// Large clock, the date and place beneath it (tap the place for settings), and the status chip on the
// right. Portrait is shorter: a smaller clock with the chip beside it, and the
// date line on its own row beneath both.
export default function Clock({
    time,
    date,
    place,
    chip,
    onOpenSettings,
    portrait = false,
}: {
    time: string;
    date: string;
    place: string;
    chip: ReactNode;
    onOpenSettings?: () => void;
    portrait?: boolean;
}) {
    const clock = twelveHour(time);
    const period = (size: number) => (
        <span style={{ fontSize: u(size), letterSpacing: 0, marginLeft: u(4), color: 'var(--ink-sub)' }}>{clock.period}</span>
    );
    const dateLine = (
        <span style={{ display: 'flex', alignItems: 'center', gap: u(5), minWidth: 0, fontSize: u(portrait ? 15 : 17), color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{date} ·</span>
            <button
                type="button"
                onClick={() => onOpenSettings?.()}
                aria-label={`${place} — change location and settings`}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: u(5),
                    padding: 0,
                    border: 0,
                    background: 'none',
                    font: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                    flexShrink: 0,
                }}
            >
                {place}
                <Settings aria-hidden style={{ width: u(portrait ? 15 : 17), height: u(portrait ? 15 : 17), color: 'var(--ink-sub)' }} />
            </button>
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
