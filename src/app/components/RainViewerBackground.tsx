// app/components/RainViewerBackground.tsx
"use client";
import React, { JSX, useCallback, useEffect, useRef, useState } from "react";
import { Map, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import { RadarFrame, rainViewerTileUrl } from "@/app/utils/radarFrames";
import { backoffFor } from "@/app/utils/freshness";
import type { RadarSource } from "@/app/hooks/useRadar";

// A map that hasn't finished loading after this long is torn down and
// rebuilt (e.g. the CARTO style request failed). Later attempts add backoff.
const MAP_LOAD_TIMEOUT_MS = 20_000;
// After WebGL context loss, give the browser this long to restore it before
// rebuilding the map.
const CONTEXT_RESTORE_GRACE_MS = 5000;

interface RainViewerBackgroundProps {
  onLoaded?: () => void;
  location?: { latitude: number; longitude: number };
  zoom?: number;
  radar: RadarSource;
  fallbackStamp: number;
}

// Component to add rain overlay layer and trigger onLoaded callback
function RainOverlayLayer({
  location,
  onLoaded,
  zoom = 8,
  radar,
  fallbackStamp,
}: {
  location: { latitude: number; longitude: number };
  onLoaded?: () => void;
  zoom?: number;
  radar: RadarSource;
  fallbackStamp: number;
}) {
  const { map, isLoaded } = useMap();

  // Reveal the map as soon as it is ready — the radar layer pops in
  // later when its frame index arrives.
  useEffect(() => {
    if (!map || !isLoaded) return;
    onLoaded?.();
  }, [map, isLoaded, onLoaded]);

  useEffect(() => {
    if (!map || !isLoaded || radar === null) return;

    const addRainLayer = (frame: RadarFrame | 'fallback', key: number) => {
      const layerId = 'rain-layer';
      const sourceId = 'rain-tiles';

      const tileUrl =
        frame === 'fallback'
          ? `${window.location.origin}/api/rain-tiles/{z}/{x}/{y}?t=${key}`
          : rainViewerTileUrl(frame);

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
    };

    // `isLoaded` (from useMap) already tracks the map's own style-loaded
    // state and flips false→true on every theme swap (see components/ui/map.tsx),
    // so this effect re-running IS the "style changed" signal — no need for
    // a second, independently-timed 'styledata' listener here. (A previous
    // version raced its own listener registration against MapLibre's
    // 'styledata' events during setStyle and could permanently lose the
    // rain layer on a theme toggle.)
    addRainLayer(radar, fallbackStamp);

    return () => {
      // Cleanup on unmount or before re-adding for a style/frame change. On a
      // watchdog rebuild the map may already have been removed.
      try {
        if (map.getLayer('rain-layer')) {
          map.removeLayer('rain-layer');
        }
        if (map.getSource('rain-tiles')) {
          map.removeSource('rain-tiles');
        }
      } catch {
        // The map was already removed (watchdog rebuild) — nothing to clean up.
      }
    };
  }, [map, isLoaded, radar, fallbackStamp]);

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

// Reports load state upward and asks for a rebuild when the WebGL context is
// lost and not restored (GPU reset, driver sleep) — otherwise the map stays
// blank until a human reloads the page.
function MapWatchdog({
  onLoadedChange,
  onRemount,
}: {
  onLoadedChange: (loaded: boolean) => void;
  onRemount: (reason: string) => void;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    onLoadedChange(Boolean(map && isLoaded));
  }, [map, isLoaded, onLoadedChange]);

  useEffect(() => {
    if (!map) return;
    const canvas = map.getCanvas();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onLost = () => {
      console.warn('[Map] WebGL context lost');
      timer = setTimeout(() => onRemount('webgl context lost'), CONTEXT_RESTORE_GRACE_MS);
    };
    const onRestored = () => {
      console.info('[Map] WebGL context restored');
      if (timer) clearTimeout(timer);
      timer = null;
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      if (timer) clearTimeout(timer);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [map, onRemount]);

  return null;
}

function RainViewerBackground({
  onLoaded,
  location = { latitude: 52.2053, longitude: 0.1218 }, // default Cambridge
  zoom = 8,
  radar,
  fallbackStamp,
}: RainViewerBackgroundProps): JSX.Element {
  const [mapKey, setMapKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const failedLoadsRef = useRef(0);

  const remount = useCallback((reason: string) => {
    console.warn(`[Map] rebuilding map: ${reason}`);
    setLoaded(false);
    setMapKey((k) => k + 1);
  }, []);

  // Boot watchdog: rebuild a map that never finishes loading, with backoff.
  useEffect(() => {
    if (loaded) {
      failedLoadsRef.current = 0;
      return;
    }
    const timer = setTimeout(() => {
      failedLoadsRef.current += 1;
      remount(`not loaded after timeout (attempt ${failedLoadsRef.current})`);
    }, MAP_LOAD_TIMEOUT_MS + backoffFor(failedLoadsRef.current));
    return () => clearTimeout(timer);
  }, [mapKey, loaded, remount]);

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
        key={mapKey}
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
        <MapWatchdog onLoadedChange={setLoaded} onRemount={remount} />
        <RainOverlayLayer
          location={location}
          onLoaded={onLoaded}
          zoom={zoom}
          radar={radar}
          fallbackStamp={fallbackStamp}
        />
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
    prevProps.radar === nextProps.radar &&
    prevProps.fallbackStamp === nextProps.fallbackStamp
    // Intentionally ignoring onLoaded since it doesn't change behavior once called
  );
});
