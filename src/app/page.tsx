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
      const currentHour = new Date().getHours();
      lastRefreshedHour.current = currentHour;
      localStorage.setItem('lastRefreshedHour', currentHour.toString());
      localStorage.setItem('lastRefreshedDate', new Date().toDateString());

      // Wait for fade duration before fading back in
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

  // ============================================
  // ROBUST REFRESH SYSTEM
  // Hybrid approach: Hour-based staleness + Heartbeat suspension detection
  // ============================================

  // Heartbeat: Updated every 30 seconds while page is active
  // If heartbeat is stale (>60s old), the page was suspended
  const lastHeartbeat = useRef<number>(Date.now());
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  const HEARTBEAT_TOLERANCE = 60000; // 1 minute - if heartbeat older than this, we were suspended

  // Persist last refreshed hour to localStorage for browser restart detection
  useEffect(() => {
    // On mount, restore last refreshed hour from localStorage
    const storedHour = localStorage.getItem('lastRefreshedHour');
    const storedDate = localStorage.getItem('lastRefreshedDate');
    const today = new Date().toDateString();

    if (storedHour && storedDate === today) {
      lastRefreshedHour.current = parseInt(storedHour, 10);
    }
  }, []);

  // Save to localStorage whenever we refresh
  const saveRefreshState = useCallback((hour: number) => {
    lastRefreshedHour.current = hour;
    localStorage.setItem('lastRefreshedHour', hour.toString());
    localStorage.setItem('lastRefreshedDate', new Date().toDateString());
  }, []);

  // Check if we need to refresh based on hour crossing
  const checkHourBasedRefresh = useCallback(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Refresh if: we're past minute 0 AND hour has changed since last refresh
    // This handles: hourly updates, day rollovers, multi-hour gaps
    if (currentMinute >= 1 && currentHour !== lastRefreshedHour.current) {
      console.log(`[AutoRefresh] Hour changed! Current: ${currentHour}:${currentMinute}, Last refreshed hour: ${lastRefreshedHour.current}`);
      handleRefresh();
      saveRefreshState(currentHour);
      return true;
    }
    return false;
  }, [handleRefresh, saveRefreshState]);

  // Detect suspension via heartbeat staleness
  const checkSuspensionAndRefresh = useCallback(() => {
    const now = Date.now();
    const heartbeatAge = now - lastHeartbeat.current;

    if (heartbeatAge > HEARTBEAT_TOLERANCE) {
      console.log(`[Wake] Suspension detected! Heartbeat was ${Math.round(heartbeatAge / 1000)}s old`);
      // Reset heartbeat
      lastHeartbeat.current = now;
      // Check if hour changed while suspended
      checkHourBasedRefresh();
      return true;
    }
    return false;
  }, [checkHourBasedRefresh]);

  // Unified wake handler - triggered by multiple events
  const handleWake = useCallback(() => {
    console.log('[Wake] Page became active');

    // Force sun calc to recalculate isDay
    setSunCalcTrigger(prev => prev + 1);

    // First, check if we were suspended (heartbeat stale)
    const wasSuspended = checkSuspensionAndRefresh();

    // If not suspended, still check if hour has changed
    if (!wasSuspended) {
      checkHourBasedRefresh();
    }

    // Reset heartbeat since we're now active
    lastHeartbeat.current = Date.now();
  }, [checkSuspensionAndRefresh, checkHourBasedRefresh]);

  // Main timer effect
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const nextHour = new Date(now);

      // Calculate next refresh time (minute 1 of next hour if past minute 1, else minute 1 of this hour)
      if (now.getMinutes() >= 1) {
        nextHour.setHours(now.getHours() + 1);
      }
      nextHour.setMinutes(1, 0, 0);

      const diffMs = nextHour.getTime() - now.getTime();
      const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
      setMinutesLeft(diffMinutes);
    };

    // Run timer update immediately
    updateTimer();

    // Check for hour-based refresh on mount (handles browser restart with cached page)
    checkHourBasedRefresh();

    // Timer interval - update countdown every second
    const timerInterval = setInterval(updateTimer, 1000);

    // Hourly check interval - more reliable than relying on exact timing
    const hourlyCheckInterval = setInterval(() => {
      checkHourBasedRefresh();
    }, 60000); // Check every minute

    // Heartbeat interval - keeps heartbeat fresh while page is active
    const heartbeatInterval = setInterval(() => {
      lastHeartbeat.current = Date.now();
    }, HEARTBEAT_INTERVAL);

    // === Multiple event listeners for maximum wake detection ===

    // 1. visibilitychange - main event for tab switching
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWake();
        updateTimer();
      }
    };

    // 2. focus - catches window focus without visibility change
    const handleFocus = () => {
      handleWake();
      updateTimer();
    };

    // 3. pageshow - catches back-forward cache restoration
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('[Wake] Page restored from BFCache');
        handleWake();
        updateTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      clearInterval(timerInterval);
      clearInterval(hourlyCheckInterval);
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [handleWake, checkHourBasedRefresh]);

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
