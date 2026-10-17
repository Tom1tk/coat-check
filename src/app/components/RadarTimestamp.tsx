'use client';
import type { RadarFrame } from '@/app/utils/radarFrames';

// The visible radar frame's time, and how old it is relative to the newest
// frame ("now"), e.g. "13:20 · −40 min". Placement is the caller's.
export default function RadarTimestamp({ frame, newest }: { frame: RadarFrame; newest: RadarFrame }) {
  const minutesBehind = Math.round((newest.time - frame.time) / 60);
  const clock = new Date(frame.time * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="glass-panel rounded-full px-3 py-1 text-xs font-medium tabular-nums" aria-label="Radar frame time">
      {clock} · {minutesBehind === 0 ? 'now' : `−${minutesBehind} min`}
    </div>
  );
}
