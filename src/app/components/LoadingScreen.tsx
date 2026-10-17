import type { ReactNode } from 'react';
import { u } from './kiosk/units';

// Shown until the first forecast (cached or live) arrives; the status chip
// rides along so a kiosk that can't reach the network says so.
export default function LoadingScreen({ chip }: { chip: ReactNode }) {
    return (
        <div
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: u(20) }}
        >
            <p className="animate-pulse" style={{ fontFamily: 'var(--font-display)', fontSize: u(56), color: 'var(--ink)' }}>
                Checking the sky…
            </p>
            {chip}
        </div>
    );
}
