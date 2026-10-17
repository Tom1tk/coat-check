import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_AGE_MS, SourceId, isDue } from '../utils/freshness';

const TICK_MS = 30_000;

export interface SourceSpec {
    // Throws on failure; the scheduler owns retry and backoff.
    fetch: () => Promise<void>;
    // When provided, the source owns its success time (e.g. a cached payload);
    // otherwise the scheduler records it.
    lastSuccess?: number | null;
    // Changing the key (e.g. a new location) resets failures and refetches now.
    key?: string;
}

export interface SourceStatus {
    lastSuccess: number | null;
    failures: number;
}

export interface SchedulerState {
    now: number;
    online: boolean;
    sources: Record<SourceId, SourceStatus>;
}

interface Bookkeeping {
    key: string | undefined;
    lastSuccess: number | null;
    lastAttempt: number | null;
    failures: number;
    inFlightKey: string | undefined | null; // null = idle
}

const SOURCE_IDS = Object.keys(MAX_AGE_MS) as SourceId[];

function freshBookkeeping(key: string | undefined): Bookkeeping {
    return { key, lastSuccess: null, lastAttempt: null, failures: 0, inFlightKey: null };
}

function snapshot(books: Record<SourceId, Bookkeeping>, specs: Record<SourceId, SourceSpec>) {
    const sources = {} as Record<SourceId, SourceStatus>;
    for (const id of SOURCE_IDS) {
        const own = specs[id].lastSuccess;
        sources[id] = {
            lastSuccess: own !== undefined ? own : books[id].lastSuccess,
            failures: books[id].failures,
        };
    }
    return sources;
}

// One timer for every data source: every 30 s (and on wake / reconnect) each
// source is refetched if its data is older than its max age, with exponential
// backoff after failures. Nothing here depends on wall-clock hour boundaries.
export function useScheduler(specs: Record<SourceId, SourceSpec>): SchedulerState {
    const specsRef = useRef(specs);
    specsRef.current = specs;

    const booksRef = useRef<Record<SourceId, Bookkeeping> | null>(null);
    if (booksRef.current === null) {
        booksRef.current = Object.fromEntries(
            SOURCE_IDS.map((id) => [id, freshBookkeeping(specs[id].key)])
        ) as Record<SourceId, Bookkeeping>;
    }

    const [state, setState] = useState<SchedulerState>(() => ({
        now: Date.now(),
        online: true,
        sources: snapshot(booksRef.current!, specs),
    }));

    const publish = useCallback(() => {
        setState({
            now: Date.now(),
            online: typeof navigator === 'undefined' ? true : navigator.onLine,
            sources: snapshot(booksRef.current!, specsRef.current),
        });
    }, []);

    const run = useCallback(
        async (id: SourceId) => {
            const book = booksRef.current![id];
            const spec = specsRef.current[id];
            const key = book.key;
            book.inFlightKey = key;
            book.lastAttempt = Date.now();
            try {
                await spec.fetch();
                if (book.key !== key) return; // superseded by a new key
                book.lastSuccess = Date.now();
                book.failures = 0;
            } catch (err) {
                if (book.key !== key) return;
                book.failures += 1;
                console.warn(`[Scheduler] ${id} failed (${book.failures}):`, err);
            } finally {
                if (book.inFlightKey === key) book.inFlightKey = null;
                publish();
            }
        },
        [publish]
    );

    const tick = useCallback(() => {
        const now = Date.now();
        for (const id of SOURCE_IDS) {
            const book = booksRef.current![id];
            const spec = specsRef.current[id];
            if (book.key !== spec.key) {
                booksRef.current![id] = freshBookkeeping(spec.key);
            }
            const current = booksRef.current![id];
            if (current.inFlightKey !== null && current.inFlightKey === current.key) continue;
            const lastSuccess = spec.lastSuccess !== undefined ? spec.lastSuccess : current.lastSuccess;
            if (isDue(now, lastSuccess, current.lastAttempt, current.failures, MAX_AGE_MS[id])) {
                void run(id);
            }
        }
        publish();
    }, [run, publish]);

    useEffect(() => {
        tick();
        const interval = setInterval(tick, TICK_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') tick();
        };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener('online', tick);
        window.addEventListener('offline', publish);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener('online', tick);
            window.removeEventListener('offline', publish);
        };
    }, [tick, publish]);

    // A new key (location change) or an externally-owned success time
    // changing should be acted on now, not at the next 30 s tick.
    const keys = SOURCE_IDS.map((id) => `${specs[id].key ?? ''}|${specs[id].lastSuccess ?? ''}`).join(',');
    useEffect(() => {
        tick();
    }, [keys, tick]);

    return state;
}
