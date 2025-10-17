'use client';
import { useEffect, useState } from 'react';
import RainViewerBackground from './components/RainViewerBackground';


// Define the shape of weather data used in state
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
  // State to hold weather information
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    // Fetch weather data and update state
    async function getWeather() {
      // Call Open-Meteo API for hourly weather data
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.2053&longitude=0.1218&hourly=temperature_2m,precipitation,weathercode&timezone=Europe/London');
      const data = await res.json();

      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];

      // Find indices for 8:00am and 5:00pm in the hourly data
      const times = data.hourly.time;
      const morningIndex = times.indexOf(`${today}T08:00`);
      const afternoonIndex = times.indexOf(`${today}T17:00`);

      // Destructure relevant arrays for easier access
      const { temperature_2m, precipitation, weathercode } = data.hourly;

      // Get temperature and precipitation for morning and afternoon
      const morningTemp = temperature_2m[morningIndex];
      const afternoonTemp = temperature_2m[afternoonIndex];
      const morningRain = precipitation[morningIndex];
      const afternoonRain = precipitation[afternoonIndex];

      // Convert weather code to human-readable condition
      const codeToCondition = (code: number) => {
        if ([0].includes(code)) return 'Clear';
        if ([1, 2, 3].includes(code)) return 'Cloudy';
        if ([45, 48].includes(code)) return 'Fog';
        if ([51, 53, 55, 61, 63, 65].includes(code)) return 'Rain';
        return 'Other';
      };

      // Get weather condition for morning and afternoon
      const morningCondition = codeToCondition(weathercode[morningIndex]);
      const afternoonCondition = codeToCondition(weathercode[afternoonIndex]);

      // Determine coat advice based on weather
      let coatAdvice = 'No need to bring a coat :)';
      if (morningRain > 0 || afternoonRain > 0 || morningTemp < 10 || afternoonTemp < 10) {
        coatAdvice = 'Bring a Coat';
      } else if (
        (morningTemp >= 10 && morningTemp <= 15 && morningCondition === 'Cloudy') ||
        (afternoonTemp >= 10 && afternoonTemp <= 15 && afternoonCondition === 'Cloudy')
      ) {
        coatAdvice = 'Coat recommended but not necessary';
      }

      // Update state with weather data
      setWeather({
        morningTemp,
        afternoonTemp,
        morningRain,
        afternoonRain,
        morningCondition,
        afternoonCondition,
        coatAdvice,
      });
    }

    // Trigger weather fetch on mount
    getWeather();
  }, []);

  // Show loading message while weather data is being fetched
  if (!weather) return <p className="text-center mt-20">Loading weather data...</p>;

  // Render weather information and coat advice
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-transparent">
      <RainViewerBackground /> 

      <main className="flex flex-col justify-center items-center min-h-screen text-center bg-transparent text-black">
        <h1 className="text-3xl font-bold mb-4">Do I Need a Coat today? 🧥</h1>

        <div className="bg-gray-100 shadow-md rounded-2xl p-6 w-full max-w-md sm:max-w-lg md:max-w-xl">
          <p><strong>Morning (8:00am):</strong> {weather.morningCondition}, {weather.morningTemp}°C, rain {weather.morningRain}mm</p>
          <p><strong>Afternoon (5pm):</strong> {weather.afternoonCondition}, {weather.afternoonTemp}°C, rain {weather.afternoonRain}mm</p>
          <hr className="my-4" />
          <p className="text-xl font-semibold">{weather.coatAdvice}</p>
        </div>
      </main>
    </div>
  );
}
