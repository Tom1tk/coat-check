'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useTheme } from 'next-themes';
import RainViewerBackground from './components/RainViewerBackground';
import { useLocation, Location as AppLocation } from './hooks/useLocation';
import { useWeather } from './hooks/useWeather';
import { useSunCalc } from './hooks/useSunCalc';
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
  const { todayWeather, tomorrowWeather, currentHourWeather, refresh: refreshWeather } = useWeather(location);
  const [displayDay, setDisplayDay] = useState<'today' | 'tomorrow'>('today');
  const [fade, setFade] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Auto refresh countdown timer (in minutes)
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  // Track last refresh time for stale data detection
  const lastRefreshTime = useRef<number>(Date.now());

  // Staged fade controls
  const [loadingTextVisible, setLoadingTextVisible] = useState(true);
  const [backgroundVisible, setBackgroundVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Durations and delays (adjust to tweak pacing)
  const FADE_DURATION = 1000; // ms
  const STEP_DELAY = 200; // ms between stages

  // Ref to track if initial auto-theme set has happened to avoid double-fades on load
  const initialThemeSet = useRef(false);
  // Track previous isDay value to detect sunrise/sunset transitions
  const prevIsDay = useRef<boolean | null>(null);

  // Auto-set theme based on location time - smart behavior:
  // - On initial load: set theme to match isDay
  // - On sunrise/sunset transition (isDay changes): auto-switch theme
  // - Manual toggle works freely; auto-switch only triggers on actual transitions
  useEffect(() => {
    if (!initialThemeSet.current) {
      // Initial load: set theme to match current time
      setTheme(isDay ? 'light' : 'dark');
      prevIsDay.current = isDay;
      initialThemeSet.current = true;
    } else if (prevIsDay.current !== null && prevIsDay.current !== isDay) {
      // Sunrise/sunset transition detected: auto-switch theme
      // This respects user's manual override until the next transition
      console.log(`[Theme] Auto-switch: ${prevIsDay.current ? 'sunset' : 'sunrise'} detected`);
      setTheme(isDay ? 'light' : 'dark');
      prevIsDay.current = isDay;
    } else {
      // No transition, just update prevIsDay for tracking (e.g., on wake when time is same)
      prevIsDay.current = isDay;
    }
  }, [isDay, setTheme]);

  const handleRefresh = useCallback(() => {
    setFade(true);
    setTimeout(() => {
      // Trigger data refresh
      refreshWeather();
      // Trigger map rain layer refresh (bust cache)
      setRefreshKey(prev => prev + 1);
      // Track when we last refreshed for stale data detection
      lastRefreshTime.current = Date.now();

      // Wait for "back in after 1 second" (same as fade duration)
      setTimeout(() => {
        setFade(false);
      }, FADE_DURATION);
    }, FADE_DURATION);
  }, [refreshWeather, FADE_DURATION]);

  // Track the last hour we successfully refreshed the data for.
  // We initialize based on the current time:
  // If we are BEFORE minute 1 (e.g. 10:00), we initialize to PREVIOUS hour (9) so that 10:01 triggers a refresh.
  // If we are AFTER minute 1 (e.g. 10:05), we initialize to CURRENT hour (10) because the initial data load is fresh enough.
  const lastRefreshedHour = useRef<number>(
    (() => {
      const now = new Date();
      return now.getMinutes() < 1 ? now.getHours() - 1 : now.getHours();
    })()
  );

  // Robust timer & visibility check
  useEffect(() => {
    const checkRefreshNeeded = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // We only want to refresh if we are past the top of the hour (minute >= 1)
      // AND we haven't refreshed for this hour yet.
      // We also handle the day rollover (currentHour < lastRefreshedHour could happen at midnight).
      // Logic: If currentHour is different from lastRefreshedHour, and minute >= 1, we need update.
      if (currentMinute >= 1 && currentHour !== lastRefreshedHour.current) {
        console.log(`[AutoRefresh] Refreshing! Current: ${currentHour}:${currentMinute}, Last: ${lastRefreshedHour.current}`);
        handleRefresh();
        lastRefreshedHour.current = currentHour;
      }
    };

    const updateTimer = () => {
      const now = new Date();
      const nextHour = new Date(now);

      // If we are already past minute 1, the next refresh is the NEXT hour's minute 1.
      // If we are before minute 1, the next refresh is THIS hour's minute 1.
      if (now.getMinutes() >= 1) {
        nextHour.setHours(now.getHours() + 1);
      }
      nextHour.setMinutes(1, 0, 0);

      const diffMs = nextHour.getTime() - now.getTime();
      const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
      setMinutesLeft(diffMinutes);

      checkRefreshNeeded();
    };

    // Run immediately
    updateTimer();

    // Interval for timer and checks
    const interval = setInterval(updateTimer, 1000);

    // Visibility listener to "catch up" if the tab was suspended
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Force sun calc to recalculate isDay on wake
        setSunCalcTrigger(prev => prev + 1);

        // Check if data is stale (>5 minutes old)
        const now = Date.now();
        const staleDuration = 5 * 60 * 1000; // 5 minutes
        if (now - lastRefreshTime.current > staleDuration) {
          console.log('[Wake] Data stale, forcing refresh');
          handleRefresh();
        } else {
          checkRefreshNeeded();
        }
        // Also update the UI timer immediately
        updateTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleRefresh]);

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
        className={`transition-opacity duration-[${FADE_DURATION}ms] ${backgroundVisible ? 'opacity-100' : 'opacity-0'
          }`}
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
