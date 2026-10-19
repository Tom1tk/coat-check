'use client';
import { useEffect, useState } from 'react';
import type { DayView } from '@/app/utils/panelModel';
import RainStrip from './RainStrip';
import WindowCard from './WindowCard';
import { eyebrow, u } from './units';

// A tap swaps the day's cards and strip for tomorrow's; it flips back on its own.
const TOMORROW_HOLD_MS = 30_000;
const FADE_MS = 220;

const RESET_BUTTON = { padding: 0, border: 0, background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left' } as const;

// The panel's day section: a line naming the day, its window cards and (in
// landscape) its rain strip. While `shown` is today, the whole section is a
// button that cross-fades to `next` (tomorrow) and back; the line keeps its
// place in both, so nothing shifts but the content itself.
export default function DaySwitch({
    shown,
    next,
    gap,
    portrait,
    startOnNext = false,
}: {
    shown: DayView;
    next: DayView | null;
    gap: string;
    portrait: boolean;
    startOnNext?: boolean;
}) {
    const [wantNext, setWantNext] = useState(startOnNext);
    const [onNext, setOnNext] = useState(startOnNext);
    const target = wantNext && next !== null;
    const fading = target !== onNext;

    // Fade out, swap, fade back in.
    useEffect(() => {
        if (!fading) return;
        const id = setTimeout(() => setOnNext(target), FADE_MS);
        return () => clearTimeout(id);
    }, [fading, target]);

    useEffect(() => {
        if (!wantNext) return;
        const id = setTimeout(() => setWantNext(false), TOMORROW_HOLD_MS);
        return () => clearTimeout(id);
    }, [wantNext]);

    const view = onNext && next ? next : shown;
    const single = view.cards.length === 1;
    const hint = next ? (onNext ? 'tap for today' : 'tap for tomorrow') : null;

    return (
        <button
            type="button"
            disabled={!next}
            aria-pressed={next ? target : undefined}
            aria-label={next ? (target ? 'Showing tomorrow — show today' : 'Show tomorrow') : undefined}
            onClick={() => setWantNext(!target)}
            style={{
                ...RESET_BUTTON,
                cursor: next ? 'pointer' : 'default',
                flex: '1 1 auto',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap,
                opacity: fading ? 0 : 1,
                transition: `opacity ${FADE_MS}ms ease`,
            }}
        >
            <span style={{ display: 'flex', flexDirection: 'column', gap: u(8) }}>
                <span style={{ ...eyebrow, display: 'flex', justifyContent: 'space-between', gap: u(12), whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--ink-sub)' }}>
                        {view.label} · {view.date.toUpperCase()}
                    </span>
                    {hint && <span style={{ letterSpacing: 0, fontWeight: 400 }}>{hint}</span>}
                </span>
                {view.cards.length > 0 && (
                    <span style={{ display: 'grid', gridTemplateColumns: `repeat(${view.cards.length}, minmax(0, 1fr))`, gap: u(portrait ? 10 : 14) }}>
                        {view.cards.map((c) => (
                            <WindowCard key={c.label} card={c} single={single} compact={portrait} />
                        ))}
                    </span>
                )}
            </span>
            {!portrait && <RainStrip day={view.label} hours={view.rain} shading={view.shading} />}
        </button>
    );
}
