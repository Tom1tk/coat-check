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

// A dot and its text; on a pill unless `bg` is omitted (the plain status line).
function Item({ bg, dot, children }: { bg?: string; dot: string; children: React.ReactNode }) {
    return (
        <span
            className="tn"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: u(8),
                minWidth: 0,
                fontSize: u(14),
                color: 'var(--ink-sub)',
                padding: bg ? `${u(6)} ${u(12)}` : 0,
                borderRadius: 999,
                background: bg ?? 'none',
                whiteSpace: 'nowrap',
            }}
        >
            <span aria-hidden style={{ width: u(8), height: u(8), flexShrink: 0, borderRadius: 999, background: dot }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
        </span>
    );
}

// "Updated 7:40am · Overcast" — data freshness, plus the current condition.
// Pills stacked on the right (the loading screen), or `plain`: one row of
// dots and text, the status line at the foot of the panel.
export default function StatusChip({ status, mood, plain = false }: { status: ChipStatus; mood?: string; plain?: boolean }) {
    const tone = TONES[status.tone];
    return (
        <div
            role="status"
            aria-live="polite"
            style={plain ? { display: 'flex', alignItems: 'center', gap: u(16), minWidth: 0 } : { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: u(6) }}
        >
            <Item bg={plain ? undefined : tone.bg} dot={tone.dot}>
                {mood ? `${status.text} · ${mood}` : status.text}
            </Item>
            {status.radarDown && (
                <Item bg={plain ? undefined : 'var(--card)'} dot="var(--ink-muted)">
                    Radar unavailable
                </Item>
            )}
        </div>
    );
}
