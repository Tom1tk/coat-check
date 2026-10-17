// Burn-in protection for an always-on screen: shift the whole layout by
// 0–2 px on each axis, stepping every 4 minutes. Derived from the clock, so
// there is no state to keep.
export const BURN_IN_STEP_MS = 4 * 60_000;
const POSITIONS = 3; // offsets 0, 1, 2 px

export function burnInOffset(nowMs: number): { x: number; y: number } {
    const step = Math.floor(nowMs / BURN_IN_STEP_MS);
    return { x: step % POSITIONS, y: Math.floor(step / POSITIONS) % POSITIONS };
}
