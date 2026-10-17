'use client';
import { Suspense, useMemo, useState } from 'react';
import { notFound, useSearchParams } from 'next/navigation';
import fixture from '@/app/utils/__fixtures__/forecast-cambridge.json';
import { isDaytime, parseForecast, parseLocal } from '@/app/utils/forecast';
import { getMood, isDarkMood, Mood, MOODS } from '@/app/utils/mood';
import { paletteFor } from '@/app/utils/moodPalettes';
import { useMoodAttributes } from '@/app/hooks/useMood';
import { panelModel } from '@/app/utils/panelModel';
import { nextTwoHours, nowcastSummary } from '@/app/utils/nowcast';
import { weekRibbon } from '@/app/utils/weekRibbon';
import Panel from '@/app/components/kiosk/Panel';
import NowcastCard from '@/app/components/kiosk/NowcastCard';
import WeekRibbon from '@/app/components/kiosk/WeekRibbon';
import RadarTimestamp from '@/app/components/RadarTimestamp';
import RainViewerBackground from '@/app/components/RainViewerBackground';
import { useMapPadding } from '@/app/hooks/useMapPadding';
import { usePortrait } from '@/app/hooks/usePortrait';
import { u } from '@/app/components/kiosk/units';
import StatusChip from '@/app/components/StatusChip';
import SettingsSheet from '@/app/components/kiosk/SettingsSheet';

// Dev-only review of the kiosk layout against the 014 fixture, no network.
// `?at=YYYY-MM-DDTHH:MM` (location-local) fixes the clock; `?mood=<mood>`
// previews a weather mood (otherwise the fixture's own at that time) and
// `?dark` its after-sunset variant; `?map` adds the live base map (network) to check the padding; `?settings`
// opens the settings sheet (also: hold the place name for 3 s).
const FORECAST = parseForecast(fixture);
const DEFAULT_AT = FORECAST.current.time;
const CAMBRIDGE = { name: 'Cambridge', latitude: 52.2053, longitude: 0.1218 };

function DevKiosk() {
    const params = useSearchParams();
    const at = params.get('at') ?? DEFAULT_AT;
    const now = useMemo(() => new Date(parseLocal(at).getTime() - FORECAST.utcOffsetSeconds * 1000), [at]);
    const asked = params.get('mood');
    const mood: Mood = MOODS.find((m) => m === asked) ?? getMood(FORECAST, now);
    const dark = isDarkMood(mood, !params.has('dark') && isDaytime(FORECAST, now));
    const palette = paletteFor(mood, dark);
    useMoodAttributes({ mood, dark });
    const model = useMemo(() => panelModel(FORECAST, now), [now]);
    const days = useMemo(() => weekRibbon(FORECAST, now), [now]);
    const slots = useMemo(() => nextTwoHours(FORECAST, now), [now]);
    const [panel, setPanel] = useState<HTMLElement | null>(null);
    const [bottom, setBottom] = useState<HTMLElement | null>(null);
    const portrait = usePortrait();
    const padding = useMapPadding(panel, bottom, portrait);
    const [settings, setSettings] = useState(() => params.has('settings'));
    const [zoom, setZoom] = useState(8);
    const newest = { time: Math.floor(now.getTime() / 600_000) * 600, path: '', host: '' };
    const legend = <RadarTimestamp frame={{ ...newest, time: newest.time - 2400 }} newest={newest} />;

    return (
        <div className="kiosk-root fixed inset-0 overflow-hidden" style={{ background: `linear-gradient(135deg, ${palette.bg[0]}, ${palette.bg[1]})` }}>
            {params.has('map') && (
                <RainViewerBackground
                    location={CAMBRIDGE}
                    radar={null}
                    fallbackStamp={0}
                    padding={padding}
                    dark={dark}
                    tint={palette.tokens['map-tint']}
                />
            )}
            <Panel
                ref={setPanel}
                model={model}
                place="Cambridge"
                onPlaceHold={() => setSettings(true)}
                chip={<StatusChip status={{ tone: 'fresh', text: `Updated ${model.time}`, radarDown: false }} mood={model.mood} />}
                portrait={portrait}
            />
            {portrait ? (
                <div ref={setBottom} style={{ position: 'absolute', left: u(20), right: u(20), bottom: u(20), display: 'flex', flexDirection: 'column', gap: u(12) }}>
                    <NowcastCard slots={slots} summary={nowcastSummary(slots)} portrait>
                        {legend}
                    </NowcastCard>
                    <WeekRibbon days={days} portrait />
                </div>
            ) : (
                <>
                    <NowcastCard slots={slots} summary={nowcastSummary(slots)}>
                        {legend}
                    </NowcastCard>
                    <WeekRibbon ref={setBottom} days={days} />
                </>
            )}
            <SettingsSheet
                open={settings}
                onClose={() => setSettings(false)}
                location={CAMBRIDGE}
                setLocation={() => setSettings(false)}
                locationPinned={false}
                zoom={zoom}
                setZoom={setZoom}
                zoomPinned={false}
                portrait={portrait}
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
