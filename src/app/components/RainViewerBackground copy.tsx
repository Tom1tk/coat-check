"use client";
import { useEffect, useState } from "react";

export default function RainViewerBackground() {
  const [tileUrl, setTileUrl] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Cambridge coordinates
  const lat = 52.2053;
  const lon = 0.1218;

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_OWM_API_KEY;

    // OpenWeatherMap rain tile endpoint
    // Docs: https://openweathermap.org/api/weathermaps
    // We'll use the precipitation layer
    const url = `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}`;

    setTileUrl(url);
    setMapReady(true);
  }, []);

  if (!mapReady || !tileUrl) return null;

  return (
    <div
      className="absolute inset-0 -z-10"
      style={{
        backgroundImage: `url(${tileUrl
        .replace("{z}", "4")
        .replace("{x}", "8")
        .replace("{y}", "5")})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        filter: "grayscale(100%) brightness(1.2) contrast(1.1)",
        opacity: 0.9,
        transition: "background-image 0.5s ease-in-out",
      }}
    >
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-white/30 pointer-events-none" />
    </div>
  );
}
