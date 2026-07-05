'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import RainViewerBackground from './components/RainViewerBackground';
import { useLocation, Location as AppLocation } from './hooks/useLocation';
import { useWeather } from './hooks/useWeather';
import { useSunCalc } from './hooks/useSunCalc';
import { useAutoTheme } from './hooks/useAutoTheme';
import { useAutoRefresh } from './hooks/useAutoRefresh';
import Header from './components/Header';
import WeatherCard from './components/WeatherCard';
import CurrentWeatherCard from './components/CurrentWeatherCard';
import LoadingScreen from './components/LoadingScreen';
import SpotlightCard from './components/SpotlightCard';
import ZoomControl from './components/ZoomControl';
import ThemeToggle from './components/ThemeToggle';

export default function Home() {
  // 🌍 Location state
  const { location, updateLocation } = useLocation();

  // ☀️ Sun/Moon Calc - with trigger to force recalculation on tab wake
  const [sunCalcTrigger, setSunCalcTrigger] = useState(0);
  const { isDay } = useSunCalc(location.latitude, location.longitude, sunCalcTrigger);
  const { setTheme, resolvedTheme } = useTheme();

  // Weather states
  const { todayWeather, tomorrowWeather, currentHourWeather, refresh: refreshWeather, error } = useWeather(location);
  const [displayDay, setDisplayDay] = useState<'today' | 'tomorrow'>('today');
  const [fade, setFade] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Staged fade controls
  const [loadingTextVisible, setLoadingTextVisible] = useState(true);
  const [backgroundVisible, setBackgroundVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Durations and delays (adjust to tweak pacing)
  const FADE_DURATION = 1000; // ms
  const STEP_DELAY = 200; // ms between stages

  useAutoTheme(isDay, setTheme);

  // handleRefresh (below) needs the hook's notifyManualRefresh, and
  // useAutoRefresh (below) needs handleRefresh as its onRefresh argument —
  // a genuine circular dependency. Bridge it with a ref kept fresh every
  // render so handleRefresh always calls the current notifyManualRefresh
  // without needing it in its own dependency array.
  const notifyManualRefreshRef = useRef<() => void>(() => {});

  // Manual refresh handler - ALWAYS forces full refresh, bypassing all staleness checks
  const handleRefresh = useCallback(() => {
    setFade(true);
    setTimeout(() => {
      // Trigger weather data refresh
      refreshWeather();
      // Trigger map rain layer refresh (bust cache)
      setRefreshKey(prev => prev + 1);
      // Trigger sun calc recalculation (updates isDay/theme if needed)
      setSunCalcTrigger(prev => prev + 1);
      // Update stored hour state so auto-refresh knows we just refreshed
      notifyManualRefreshRef.current();

      // Wait for fade duration before fading back in
      setTimeout(() => {
        setFade(false);
      }, FADE_DURATION);
    }, FADE_DURATION);
  }, [refreshWeather, FADE_DURATION]);

  const handleSunRecalc = useCallback(() => setSunCalcTrigger(prev => prev + 1), []);

  const { minutesLeft, notifyManualRefresh } = useAutoRefresh(handleRefresh, handleSunRecalc);
  notifyManualRefreshRef.current = notifyManualRefresh;

  const allWeatherLoaded = currentHourWeather !== null && todayWeather !== null && tomorrowWeather !== null;
  const allReady = allWeatherLoaded && mapLoaded;

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
      updateLocation(newLoc);

      // Calculate isDay for the NEW location immediately to switch theme while hidden
      // Note: We can't use the hook value 'isDay' here yet because 'location' state hasn't propagated to the hook re-render.
      // Use suncalc directly (already imported via useSunCalc's underlying usage)
      import('suncalc').then((SunCalc) => {
        const now = new Date();
        const times = SunCalc.default.getTimes(now, newLoc.latitude, newLoc.longitude);
        const newIsDay = now >= times.sunrise && now < times.sunset;
        setTheme(newIsDay ? 'light' : 'dark');
      });

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

  // 🌟 Staged fade sequence
  useEffect(() => {
    if (allReady) {
      setTimeout(() => setLoadingTextVisible(false), STEP_DELAY);
      setTimeout(() => setBackgroundVisible(true), STEP_DELAY * 2);
      setTimeout(() => setPageVisible(true), STEP_DELAY * 3);
    }
  }, [allReady]);

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
          refreshKey={refreshKey}
        />
      </div>

      {/* Loading Screen */}
      {!pageVisible && <LoadingScreen visible={loadingTextVisible} FADE_DURATION={FADE_DURATION} />}

      {/* Weather fetch error */}
      {error && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <SpotlightCard className="glass-panel rounded-2xl p-6 max-w-md text-center text-black dark:text-white">
            <p className="font-semibold">{error}</p>
            <button
              onClick={() => refreshWeather()}
              className="mt-4 bg-blue-500 hover:bg-blue-600 text-black font-semibold py-1 px-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              Retry
            </button>
          </SpotlightCard>
        </div>
      )}

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


          {/* Manual Refresh + Countdown + Zoom Control */}
          <div
            className={`fixed bottom-4 right-4 flex flex-col items-center space-y-2 transition-opacity duration-500 z-50 ${pageVisible ? 'opacity-100' : 'opacity-0'
              }`}
          >
            <ZoomControl currentZoom={zoomLevel} onZoomChange={setZoomLevel} />

            <SpotlightCard className="glass-panel px-3 py-1 rounded-md shadow-sm">
              <p className="text-xs text-black dark:text-white">
                {minutesLeft !== null
                  ? `Auto Refresh in: 0:${minutesLeft.toString().padStart(2, '0')}`
                  : ''}
              </p>
            </SpotlightCard>

            <SpotlightCard
              onClick={handleRefresh}
              className="glass-panel cursor-pointer hover:bg-blue-100/20 text-black dark:text-white font-bold py-2 px-4 rounded-full shadow-lg flex items-center justify-center"
              title="Refresh weather and map"
            >
              🔄 Refresh
            </SpotlightCard>
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
