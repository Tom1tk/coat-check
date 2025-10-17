"use client";
import React, { useEffect, useState } from "react";

const RainViewerBackground: React.FC = () => {
  const [tiles, setTiles] = useState<
    { base: string; rain: string; x: number; y: number }[]
  >([]);

  // Converts latitude/longitude → tile coordinates
  const latLonToTile = (lat: number, lon: number, zoom: number) => {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = ((lon + 180) / 360) * n;
    const y =
      (1 -
        Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2 *
      n;
    return { x, y };
  };

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_OWM_API_KEY;
    const zoom = 12;
    const lat = 52.2053; // Cambridge
    const lon = 0.1218;

    const { x, y } = latLonToTile(lat, lon, zoom);
    const xi = Math.floor(x);
    const yi = Math.floor(y);

    const tileSize = 256;

    // Adjust grid size (16 wide x 9 tall)
    const gridWidth = 16;
    const gridHeight = 9;

    // Calculate offsets to center the view on Cambridge
    const halfW = Math.floor(gridWidth / 2);
    const halfH = Math.floor(gridHeight / 2);

    const newTiles: {
      base: string;
      rain: string;
      x: number;
      y: number;
    }[] = [];

    for (let dx = -halfW; dx <= halfW; dx++) {
      for (let dy = -halfH; dy <= halfH; dy++) {
        newTiles.push({
          base: `https://tile.openstreetmap.org/${zoom}/${xi + dx}/${yi + dy}.png`,
          rain: `https://tile.openweathermap.org/map/precipitation_new/${zoom}/${xi + dx}/${yi + dy}.png?appid=${apiKey}`,
          x: dx * tileSize,
          y: dy * tileSize,
        });
      }
    }

    setTiles(newTiles);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        zIndex: -1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8f8f8",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 256 * 16,
          height: 256 * 9,
          filter: "brightness(1.1)",
          opacity: 0.9,
        }}
      >
        {tiles.map((t, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: t.y + 256 * 4.5, // center vertically
              left: t.x + 256 * 8, // center horizontally
              width: 256,
              height: 256,
              backgroundImage: `url(${t.base}), url(${t.rain})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default RainViewerBackground;
