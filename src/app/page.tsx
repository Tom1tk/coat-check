'use client';
import { useEffect, useState, useCallback } from 'react';
import RainViewerBackground from './components/RainViewerBackground';

interface WeatherData {
  morningTemp: number;
  afternoonTemp: number;
  morningRain: number;
  afternoonRain: number;
  morningCondition: string;
  afternoonCondition: string;
  coatAdvice: string;
}

interface Location {
  name: string;
  latitude: number;
  longitude: number;
}


export default function Home() {



  // 🌍 Location state
  const [location, setLocation] = useState<Location>(() => {
    // Only access localStorage in the browser
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('location');
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (error) {
        console.error('Error parsing stored location:', error);
      }
    }
    return {
      name: 'Cambridge',
      latitude: 52.2053,
      longitude: 0.1218,
    };
  });
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);

  interface Suggestion {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
  }
  
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  // Weather states
  const [todayWeather, setTodayWeather] = useState<WeatherData | null>(null);
  const [tomorrowWeather, setTomorrowWeather] = useState<WeatherData | null>(null);
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

  const allWeatherLoaded = todayWeather !== null && tomorrowWeather !== null;
  const allReady = allWeatherLoaded && mapLoaded;

  const codeToCondition = (code: number) => {
    if ([0].includes(code)) return 'Clear';
    if ([1, 2, 3].includes(code)) return 'Cloudy';
    if ([45, 48].includes(code)) return 'Fog';
    if ([51, 53, 55, 61, 63, 65].includes(code)) return 'Rain';
    return 'Other';
  };

  const fetchWeatherForDay = useCallback(async (dayOffset: number): Promise<WeatherData> => {
    const { latitude, longitude } = location;
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation,weathercode&timezone=Europe/London`
    );
    const data = await res.json();

    const dateObj = new Date();
    dateObj.setDate(dateObj.getDate() + dayOffset);
    const dateStr = dateObj.toISOString().split('T')[0];

    const times = data.hourly.time;
    const morningIndex = times.indexOf(`${dateStr}T08:00`);
    const afternoonIndex = times.indexOf(`${dateStr}T17:00`);

    const { temperature_2m, precipitation, weathercode } = data.hourly;

    const morningTemp = temperature_2m[morningIndex];
    const afternoonTemp = temperature_2m[afternoonIndex];
    const morningRain = precipitation[morningIndex];
    const afternoonRain = precipitation[afternoonIndex];

    const morningCondition = codeToCondition(weathercode[morningIndex]);
    const afternoonCondition = codeToCondition(weathercode[afternoonIndex]);

    let coatAdvice = 'No need to bring a coat';
    if (morningRain > 0 || afternoonRain > 0 || morningTemp < 10 || afternoonTemp < 10) {
      coatAdvice = 'Bring a coat';
    } else if (
      (morningTemp >= 10 && morningTemp <= 15 && morningCondition === 'Cloudy') ||
      (afternoonTemp >= 10 && afternoonTemp <= 15 && afternoonCondition === 'Cloudy')
    ) {
      coatAdvice = 'Coat recommended but not necessary';
    }

    return {
      morningTemp,
      afternoonTemp,
      morningRain,
      afternoonRain,
      morningCondition,
      afternoonCondition,
      coatAdvice,
    };
  }, [location]);

  useEffect(() => {
    const fetchAllWeather = async () => {
      const today = await fetchWeatherForDay(0);
      const tomorrow = await fetchWeatherForDay(1);
      setTodayWeather(today);
      setTomorrowWeather(tomorrow);
    };
    fetchAllWeather();
  }, [fetchWeatherForDay]);

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
        className={`transition-opacity duration-[${FADE_DURATION}ms] ${
          backgroundVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <RainViewerBackground location={location} onLoaded={() => setMapLoaded(true)} />
      </div>

      {/* Loading Screen */}
      {!pageVisible && (
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-blue-200 to-blue-300 text-black z-50 transition-opacity duration-[${FADE_DURATION}ms] ${
            loadingTextVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="text-2xl font-semibold animate-pulse">Loading weather data...</p>
        </div>
      )}

      {/* Main Content */}
      {allReady && currentWeather && (
        <>
          <header
            className={`mb-2 text-center transition-opacity duration-[${FADE_DURATION}ms] ${
              pageVisible ? (fade ? 'opacity-0' : 'opacity-100') : 'opacity-0'
            }`}
          >
            <h1 className="text-3xl font-bold text-black">
              Do I Need a Coat{' '}
              <span className="underline cursor-pointer" onClick={handleDayToggle}>
                {displayDay === 'today' ? 'Today' : 'Tomorrow'}
              </span>
              ? 🧥
            </h1>

            {/* 📍 Change Location */}
            <div className="mt-2 flex flex-col text-black items-center">
              <button
                onClick={() => setSearchVisible(!searchVisible)}
                className="underline hover:text-grey"
              >
                📍 Current Location - {location.name}
              </button>

              {searchVisible && (
                <div className="mt-2 flex flex-col items-center bg-white/70 p-3 rounded-xl shadow-lg w-64">
                  <input
                    type="text"
                    placeholder="Enter city name..."
                    value={searchQuery}
                    onChange={async (e) => {
                      setSearchQuery(e.target.value);
                      setErrorMessage('');
                      if (e.target.value.length < 2) {
                        setSuggestions([]);
                        return;
                      }
                      try {
                        const res = await fetch(
                          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
                            e.target.value
                          )}&count=5`
                        );
                        const data = await res.json();
                        if (data.results) setSuggestions(data.results);
                        else setSuggestions([]);
                      } catch (err) {
                        console.error(err);
                        setSuggestions([]);
                      }
                    }}
                    className="border border-gray-300 rounded-md p-2 w-full"
                  />

                  {/* Suggestions dropdown */}
                  {suggestions.length > 0 && (
                    <ul className="mt-1 max-h-40 overflow-y-auto w-full border border-gray-300 rounded-md bg-white">
                      {suggestions.map((s, i) => (
                        <li
                          key={i}
                          className="p-2 cursor-pointer hover:bg-blue-100"
                          onClick={() => {
                            const newLoc = {
                              name: s.name,
                              latitude: s.latitude,
                              longitude: s.longitude,
                            };
                            setLocation(newLoc);
                            if (typeof window !== 'undefined') {
                              localStorage.setItem('location', JSON.stringify(newLoc));
                            }
                            window.location.reload();
                          }}
                        >
                          {s.name}, {s.country}
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Manual search button & error message */}
                  <button
                    onClick={async () => {
                      if (!searchQuery) return;
                      setLoadingLocation(true);
                      try {
                        const res = await fetch(
                          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
                            searchQuery
                          )}&count=1`
                        );
                        const data = await res.json();
                        if (data.results && data.results.length > 0) {
                          const loc = data.results[0];
                          const newLoc = {
                            name: loc.name,
                            latitude: loc.latitude,
                            longitude: loc.longitude,
                          };
                          setLocation(newLoc);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('location', JSON.stringify(newLoc));
                          }
                          window.location.reload();
                        } else {
                          setErrorMessage('Location not found. Try another search.');
                        }
                      } catch (err) {
                        console.error(err);
                        setErrorMessage('Error fetching location data.');
                      } finally {
                        setLoadingLocation(false);
                      }
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-black font-semibold py-1 px-3 rounded-md mt-2"
                  >
                    {loadingLocation ? 'Searching...' : 'Search'}
                  </button>
                  {errorMessage && <p className="text-red-600 mt-1 text-sm">{errorMessage}</p>}
                </div>
              )}
            </div>
          </header>



          <main
            className={`bg-gray-100/60 shadow-md rounded-2xl p-6 w-full max-w-md text-center text-black mx-auto transition-opacity duration-[${FADE_DURATION}ms] ${
              pageVisible ? (fade ? 'opacity-0' : 'opacity-100') : 'opacity-0'
            }`}
          >
            <p>
              <strong>Morning (8:00am):</strong> {currentWeather.morningCondition},{' '}
              {currentWeather.morningTemp}°C, rain {currentWeather.morningRain}mm
            </p>
            <p>
              <strong>Afternoon (5pm):</strong> {currentWeather.afternoonCondition},{' '}
              {currentWeather.afternoonTemp}°C, rain {currentWeather.afternoonRain}mm
            </p>
            <hr className="my-4" />
            <p className="text-xl font-semibold">
              {currentWeather.coatAdvice} {displayDay}
            </p>
          </main>

          {/* Manual Refresh + Countdown */}
          <div
            className={`fixed bottom-4 right-4 flex flex-col items-center space-y-1 transition-opacity duration-500 z-50 ${
              pageVisible ? 'opacity-100' : 'opacity-0'
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
