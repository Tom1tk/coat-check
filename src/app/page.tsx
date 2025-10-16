'use client';
import { useEffect, useState } from 'react';

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
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    async function getWeather() {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=52.2053&longitude=0.1218&hourly=temperature_2m,precipitation,weathercode&timezone=Europe/London');
      const data = await res.json();

      // Get hours for 8:00am and 5pm (in UTC adjusted)
      const morningIndex = data.hourly.time.indexOf(`${new Date().toISOString().split('T')[0]}T08:00`);
      const afternoonIndex = data.hourly.time.indexOf(`${new Date().toISOString().split('T')[0]}T17:00`);

      const morningTemp = data.hourly.temperature_2m[morningIndex];
      const afternoonTemp = data.hourly.temperature_2m[afternoonIndex];
      const morningRain = data.hourly.precipitation[morningIndex];
      const afternoonRain = data.hourly.precipitation[afternoonIndex];

      const codeToCondition = (code: number) => {
        if ([0].includes(code)) return 'Clear';
        if ([1, 2, 3].includes(code)) return 'Cloudy';
        if ([45, 48].includes(code)) return 'Fog';
        if ([51, 53, 55, 61, 63, 65].includes(code)) return 'Rain';
        return 'Other';
      };

      const morningCondition = codeToCondition(data.hourly.weathercode[morningIndex]);
      const afternoonCondition = codeToCondition(data.hourly.weathercode[afternoonIndex]);

      // Determine coat advice
      let coatAdvice = 'No need to bring a coat :)';
      if (morningRain > 0 || afternoonRain > 0 || morningTemp < 10 || afternoonTemp < 10) {
        coatAdvice = 'Bring a Coat';
      } else if (
        (morningTemp >= 10 && morningTemp <= 15 && morningCondition === 'Cloudy') ||
        (afternoonTemp >= 10 && afternoonTemp <= 15 && afternoonCondition === 'Cloudy')
      ) {
        coatAdvice = 'Coat recommended but not necessary';
      }

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

    getWeather();
  }, []);

  if (!weather) return <p className="text-center mt-20">Loading weather data...</p>;

  return (
    <main className="flex flex-col justify-center items-center min-h-screen text-center bg-white text-black">
      <h1 className="text-3xl font-bold mb-4">Do I Need a Coat? 🧥</h1>

      <div className="bg-gray-100 shadow-md rounded-2xl p-6 w-full max-w-md sm:max-w-lg md:max-w-xl">
        <p><strong>Morning (8:00am):</strong> {weather.morningCondition}, {weather.morningTemp}°C, rain {weather.morningRain}mm</p>
        <p><strong>Afternoon (5pm):</strong> {weather.afternoonCondition}, {weather.afternoonTemp}°C, rain {weather.afternoonRain}mm</p>
        <hr className="my-4" />
        <p className="text-xl font-semibold">{weather.coatAdvice}</p>
      </div>
    </main>
  );
}
