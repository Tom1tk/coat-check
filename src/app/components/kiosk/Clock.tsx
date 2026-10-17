'use client';
import { Settings } from 'lucide-react';
import { twelveHour } from '@/app/utils/twelveHour';
import { u } from './units';

// Large bold clock, the date beneath it, and the place on its own line (tap
// it for settings), so a long place name ellipsizes without pushing the date.
// Portrait draws the same stack smaller.
export default function Clock({
    time,
    date,
    place,
    onOpenSettings,
    portrait = false,
}: {
    time: string;
    date: string;
    place: string;
    onOpenSettings?: () => void;
    portrait?: boolean;
}) {
    const clock = twelveHour(time);
    const line = u(portrait ? 16 : 18);
    return (
        <header style={{ display: 'flex', flexDirection: 'column', gap: u(portrait ? 4 : 6), minWidth: 0 }}>
            <time className="tn" style={{ fontSize: u(portrait ? 54 : 72), fontWeight: 600, lineHeight: 1, letterSpacing: u(-2) }}>
                {clock.time}
                <span style={{ fontSize: u(portrait ? 20 : 26), fontWeight: 500, letterSpacing: 0, marginLeft: u(4), color: 'var(--ink-sub)' }}>{clock.period}</span>
            </time>
            <span style={{ fontSize: line, color: 'var(--ink-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{date}</span>
            <button
                type="button"
                onClick={() => onOpenSettings?.()}
                aria-label={`${place} — change location and settings`}
                style={{
                    alignSelf: 'flex-start',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: u(6),
                    maxWidth: '100%',
                    padding: 0,
                    border: 0,
                    background: 'none',
                    font: 'inherit',
                    fontSize: line,
                    fontWeight: 500,
                    color: 'var(--ink-sub)',
                    cursor: 'pointer',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place}</span>
                <Settings aria-hidden style={{ width: line, height: line, flexShrink: 0 }} />
            </button>
        </header>
    );
}
