'use client';
import type { RadarFrame } from '@/app/utils/radarFrames';
import { clock12At } from '@/app/utils/twelveHour';
import { u } from './kiosk/units';

// RainViewer's colour scale, light rain → heavy, as a key.
const SCALE = 'linear-gradient(90deg, #8fd8f0, #2fa7e0, #0b62b8, #f2b632)';

// The radar legend, the last row of the 2-hour card: the colour key, the
// visible frame's time and how old it is relative to the newest frame, e.g.
// "Radar 1:20pm · −40 min".
export default function RadarTimestamp({ frame, newest }: { frame: RadarFrame; newest: RadarFrame }) {
    const minutesBehind = Math.round((newest.time - frame.time) / 60);
    const clock = clock12At(frame.time * 1000);
    return (
        <div
            className="tn"
            aria-label="Radar frame time"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: u(10),
                paddingTop: u(12),
                borderTop: '1px solid var(--divider)',
                fontSize: u(13),
                color: 'var(--ink-sub)',
                whiteSpace: 'nowrap',
            }}
        >
            <span aria-hidden style={{ flex: '1 1 0', height: u(6), borderRadius: u(3), background: SCALE }} />
            Radar {clock} · {minutesBehind === 0 ? 'now' : `−${minutesBehind} min`}
        </div>
    );
}
