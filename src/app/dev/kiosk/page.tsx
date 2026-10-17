'use client';
import { Suspense, useMemo } from 'react';
import { notFound, useSearchParams } from 'next/navigation';
import fixture from '@/app/utils/__fixtures__/forecast-cambridge.json';
import { parseForecast, parseLocal } from '@/app/utils/forecast';
import { panelModel } from '@/app/utils/panelModel';
import Panel from '@/app/components/kiosk/Panel';
import StatusChip from '@/app/components/StatusChip';

// Dev-only review of the kiosk layout against the 014 fixture, no network.
// `?at=YYYY-MM-DDTHH:MM` (location-local) fixes the clock; `?dark` uses G2.
const FORECAST = parseForecast(fixture);
const DEFAULT_AT = FORECAST.current.time;

function DevKiosk() {
    const params = useSearchParams();
    const at = params.get('at') ?? DEFAULT_AT;
    const dark = params.has('dark');
    const now = useMemo(() => new Date(parseLocal(at).getTime() - FORECAST.utcOffsetSeconds * 1000), [at]);
    const model = useMemo(() => panelModel(FORECAST, now), [now]);

    return (
        <div className={`kiosk-root fixed inset-0 overflow-hidden ${dark ? 'dark' : ''}`} style={{ background: dark ? '#0b1420' : '#eceeed' }}>
            <div className="absolute inset-0" style={{ background: 'var(--map-tint)' }} />
            <Panel
                model={model}
                place="Cambridge"
                chip={<StatusChip status={{ tone: 'fresh', text: `Updated ${model.time}`, radarDown: false }} mood={model.mood} />}
            />
        </div>
    );
}

export default function DevKioskPage() {
    if (process.env.NODE_ENV === 'production') notFound();
    return (
        <Suspense>
            <DevKiosk />
        </Suspense>
    );
}
