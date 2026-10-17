import React from 'react';
import { ChipStatus, ChipTone } from '../utils/statusChip';

// Dot colours per tone — inline styles, since Tailwind can't see class names
// assembled at runtime.
const TONE_COLOURS: Record<ChipTone, string> = {
    fresh: '#22c55e',
    stale: '#f59e0b',
    offline: '#ef4444',
    starting: '#94a3b8',
};

const RADAR_DOWN_COLOUR = '#94a3b8';

export default function StatusChip({ status }: { status: ChipStatus }) {
    return (
        <div
            role="status"
            aria-live="polite"
            className="glass-panel px-3 py-1 rounded-md shadow-sm flex flex-col items-end gap-0.5 text-xs text-black dark:text-white text-legible"
        >
            <span className="flex items-center gap-1.5 tabular-nums">
                <span
                    aria-hidden
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: TONE_COLOURS[status.tone] }}
                />
                {status.text}
            </span>
            {status.radarDown && (
                <span className="flex items-center gap-1.5">
                    <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: RADAR_DOWN_COLOUR }}
                    />
                    Radar unavailable
                </span>
            )}
        </div>
    );
}
