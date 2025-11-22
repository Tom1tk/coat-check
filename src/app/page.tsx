'use client';
import { useEffect, useState } from 'react';
import RainViewerBackground from './components/RainViewerBackground';
import { useLocation } from './hooks/useLocation';
import { useWeather } from './hooks/useWeather';
import Header from './components/Header';
import WeatherCard from './components/WeatherCard';
import CurrentWeatherCard from './components/CurrentWeatherCard';
import LoadingScreen from './components/LoadingScreen';

export default function Home() {
  // 🌍 Location state
  const { location, updateLocation } = useLocation();

  // Weather states
  const { todayWeather, tomorrowWeather, currentHourWeather } = useWeather(location);
  const [displayDay, setDisplayDay] = useState<'today' | 'tomorrow'>('today');
  const [fade, setFade] = useState(false);

  // Auto refresh countdown timer (in minutes)
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  // Staged fade controls
  const [loadingTextVisible, setLoadingTextVisible] = useState(true);
  const [backgroundVisible, setBackgroundVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Durations and delays (adjust to tweak pacing)
  const FADE_DURATION = 600; // ms
  const STEP_DELAY = 200; // ms between stages

  // Countdown + full refresh at X:01 every hour
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getMinutes() >= 1 ? now.getHours() + 1 : now.getHours());
      nextHour.setMinutes(1, 0, 0);

      const diffMs = nextHour.getTime() - now.getTime();
      const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
      setMinutesLeft(diffMinutes);

      if (now.getMinutes() === 1 && now.getSeconds() === 0) {
        window.location.reload();
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const allWeatherLoaded = currentHourWeather !== null && todayWeather !== null && tomorrowWeather !== null;
  const allReady = allWeatherLoaded && mapLoaded;

  const handleDayToggle = () => {
    setFade(true);
    setTimeout(() => {
      setDisplayDay(displayDay === 'today' ? 'tomorrow' : 'today');
      setFade(false);
    }, 200);
  };

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
        <RainViewerBackground location={location} onLoaded={() => setMapLoaded(true)} />
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
            setLocation={updateLocation}
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

          {/* Manual Refresh + Countdown */}
          <div
            className={`fixed bottom-4 right-4 flex flex-col items-center space-y-1 transition-opacity duration-500 z-50 ${pageVisible ? 'opacity-100' : 'opacity-0'
              }`}
          >
            <p className="text-xs text-black bg-white/60 px-2 py-1 rounded-md shadow-sm">
              {minutesLeft !== null
                ? `Auto Refresh in: 0:${minutesLeft.toString().padStart(2, '0')}`
                : ''}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-white/60 hover:bg-blue-100/60 text-black font-bold py-2 px-4 rounded-full shadow-lg"
              title="Refresh weather and map"
            >
              🔄 Refresh
            </button>
          </div>
        </>
      )}
    </div>
  );
}
