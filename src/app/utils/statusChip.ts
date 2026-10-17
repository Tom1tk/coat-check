import { Freshness, freshness } from './freshness';

export type ChipTone = 'fresh' | 'stale' | 'offline' | 'starting';

export interface ChipStatus {
    tone: ChipTone;
    text: string;
    radarDown: boolean;
}

export interface ChipInput {
    now: number;
    online: boolean;
    forecastLastSuccess: number | null;
    forecastFailures: number;
    forecastMaxAge: number;
    fromCache: boolean;
    radarFailures: number;
    formatTime: (ms: number) => string;
}

// The one status line that replaces the countdown + refresh button: how old
// the data on screen is, and whether the kiosk is still trying.
export function chipStatus(input: ChipInput): ChipStatus {
    const { now, online, forecastLastSuccess: last, formatTime } = input;
    const radarDown = input.radarFailures > 0;

    if (last === null) {
        return { tone: 'starting', text: online ? 'Starting…' : 'Offline · waiting for network', radarDown };
    }
    if (input.fromCache && input.forecastFailures === 0 && online) {
        return { tone: 'starting', text: `Starting · cached ${formatTime(last)}`, radarDown };
    }

    const state: Freshness = freshness(now, last, input.forecastMaxAge, online);
    if (state === 'offline') {
        return { tone: 'offline', text: `Offline · showing ${formatTime(last)}`, radarDown };
    }
    if (state === 'stale') {
        const minutes = Math.floor((now - last) / 60_000);
        return { tone: 'stale', text: `Updated ${minutes} min ago`, radarDown };
    }
    return { tone: 'fresh', text: `Updated ${formatTime(last)}`, radarDown };
}
