'use client';
import { useEffect, useMemo, useState } from 'react';
import RainViewerBackground from './components/RainViewerBackground';
import LoadingScreen from './components/LoadingScreen';
import StatusChip from './components/StatusChip';
import Panel from './components/kiosk/Panel';
import NowcastCard from './components/kiosk/NowcastCard';
import WeekRibbon from './components/kiosk/WeekRibbon';
import SettingsSheet from './components/kiosk/SettingsSheet';
import Reveal from './components/kiosk/Reveal';
import { u } from './components/kiosk/units';
import { useLocation } from './hooks/useLocation';
import { useKioskParams } from './hooks/useKioskParams';
import { useZoom } from './hooks/useZoom';
import { useWeather } from './hooks/useWeather';
import { useMood } from './hooks/useMood';
import { useScheduler } from './hooks/useScheduler';
import { useRadar } from './hooks/useRadar';
import { useClock } from './hooks/useClock';
import { useMapPadding } from './hooks/useMapPadding';
import { usePortrait } from './hooks/usePortrait';
import { MAX_AGE_MS } from './utils/freshness';
import { chipStatus } from './utils/statusChip';
import { panelModel } from './utils/panelModel';
import { nextTwoHours, nowcastSummary } from './utils/nowcast';
import { weekRibbon } from './utils/weekRibbon';
import { burnInOffset } from './utils/burnIn';
import { paletteFor } from './utils/moodPalettes';

const formatTime = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

// The kiosk: map behind, panel left, nowcast top-right, week along the
// bottom. On a portrait screen (layout B) the panel spans the top and the
// nowcast bar and week stack along the bottom, with the map between. Runs unattended — data refresh is the scheduler's job, and settings
// stay off-screen unless opened by `?settings` or a hold on the place name.
export default function Home() {
  const params = useKioskParams();
  const stored = useLocation();
  const location = params.location ?? stored.location;
  const { zoom, setZoom } = useZoom(params.zoom);
  // null until toggled: follows `?settings`, which only arrives after hydration.
  const [settingsToggled, setSettingsOpen] = useState<boolean | null>(null);
  const settingsOpen = settingsToggled ?? params.settings;

  const now = useClock();
  const weather = useWeather(location, now);
  const radar = useRadar();
  const scheduler = useScheduler({
    forecast: { fetch: weather.fetcher, lastSuccess: weather.lastSuccess, key: weather.key },
    radar: { fetch: radar.fetcher },
  });

  const mood = useMood(weather.forecast, now);

  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [bottom, setBottom] = useState<HTMLElement | null>(null);
  const [legend, setLegend] = useState<HTMLElement | null>(null);
  const portrait = usePortrait();
  const padding = useMapPadding(panel, bottom, portrait);

  // One-time cleanup of the retired hourly-refresh bookkeeping (plan 013).
  useEffect(() => {
    try {
      localStorage.removeItem('lastRefreshedHour');
      localStorage.removeItem('lastRefreshedDate');
    } catch {
      // storage unavailable (private mode) — nothing to clean up
    }
  }, []);

  const status = useMemo(
    () =>
      chipStatus({
        now,
        online: scheduler.online,
        forecastLastSuccess: scheduler.sources.forecast.lastSuccess,
        forecastFailures: scheduler.sources.forecast.failures,
        forecastMaxAge: MAX_AGE_MS.forecast,
        fromCache: weather.fromCache,
        radarFailures: scheduler.sources.radar.failures,
        formatTime,
      }),
    [now, scheduler, weather.fromCache]
  );

  // Everything on screen, derived from the forecast for this minute. Null
  // until a forecast that covers "now" arrives (live or cached).
  const view = useMemo(() => {
    const f = weather.forecast;
    if (!f || !weather.currentHourWeather) return null;
    const at = new Date(now);
    const slots = nextTwoHours(f, at);
    return { model: panelModel(f, at), days: weekRibbon(f, at), slots, summary: nowcastSummary(slots) };
  }, [weather.forecast, weather.currentHourWeather, now]);

  const shift = burnInOffset(now);

  return (
    <main className="kiosk-root fixed inset-0 overflow-hidden" style={{ background: 'var(--background)' }}>
      <RainViewerBackground
        location={location}
        zoom={zoom}
        radar={radar.source}
        fallbackStamp={radar.fallbackStamp}
        padding={padding}
        legendTarget={legend}
        dark={mood?.dark ?? false}
        tint={mood ? paletteFor(mood.mood, mood.dark).tokens['map-tint'] : null}
      />

      {!view && <LoadingScreen chip={<StatusChip status={status} />} />}

      <Reveal show={view !== null} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: `translate(${shift.x}px, ${shift.y}px)` }}>
        {view && (
          <div className="kiosk-layer">
            <Panel
              ref={setPanel}
              model={view.model}
              place={location.name}
              chip={<StatusChip status={status} mood={view.model.mood} />}
              onPlaceHold={() => setSettingsOpen(true)}
              portrait={portrait}
            />
            {portrait ? (
              <div ref={setBottom} style={{ position: 'absolute', left: u(20), right: u(20), bottom: u(20), display: 'flex', flexDirection: 'column', gap: u(12) }}>
                <NowcastCard slots={view.slots} summary={view.summary} portrait>
                  <div ref={setLegend} />
                </NowcastCard>
                <WeekRibbon days={view.days} portrait />
              </div>
            ) : (
              <>
                <NowcastCard slots={view.slots} summary={view.summary}>
                  <div ref={setLegend} />
                </NowcastCard>
                <WeekRibbon ref={setBottom} days={view.days} />
              </>
            )}
          </div>
        )}
      </Reveal>

      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        location={location}
        setLocation={stored.updateLocation}
        locationPinned={params.location !== null}
        zoom={zoom}
        setZoom={setZoom}
        zoomPinned={params.zoom !== null}
        portrait={portrait}
      />
    </main>
  );
}
