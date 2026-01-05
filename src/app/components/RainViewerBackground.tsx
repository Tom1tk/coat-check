// app/components/RainViewerBackground.tsx
"use client";
import React, { JSX, useEffect } from "react";
import { Map, MapMarker, MarkerContent, useMap } from "@/components/ui/map";

interface RainViewerBackgroundProps {
  onLoaded?: () => void;
  location?: { latitude: number; longitude: number };
  zoom?: number;
  refreshKey?: number;
}

// Component to add rain overlay layer and trigger onLoaded callback
function RainOverlayLayer({
  location,
  onLoaded,
  zoom = 8,
  refreshKey = 0
}: {
  location: { latitude: number; longitude: number };
  onLoaded?: () => void;
  zoom?: number;
  refreshKey?: number;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const apiKey = process.env.NEXT_PUBLIC_OWM_API_KEY;

    const addRainLayer = () => {
      // Remove existing layers/sources first to avoid duplicates
      if (map.getLayer('rain-layer')) {
        map.removeLayer('rain-layer');
      }
      if (map.getSource('rain-tiles')) {
        map.removeSource('rain-tiles');
      }

      // Add OpenWeatherMap precipitation raster source
      map.addSource('rain-tiles', {
        type: 'raster',
        tiles: [
          `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}&t=${refreshKey}`
        ],
        tileSize: 256,
        attribution: '© OpenWeatherMap'
      });

      // Add rain layer on top of base map
      map.addLayer({
        id: 'rain-layer',
        type: 'raster',
        source: 'rain-tiles',
        paint: {
          'raster-opacity': 0.8,
          'raster-brightness-max': 1,
          'raster-contrast': 0.3
        }
      });
    };

    // Add layer immediately if style is already loaded
    if (map.isStyleLoaded()) {
      addRainLayer();
    }

    // Re-add layer whenever style changes (MAPCN theme switching)
    const handleStyleData = () => {
      // Use timeout to ensure style is fully applied
      setTimeout(() => {
        if (map.isStyleLoaded() && !map.getSource('rain-tiles')) {
          addRainLayer();
        }
      }, 100);
    };

    map.on('styledata', handleStyleData);

    // Trigger onLoaded callback
    onLoaded?.();

    return () => {
      map.off('styledata', handleStyleData);
      // Cleanup on unmount
      if (map.getLayer('rain-layer')) {
        map.removeLayer('rain-layer');
      }
      if (map.getSource('rain-tiles')) {
        map.removeSource('rain-tiles');
      }
    };
  }, [map, isLoaded, onLoaded, refreshKey]);

  // Fly to new location when it changes
  useEffect(() => {
    if (!map || !location) return;

    map.flyTo({
      center: [location.longitude, location.latitude],
      zoom: zoom,
      duration: 2000,
      essential: true
    });
  }, [map, location, zoom]);

  // Watch for zoom changes separately to update just the zoom if location doesn't change
  useEffect(() => {
    if (!map) return;
    map.flyTo({
      zoom: zoom,
      duration: 1000, // Faster duration for just zoom changes
      essential: true
    });
  }, [map, zoom]);

  return null;
}



// Custom location marker - a pulsing dot
function LocationMarker({ location }: { location: { latitude: number; longitude: number } }) {
  return (
    <MapMarker
      longitude={location.longitude}
      latitude={location.latitude}
    >
      <MarkerContent>
        <div className="relative">
          {/* Outer pulsing ring */}
          <div className="absolute -inset-2 rounded-full bg-blue-500/30 animate-ping" />
          {/* Inner dot */}
          <div className="relative h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
        </div>
      </MarkerContent>
    </MapMarker>
  );
}

interface RainViewerBackgroundProps {
  onLoaded?: () => void;
  location?: { latitude: number; longitude: number };
  zoom?: number;
  refreshKey?: number;
}

function RainViewerBackground({
  onLoaded,
  location = { latitude: 52.2053, longitude: 0.1218 }, // default Cambridge
  zoom = 8,
  refreshKey = 0,
}: RainViewerBackgroundProps): JSX.Element {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: -10,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <Map
        center={[location.longitude, location.latitude]}
        zoom={zoom}
        interactive={false}
        dragPan={false}
        scrollZoom={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
        keyboard={false}
        trackResize={true}
        styles={{
          light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
          dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
        }}
      >
        <RainOverlayLayer location={location} onLoaded={onLoaded} zoom={zoom} refreshKey={refreshKey} />
        <LocationMarker location={location} />
      </Map>
    </div>
  );
}

export default React.memo(RainViewerBackground);
