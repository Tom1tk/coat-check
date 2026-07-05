// app/components/RainViewerBackground.tsx
"use client";
import React, { JSX, useEffect, useRef, useState } from "react";
import { Map, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import { RadarFrame, latestRadarFrame, rainViewerTileUrl } from "@/app/utils/radarFrames";

// How long to wait for the RainViewer frame index before giving up and
// falling back to the OWM proxy tiles.
const FRAME_INDEX_TIMEOUT_MS = 8000;

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
  const currentTileUrlRef = useRef<string | null>(null);
  // null = frame index not yet fetched; 'fallback' = use the OWM proxy
  // because the RainViewer frame index couldn't be fetched or parsed.
  const [radarFrame, setRadarFrame] = useState<RadarFrame | null | 'fallback'>(null);

  // Fetch the RainViewer frame index (the latest radar composite frame).
  // Falls back to the OWM proxy tiles on any network error, non-2xx
  // response, or malformed payload.
  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, FRAME_INDEX_TIMEOUT_MS);
    fetch('https://api.rainviewer.com/public/weather-maps.json', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`RainViewer index HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        clearTimeout(timer);
        const frame = latestRadarFrame(json);
        if (frame === null) throw new Error('RainViewer index malformed or empty');
        setRadarFrame(frame);
      })
      .catch((err) => {
        if (controller.signal.aborted && !timedOut) return; // unmount/re-run abort
        console.warn('[RainViewer] frame fetch failed, falling back to OWM tiles:', err);
        setRadarFrame('fallback');
      });
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [refreshKey]);

  // Reveal the page as soon as the map is ready — the radar layer pops in
  // later when its frame index arrives (matches pre-RainViewer timing).
  useEffect(() => {
    if (!map || !isLoaded) return;
    onLoaded?.();
  }, [map, isLoaded, onLoaded]);

  useEffect(() => {
    if (!map || !isLoaded || radarFrame === null) return;

    const addRainLayer = (frame: RadarFrame | 'fallback', key: number) => {
      const layerId = 'rain-layer';
      const sourceId = 'rain-tiles';

      const tileUrl =
        frame === 'fallback'
          ? `${window.location.origin}/api/rain-tiles/{z}/{x}/{y}?t=${key}`
          : rainViewerTileUrl(frame);

      // If layer already exists with the same resolved tile URL, skip.
      // Tracking the tile URL (rather than just the refresh key) ensures a
      // new RainViewer frame (new hash path) still forces a re-add.
      if (map.getSource(sourceId) && currentTileUrlRef.current === tileUrl && layerAddedRef.current) {
        return;
      }

      // Remove existing layer/source if present
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }

      // Add the precipitation raster source: RainViewer's multi-colour radar
      // composite by default, falling back to the OpenWeatherMap proxy when
      // the RainViewer frame index couldn't be fetched.
      if (frame === 'fallback') {
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256,
          attribution: '© OpenWeatherMap'
        });
      } else {
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256,
          // RainViewer's native max zoom is 7; the ZoomControl goes to 8, so
          // this makes MapLibre overzoom instead of requesting missing tiles.
          maxzoom: 7,
          attribution:
            'Weather data © <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>'
        });
      }

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

      currentTileUrlRef.current = tileUrl;
      layerAddedRef.current = true;
    };

    // Add layer immediately if style is already loaded
    if (map.isStyleLoaded()) {
      addRainLayer(radarFrame, refreshKey);
    }

    // Re-add layer whenever style changes (theme switching)
    const handleStyleData = () => {
      // Reset the "added" flag since style changed
      layerAddedRef.current = false;
      // Use timeout to ensure style is fully applied
      setTimeout(() => {
        if (map.isStyleLoaded() && !map.getSource('rain-tiles')) {
          addRainLayer(radarFrame, refreshKey);
        }
      }, 100);
    };

    map.on('styledata', handleStyleData);

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
  }, [map, isLoaded, refreshKey, radarFrame]);

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

