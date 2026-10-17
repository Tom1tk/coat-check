// The screen shows 12-hour times; the models keep the API's "HH:MM" (which
// sorts and compares as text) and convert only for display.

export interface TwelveHour {
    time: string; // "2:05"
    period: 'am' | 'pm';
}

export function twelveHour(hhmm: string): TwelveHour {
    const [h, m] = hhmm.split(':').map(Number);
    return { time: `${h % 12 || 12}:${String(m).padStart(2, '0')}`, period: h < 12 ? 'am' : 'pm' };
}

// "14:05" → "2:05pm"
export function clock12(hhmm: string): string {
    const { time, period } = twelveHour(hhmm);
    return `${time}${period}`;
}

// "07:30", "09:00" → "7:30–9:00am"; across noon, "11:30am–1:00pm".
export function range12(start: string, end: string): string {
    const a = twelveHour(start);
    const b = twelveHour(end);
    return a.period === b.period ? `${a.time}–${b.time}${b.period}` : `${a.time}${a.period}–${b.time}${b.period}`;
}

// 14 → "2pm", 0 → "12am"
export function hour12(h: number): string {
    return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
}

// The viewer's local wall clock at `ms`, e.g. "2:05pm".
export function clock12At(ms: number): string {
    const d = new Date(ms);
    return clock12(`${d.getHours()}:${d.getMinutes()}`);
}
