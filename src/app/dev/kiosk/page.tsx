'use client';
import { Suspense, useMemo, useState } from 'react';
import { notFound, useSearchParams } from 'next/navigation';
import fixture from '@/app/utils/__fixtures__/forecast-cambridge.json';
import { parseForecast, parseLocal } from '@/app/utils/forecast';
import { panelModel } from '@/app/utils/panelModel';
import { nextTwoHours, nowcastSummary } from '@/app/utils/nowcast';
import { weekRibbon } from '@/app/utils/weekRibbon';
import Panel from '@/app/components/kiosk/Panel';
import NowcastCard from '@/app/components/kiosk/NowcastCard';
import WeekRibbon from '@/app/components/kiosk/WeekRibbon';
import RadarTimestamp from '@/app/components/RadarTimestamp';
import RainViewerBackground from '@/app/components/RainViewerBackground';
import { useMapPadding } from '@/app/hooks/useMapPadding';
import StatusChip from '@/app/components/StatusChip';

// Dev-only review of the kiosk layout against the 014 fixture, no network.
// `?at=YYYY-MM-DDTHH:MM` (location-local) fixes the clock; `?dark` uses G2;
// `?map` adds the live base map (network) to check the padding.
const FORECAST = parseForecast(fixture);
const DEFAULT_AT = FORECAST.current.time;
const CAMBRIDGE = { latitude: 52.2053, longitude: 0.1218 };

function DevKiosk() {
    const params = useSearchParams();
    const at = params.get('at') ?? DEFAULT_AT;
    const dark = params.has('dark');
    const now = useMemo(() => new Date(parseLocal(at).getTime() - FORECAST.utcOffsetSeconds * 1000), [at]);
    const model = useMemo(() => panelModel(FORECAST, now), [now]);
    const days = useMemo(() => weekRibbon(FORECAST, now), [now]);
    const slots = useMemo(() => nextTwoHours(FORECAST, now), [now]);
    const [panel, setPanel] = useState<HTMLElement | null>(null);
    const [ribbon, setRibbon] = useState<HTMLElement | null>(null);
    const padding = useMapPadding(panel, ribbon);
    const newest = { time: Math.floor(now.getTime() / 600_000) * 600, path: '', host: '' };

    return (
        <div className={`kiosk-root fixed inset-0 overflow-hidden ${dark ? 'dark' : ''}`} style={{ background: dark ? '#0b1420' : '#eceeed' }}>
            {params.has('map') && <RainViewerBackground location={CAMBRIDGE} radar={null} fallbackStamp={0} padding={padding} />}
            <div className="absolute inset-0" style={{ background: 'var(--map-tint)' }} />
            <Panel
                ref={setPanel}
                model={model}
                place="Cambridge"
                chip={<StatusChip status={{ tone: 'fresh', text: `Updated ${model.time}`, radarDown: false }} mood={model.mood} />}
            />
            <NowcastCard slots={slots} summary={nowcastSummary(slots)}>
                <RadarTimestamp frame={{ ...newest, time: newest.time - 2400 }} newest={newest} />
            </NowcastCard>
            <WeekRibbon ref={setRibbon} days={days} />
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
