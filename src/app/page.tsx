'use client';
import { useEffect, useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import RainViewerBackground from './components/RainViewerBackground';
import { useLocation, Location as AppLocation } from './hooks/useLocation';
import { useWeather } from './hooks/useWeather';
import { useSunCalc } from './hooks/useSunCalc';
import { useAutoTheme } from './hooks/useAutoTheme';
import { useScheduler } from './hooks/useScheduler';
import { useRadar } from './hooks/useRadar';
import { useClock } from './hooks/useClock';
import { MAX_AGE_MS } from './utils/freshness';
import { chipStatus } from './utils/statusChip';
import StatusChip from './components/StatusChip';
import Header from './components/Header';
import WeatherCard from './components/WeatherCard';
import CurrentWeatherCard from './components/CurrentWeatherCard';
import LoadingScreen from './components/LoadingScreen';
import ZoomControl from './components/ZoomControl';
import ThemeToggle from './components/ThemeToggle';

export default function Home() {
  // 🌍 Location state
  const { location, updateLocation } = useLocation();

  // 🕰️ Minute clock: drives the sunrise/sunset check and the card roll-over
  const now = useClock();

  // Weather + radar data, kept fresh by data age (no reloads, no input)
  const weather = useWeather(location, now);

  // ☀️ Day/night from the forecast's sunrise/sunset, re-checked every minute
  const { isDay } = useSunCalc(weather.forecast, now);
  const { setTheme, resolvedTheme } = useTheme();
  const { todayWeather, tomorrowWeather, currentHourWeather } = weather;
  const radar = useRadar();
  const scheduler = useScheduler({
    forecast: { fetch: weather.fetcher, lastSuccess: weather.lastSuccess, key: weather.key },
    radar: { fetch: radar.fetcher },
  });
  const [displayDay, setDisplayDay] = useState<'today' | 'tomorrow'>('today');
  const [fade, setFade] = useState(false);

  // Staged fade controls
  const [loadingTextVisible, setLoadingTextVisible] = useState(true);
  const [backgroundVisible, setBackgroundVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Durations and delays (adjust to tweak pacing)
  const FADE_DURATION = 1000; // ms
  const STEP_DELAY = 200; // ms between stages

  useAutoTheme(isDay, setTheme);

  const allWeatherLoaded = currentHourWeather !== null && todayWeather !== null && tomorrowWeather !== null;
  // The map never gates the UI: it fades in by itself once loaded.
  const allReady = allWeatherLoaded;

  const handleDayToggle = () => {
    setFade(true);
    setTimeout(() => {
      setDisplayDay(displayDay === 'today' ? 'tomorrow' : 'today');
      setFade(false);
    }, 200);
  };

  const handleLocationUpdate = (newLoc: AppLocation) => {
    setFade(true);
    // Wait for fade out to complete
    setTimeout(() => {
      // The theme follows once the new location's forecast arrives (useAutoTheme).
      updateLocation(newLoc);

      // Wait for flyover (2000ms) + buffer (250ms)
      setTimeout(() => {
        setFade(false);
      }, 2250);
    }, FADE_DURATION);
  };

  const handleThemeToggle = () => {
    setFade(true);
    setTimeout(() => {
      setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
      setTimeout(() => {
        setFade(false);
      }, FADE_DURATION); // Wait a bit before fading back in to allow map style swap to start
    }, FADE_DURATION);
  };

  const [zoomLevel, setZoomLevel] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('zoomLevel');
      return stored ? parseInt(stored) : 8;
    }
    return 8;
  });

  useEffect(() => {
    localStorage.setItem('zoomLevel', zoomLevel.toString());
  }, [zoomLevel]);

  // One-time cleanup of the retired hourly-refresh bookkeeping (plan 013).
  useEffect(() => {
    try {
      localStorage.removeItem('lastRefreshedHour');
      localStorage.removeItem('lastRefreshedDate');
    } catch {
      // storage unavailable (private mode) — nothing to clean up
    }
  }, []);

  // 🌟 Staged fade sequence
  useEffect(() => {
    if (!allReady) return;
    const timers = [
      setTimeout(() => setLoadingTextVisible(false), STEP_DELAY),
      setTimeout(() => setPageVisible(true), STEP_DELAY * 3),
    ];
    return () => timers.forEach(clearTimeout);
  }, [allReady]);

  // The map fades in on its own schedule, independent of the weather.
  useEffect(() => {
    if (!mapLoaded) return;
    const timer = setTimeout(() => setBackgroundVisible(true), STEP_DELAY * 2);
    return () => clearTimeout(timer);
  }, [mapLoaded]);

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
        formatTime: (ms) =>
          new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      }),
    [now, scheduler, weather.fromCache]
  );

  const currentWeather = displayDay === 'today' ? todayWeather : tomorrowWeather;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-transparent">
      {/* Map */}
      <div
        className={`transition-opacity ${backgroundVisible ? 'opacity-100' : 'opacity-0'
          }`}
        style={{ transitionDuration: `${FADE_DURATION}ms` }}
      >
        <RainViewerBackground
          location={location}
          onLoaded={() => setMapLoaded(true)}
          zoom={zoomLevel}
          radar={radar.source}
          fallbackStamp={radar.fallbackStamp}
        />
      </div>

      {/* Loading Screen */}
      {!pageVisible && <LoadingScreen visible={loadingTextVisible} FADE_DURATION={FADE_DURATION} />}

      {/* Data status — visible from boot, above the loading screen */}
      <div className="fixed bottom-4 right-4 z-[60]">
        <StatusChip status={status} />
      </div>

      {/* Main Content */}
      {allReady && currentWeather && (
        <>
          <Header
            displayDay={displayDay}
            handleDayToggle={handleDayToggle}
            location={location}
            setLocation={handleLocationUpdate}
            fade={fade}
            pageVisible={pageVisible}
            FADE_DURATION={FADE_DURATION}
          />

          <WeatherCard
            weather={currentWeather}
            displayDay={displayDay}
            fade={fade}
            pageVisible={pageVisible}
            FADE_DURATION={FADE_DURATION}
          />

          {/* Current Hour Weather Box */}
          {currentHourWeather && (
            <CurrentWeatherCard
              weather={currentHourWeather}
              fade={fade}
              pageVisible={pageVisible}
              FADE_DURATION={FADE_DURATION}
            />
          )}


          {/* Zoom Control (above the status chip) */}
          <div
            className={`fixed bottom-16 right-4 transition-opacity duration-500 z-50 ${pageVisible ? 'opacity-100' : 'opacity-0'
              }`}
          >
            <ZoomControl currentZoom={zoomLevel} onZoomChange={setZoomLevel} />
          </div>

          {/* Theme Toggle Button (Bottom Left) */}
          <div
            className={`fixed bottom-4 left-4 transition-opacity duration-500 z-50 ${pageVisible ? 'opacity-100' : 'opacity-0'}`}
          >
            <ThemeToggle onToggle={handleThemeToggle} />
          </div>
        </>
      )}
    </div>
  );
}
