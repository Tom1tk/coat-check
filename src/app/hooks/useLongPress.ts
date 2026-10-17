import { useEffect, useRef } from 'react';

// Pointer handlers that fire `onLongPress` after the pointer is held for `ms`.
// Lifting, leaving or cancelling before then does nothing.
export function useLongPress(onLongPress: () => void, ms: number) {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cancel = () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
    };
    useEffect(() => cancel, []);
    return {
        onPointerDown: () => {
            cancel();
            timer.current = setTimeout(onLongPress, ms);
        },
        onPointerUp: cancel,
        onPointerLeave: cancel,
        onPointerCancel: cancel,
        onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    };
}
