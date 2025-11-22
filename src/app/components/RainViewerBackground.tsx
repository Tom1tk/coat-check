// app/components/RainViewerBackground.tsx
"use client";
import React, { JSX, useEffect, useState } from "react";
import { CachedTileImage } from "./CachedTileImage";
import { latLonToTile, TILE_SIZE } from "../utils/mapUtils";

const ZOOM = 8;
const GRID_W = 17;
const GRID_H = 9;
const WEST_OFFSET = -1;

interface RainViewerBackgroundProps {
  onLoaded?: () => void;
  location?: { latitude: number; longitude: number }; // allow dynamic location
}

function RainViewerBackground({
  onLoaded,
  location = { latitude: 52.2053, longitude: 0.1218 }, // default Cambridge
}: RainViewerBackgroundProps): JSX.Element {
  const [tiles, setTiles] = useState<{ x: number; y: number; left: number; top: number }[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);

  const totalTiles = GRID_W * GRID_H * 2; // base + rain layer per tile

  useEffect(() => {
    const { x, y } = latLonToTile(location.latitude, location.longitude, ZOOM);
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
  }, [location]); // recalc tiles whenever location changes

  useEffect(() => {
    if (loadedCount >= totalTiles && onLoaded) {
      onLoaded();
    }
  }, [loadedCount, totalTiles, onLoaded]);

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
          <CachedTileImage
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
              opacity: 1,
              filter: "brightness(1.2) contrast(1.2)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default React.memo(RainViewerBackground);
