// app/components/RainViewerBackground.tsx
"use client";
import React, { JSX, useEffect, useState } from "react";

const TILE_SIZE = 256;
const CAMBRIDGE_LAT = 52.2053;
const CAMBRIDGE_LON = 0.1218;
const ZOOM = 8;

// Grid size (16:9 look)
const GRID_W = 17;
const GRID_H = 9;

// Move west by this many tiles (negative = west, positive = east)
const WEST_OFFSET = -1;

export default function RainViewerBackground(): JSX.Element {
  const [tiles, setTiles] = useState<{ x: number; y: number; left: number; top: number }[]>([]);

  const latLonToTile = (lat: number, lon: number, zoom: number) => {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = ((lon + 180) / 360) * n;
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    return { x, y }
  };

  useEffect(() => {
    const { x, y } = latLonToTile(CAMBRIDGE_LAT, CAMBRIDGE_LON, ZOOM);
    const xi = Math.floor(x);
    const yi = Math.floor(y);

    const offsetX = (x - xi) * TILE_SIZE;
    const offsetY = (y - yi) * TILE_SIZE;

    const containerWidth = GRID_W * TILE_SIZE;
    const containerHeight = GRID_H * TILE_SIZE;
    const centerPixelX = (containerWidth / 2) - (TILE_SIZE / 2);
    const centerPixelY = (containerHeight / 2) - (TILE_SIZE / 2);

    const halfW = Math.floor(GRID_W / 2);
    const halfH = Math.floor(GRID_H / 2);

    const t: { x: number; y: number; left: number; top: number }[] = [];

    for (let dx = -halfW; dx <= halfW; dx++) {
      for (let dy = -halfH; dy <= halfH; dy++) {
        const tileX = xi + dx + WEST_OFFSET; // Shift west by 3 tiles
        const tileY = yi + dy;

        const left = centerPixelX + dx * TILE_SIZE - offsetX;
        const top = centerPixelY + dy * TILE_SIZE - offsetY;

        t.push({ x: tileX, y: tileY, left, top });
      }
    }

    setTiles(t);
  }, []);

  if (!tiles.length) return <div style={{ position: "absolute", inset: 0, zIndex: -10, pointerEvents: "none" }} />;

  const containerWidth = GRID_W * TILE_SIZE;
  const containerHeight = GRID_H * TILE_SIZE;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: -10,
        overflow: "hidden",
        pointerEvents: "none",
        backgroundColor: "#d0d8e0",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: containerWidth,
          height: containerHeight,
          transform: "translate(-50%, -50%)",
          willChange: "transform, opacity",
          opacity: 0.9,
        }}
      >
        {/* Base Map (OpenStreetMap) */}
        {tiles.map((tile, i) => (
          <img
            key={`base-${i}`}
            src={`https://tile.openstreetmap.org/${ZOOM}/${tile.x}/${tile.y}.png`}
            alt=""
            style={{
              position: "absolute",
              left: Math.round(tile.left),
              top: Math.round(tile.top),
              width: TILE_SIZE,
              height: TILE_SIZE,
              objectFit: "cover",
              display: "block",
              userSelect: "none",
              pointerEvents: "none",
              filter: "grayscale(80%) brightness(1.12) contrast(1.05)",
              opacity: 0.7,
            }}
          />
        ))}

        {/* Rain Overlay (OpenWeatherMap) */}
        {tiles.map((tile, i) => (
          <img
            key={`rain-${i}`}
            src={`https://tile.openweathermap.org/map/precipitation_new/${ZOOM}/${tile.x}/${tile.y}.png?appid=${process.env.NEXT_PUBLIC_OWM_API_KEY}`}
            alt=""
            style={{
              position: "absolute",
              left: Math.round(tile.left),
              top: Math.round(tile.top),
              width: TILE_SIZE,
              height: TILE_SIZE,
              objectFit: "cover",
              display: "block",
              userSelect: "none",
              pointerEvents: "none",
              filter: "brightness(1.12) contrast(1.05)",
              opacity: 0.8,
              mixBlendMode: "multiply",
            }}
          />
        ))}
      </div>
    </div>
  );
}
