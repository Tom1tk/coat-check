'use client';
import { useEffect, useState } from 'react';
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

export default function Home() {
  const [todayWeather, setTodayWeather] = useState<WeatherData | null>(null);
  const [tomorrowWeather, setTomorrowWeather] = useState<WeatherData | null>(null);
  const [displayDay, setDisplayDay] = useState<'today' | 'tomorrow'>('today');
  const [fade, setFade] = useState(false);

  // Staged fade controls
  const [loadingTextVisible, setLoadingTextVisible] = useState(true);
  const [backgroundVisible, setBackgroundVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);

  const [mapLoaded, setMapLoaded] = useState(false);

  // Durations and delays (adjust to tweak pacing)
  const FADE_DURATION = 500; // ms
  const STEP_DELAY = 200; // ms between stages

  const allWeatherLoaded = todayWeather !== null && tomorrowWeather !== null;
  const allReady = allWeatherLoaded && mapLoaded;

  const codeToCondition = (code: number) => {
    if ([0].includes(code)) return 'Clear';
    if ([1, 2, 3].includes(code)) return 'Cloudy';
    if ([45, 48].includes(code)) return 'Fog';
    if ([51, 53, 55, 61, 63, 65].includes(code)) return 'Rain';
    return 'Other';
  };

  const fetchWeatherForDay = async (dayOffset: number): Promise<WeatherData> => {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=52.2053&longitude=0.1218&hourly=temperature_2m,precipitation,weathercode&timezone=Europe/London'
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
  };

  useEffect(() => {
    const fetchAllWeather = async () => {
      const today = await fetchWeatherForDay(0);
      const tomorrow = await fetchWeatherForDay(1);
      setTodayWeather(today);
      setTomorrowWeather(tomorrow);
    };
    fetchAllWeather();
  }, []);

  const handleDayToggle = () => {
    setFade(true);
    setTimeout(() => {
      setDisplayDay(displayDay === 'today' ? 'tomorrow' : 'today');
      setFade(false);
    }, 200);
  };

  // 🌟 Staged fade sequence when everything is ready
  useEffect(() => {
    if (allReady) {
      // Fade out loading text
      setTimeout(() => setLoadingTextVisible(false), STEP_DELAY);
      // Fade in background after a short delay
      setTimeout(() => setBackgroundVisible(true), STEP_DELAY * 2);
      // Fade in main content last
      setTimeout(() => setPageVisible(true), STEP_DELAY * 3);
    }
  }, [allReady]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-transparent">
      {/* Map always rendered, just hidden until fade-in */}
      <div
        className={`transition-opacity duration-[${FADE_DURATION}ms] ${
          backgroundVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <RainViewerBackground onLoaded={() => setMapLoaded(true)} />
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

      {/* Main Page Content */}
      {allReady && (
        <>
          <header
            className={`mb-6 text-center transition-opacity duration-[${FADE_DURATION}ms] ${
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
          </header>

          <main
            className={`bg-gray-100/60 shadow-md rounded-2xl p-6 w-full max-w-md text-center text-black mx-auto transition-opacity duration-[${FADE_DURATION}ms] ${
              pageVisible ? (fade ? 'opacity-0' : 'opacity-100') : 'opacity-0'
            }`}
          >
            <p>
              <strong>Morning (8:00am):</strong>{' '}
              {displayDay === 'today'
                ? todayWeather!.morningCondition
                : tomorrowWeather!.morningCondition}
              ,{' '}
              {displayDay === 'today'
                ? todayWeather!.morningTemp
                : tomorrowWeather!.morningTemp}
              °C, rain{' '}
              {displayDay === 'today'
                ? todayWeather!.morningRain
                : tomorrowWeather!.morningRain}
              mm
            </p>
            <p>
              <strong>Afternoon (5pm):</strong>{' '}
              {displayDay === 'today'
                ? todayWeather!.afternoonCondition
                : tomorrowWeather!.afternoonCondition}
              ,{' '}
              {displayDay === 'today'
                ? todayWeather!.afternoonTemp
                : tomorrowWeather!.afternoonTemp}
              °C, rain{' '}
              {displayDay === 'today'
                ? todayWeather!.afternoonRain
                : tomorrowWeather!.afternoonRain}
              mm
            </p>
            <hr className="my-4" />
            <p className="text-xl font-semibold">
              {displayDay === 'today'
                ? `${todayWeather!.coatAdvice} today`
                : `${tomorrowWeather!.coatAdvice} tomorrow`}
            </p>
          </main>
        </>
      )}
    </div>
  );
}
