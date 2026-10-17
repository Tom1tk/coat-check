import React from 'react';
import { ChipStatus, ChipTone } from '../utils/statusChip';
import { u } from './kiosk/units';

// Pill background and dot per tone — inline styles, since Tailwind can't see
// class names assembled at runtime.
const TONES: Readonly<Record<ChipTone, { bg: string; dot: string }>> = {
    fresh: { bg: 'var(--ok-bg)', dot: 'var(--ok-fg)' },
    stale: { bg: 'var(--card)', dot: '#f59e0b' },
    offline: { bg: 'var(--card)', dot: '#ef4444' },
    starting: { bg: 'var(--card)', dot: 'var(--ink-muted)' },
};

function Pill({ bg, dot, children }: { bg: string; dot: string; children: React.ReactNode }) {
    return (
        <span
            className="tn"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: u(8),
                fontSize: u(14),
                color: 'var(--ink-sub)',
                padding: `${u(6)} ${u(12)}`,
                borderRadius: 999,
                background: bg,
                whiteSpace: 'nowrap',
            }}
        >
            <span aria-hidden style={{ width: u(8), height: u(8), borderRadius: 999, background: dot }} />
            {children}
        </span>
    );
}

// "Updated 07:40 · Overcast" — data freshness, plus the current condition.
export default function StatusChip({ status, mood }: { status: ChipStatus; mood?: string }) {
    const tone = TONES[status.tone];
    return (
        <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: u(6) }}>
            <Pill bg={tone.bg} dot={tone.dot}>
                {mood ? `${status.text} · ${mood}` : status.text}
            </Pill>
            {status.radarDown && (
                <Pill bg="var(--card)" dot="var(--ink-muted)">
                    Radar unavailable
                </Pill>
            )}
        </div>
    );
}
