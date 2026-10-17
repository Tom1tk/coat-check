import type { CSSProperties, ReactNode } from 'react';

// Fades its children in once, when `show` first turns true (boot only; later
// data swaps happen in place). A CSS animation, so it needs no state or frame
// callbacks and never replays on re-render.
export default function Reveal({ show, style, children }: { show: boolean; style?: CSSProperties; children: ReactNode }) {
    return <div style={{ ...style, ...(show ? { animation: 'kiosk-reveal 800ms ease both' } : { opacity: 0 }) }}>{children}</div>;
}
