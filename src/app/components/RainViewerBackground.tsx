// app/components/RainViewerBackground.tsx
"use client";
import React, { JSX, useEffect, useState } from "react";

const TILE_SIZE = 256;
const CAMBRIDGE_LAT = 52.2053;
const CAMBRIDGE_LON = 0.1218;
const ZOOM = 8;
const GRID_W = 17;
const GRID_H = 9;
const WEST_OFFSET = -1;

export default function RainViewerBackground({
  onLoaded,
}: {
  onLoaded?: () => void;
}): JSX.Element {
  const [tiles, setTiles] = useState<{ x: number; y: number; left: number; top: number }[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);

  const totalTiles = GRID_W * GRID_H * 2; // base + rain layer per tile

  const latLonToTile = (lat: number, lon: number, zoom: number) => {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = ((lon + 180) / 360) * n;
    const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    return { x, y };
  };

  useEffect(() => {
    const { x, y } = latLonToTile(CAMBRIDGE_LAT, CAMBRIDGE_LON, ZOOM);
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const offsetX = (x - xi) * TILE_SIZE;
    const offsetY = (y - yi) * TILE_SIZE;

    const containerWidth = GRID_W * TILE_SIZE;
    const containerHeight = GRID_H * TILE_SIZE;
    const centerPixelX = containerWidth / 2 - TILE_SIZE / 2;
    const centerPixelY = containerHeight / 2 - TILE_SIZE / 2;
    const halfW = Math.floor(GRID_W / 2);
    const halfH = Math.floor(GRID_H / 2);

    const t: { x: number; y: number; left: number; top: number }[] = [];
    for (let dx = -halfW; dx <= halfW; dx++) {
      for (let dy = -halfH; dy <= halfH; dy++) {
        const tileX = xi + dx + WEST_OFFSET;
        const tileY = yi + dy;
        const left = centerPixelX + dx * TILE_SIZE - offsetX;
        const top = centerPixelY + dy * TILE_SIZE - offsetY;
        t.push({ x: tileX, y: tileY, left, top });
      }
    }
    setTiles(t);
  }, []);

  useEffect(() => {
    if (loadedCount >= totalTiles && onLoaded) {
      onLoaded();
    }
  }, [loadedCount]);

  if (!tiles.length)
    return <div style={{ position: "absolute", inset: 0, zIndex: -10, pointerEvents: "none" }} />;

  const containerWidth = GRID_W * TILE_SIZE;
  const containerHeight = GRID_H * TILE_SIZE;

  const handleImgLoad = () => setLoadedCount((c) => c + 1);

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
          opacity: 0.9,
        }}
      >
        {tiles.map((tile, i) => (
          <img
            key={`base-${i}`}
            src={`https://tile.openstreetmap.org/${ZOOM}/${tile.x}/${tile.y}.png`}
            alt=""
            onLoad={handleImgLoad}
            style={{
              position: "absolute",
              left: tile.left,
              top: tile.top,
              width: TILE_SIZE,
              height: TILE_SIZE,
              filter: "grayscale(80%) brightness(1.12) contrast(1.05)",
              opacity: 0.7,
            }}
          />
        ))}

        {tiles.map((tile, i) => (
          <img
            key={`rain-${i}`}
            src={`https://tile.openweathermap.org/map/precipitation_new/${ZOOM}/${tile.x}/${tile.y}.png?appid=${process.env.NEXT_PUBLIC_OWM_API_KEY}`}
            alt=""
            onLoad={handleImgLoad}
            style={{
              position: "absolute",
              left: tile.left,
              top: tile.top,
              width: TILE_SIZE,
              height: TILE_SIZE,
              mixBlendMode: "multiply",
              opacity: 0.8,
            }}
          />
        ))}
      </div>
    </div>
  );
}
