'use client';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

const REVEAL_MS = 800;

// Fades its children in once, the first time `show` is true (boot only;
// later data swaps happen in place, without fades).
export default function Reveal({ show, style, children }: { show: boolean; style?: CSSProperties; children: ReactNode }) {
    const [shown, setShown] = useState(false);
    useEffect(() => {
        if (!show || shown) return;
        // Wait a frame so the browser paints opacity 0 before transitioning.
        const id = requestAnimationFrame(() => setShown(true));
        return () => cancelAnimationFrame(id);
    }, [show, shown]);
    return <div style={{ ...style, opacity: shown ? 1 : 0, transition: `opacity ${REVEAL_MS}ms ease` }}>{children}</div>;
}
