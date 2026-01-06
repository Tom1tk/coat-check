// app/components/RainViewerBackground.tsx
"use client";
import React, { JSX, useEffect, useRef } from "react";
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
  const layerAddedRef = useRef(false);
  const currentRefreshKeyRef = useRef(refreshKey);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const apiKey = process.env.NEXT_PUBLIC_OWM_API_KEY;

    const addRainLayer = (key: number) => {
      const layerId = 'rain-layer';
      const sourceId = 'rain-tiles';

      // If layer already exists with same key, skip
      if (map.getSource(sourceId) && currentRefreshKeyRef.current === key && layerAddedRef.current) {
        return;
      }

      // Remove existing layer/source if present
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }

      // Add OpenWeatherMap precipitation raster source
      map.addSource(sourceId, {
        type: 'raster',
        tiles: [
          `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${apiKey}&t=${key}`
        ],
        tileSize: 256,
        attribution: '© OpenWeatherMap'
      });

      // Add rain layer with transition for smooth opacity changes
      map.addLayer({
        id: layerId,
        type: 'raster',
        source: sourceId,
        paint: {
          'raster-opacity': 0.8,
          'raster-opacity-transition': { duration: 300, delay: 0 },
          'raster-brightness-max': 1,
          'raster-contrast': 0.3
        }
      });

      currentRefreshKeyRef.current = key;
      layerAddedRef.current = true;
    };

    // Add layer immediately if style is already loaded
    if (map.isStyleLoaded()) {
      addRainLayer(refreshKey);
    }

    // Re-add layer whenever style changes (theme switching)
    const handleStyleData = () => {
      // Reset the "added" flag since style changed
      layerAddedRef.current = false;
      // Use timeout to ensure style is fully applied
      setTimeout(() => {
        if (map.isStyleLoaded() && !map.getSource('rain-tiles')) {
          addRainLayer(currentRefreshKeyRef.current);
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

  // Consolidated fly-to effect for location AND zoom changes
  // Using a ref to track previous values to avoid redundant animations
  const prevLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const prevZoomRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !location) return;

    const locationChanged =
      !prevLocationRef.current ||
      prevLocationRef.current.latitude !== location.latitude ||
      prevLocationRef.current.longitude !== location.longitude;

    const zoomChanged = prevZoomRef.current !== null && prevZoomRef.current !== zoom;

    // Only animate if something actually changed
    if (locationChanged) {
      map.flyTo({
        center: [location.longitude, location.latitude],
        zoom: zoom,
        duration: 2000,
        essential: true
      });
    } else if (zoomChanged) {
      map.flyTo({
        zoom: zoom,
        duration: 1000,
        essential: true
      });
    }

    prevLocationRef.current = location;
    prevZoomRef.current = zoom;
  }, [map, location, zoom]);

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

export default React.memo(RainViewerBackground, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.location?.latitude === nextProps.location?.latitude &&
    prevProps.location?.longitude === nextProps.location?.longitude &&
    prevProps.zoom === nextProps.zoom &&
    prevProps.refreshKey === nextProps.refreshKey
    // Intentionally ignoring onLoaded since it doesn't change behavior once called
  );
});

