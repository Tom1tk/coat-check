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

  // Utility function to convert weather code to human-readable condition
  const codeToCondition = (code: number) => {
    if ([0].includes(code)) return 'Clear';
    if ([1, 2, 3].includes(code)) return 'Cloudy';
    if ([45, 48].includes(code)) return 'Fog';
    if ([51, 53, 55, 61, 63, 65].includes(code)) return 'Rain';
    return 'Other';
  };

  // Fetch weather for a specific day
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

  // Pre-fetch both today's and tomorrow's weather on mount
  useEffect(() => {
    const fetchAllWeather = async () => {
      const today = await fetchWeatherForDay(0);
      const tomorrow = await fetchWeatherForDay(1);
      setTodayWeather(today);
      setTomorrowWeather(tomorrow);
    };
    fetchAllWeather();
  }, []);

  // Function to handle click on title to toggle day with fade effect
  const handleDayToggle = () => {
    setFade(true); // start fade-out
    setTimeout(() => {
      setDisplayDay(displayDay === 'today' ? 'tomorrow' : 'today'); // change day
      setFade(false); // fade back in
    }, 200); // match duration of CSS transition
  };

  const currentWeather = displayDay === 'today' ? todayWeather : tomorrowWeather;

  if (!currentWeather) return <p className="text-center mt-20">Loading weather data...</p>;

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-transparent">
      <RainViewerBackground />

      {/* Title Section */}
      <header className="mb-6 text-center transition-opacity duration-200">
        <h1
          className={`text-3xl font-bold text-black ${
            fade ? 'opacity-0' : 'opacity-100'
          }`}
        >
          Do I Need a Coat{' '}
          <span
            className="underline cursor-pointer"
            onClick={handleDayToggle}
          >
            {displayDay === 'today' ? 'Today' : 'Tomorrow'}
          </span>
          ? 🧥
        </h1>
      </header>

      {/* Weather Info Box */}
      <main
        className={`bg-gray-100/60 shadow-md rounded-2xl p-6 w-full max-w-md text-center text-black mx-auto transition-opacity duration-200 ${
          fade ? 'opacity-0' : 'opacity-100'
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
    </div>
  );
}
