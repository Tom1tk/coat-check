// app/components/RainViewerBackground.tsx
"use client";
import React, { JSX, useCallback, useEffect, useRef, useState } from "react";
import { Map, MapMarker, MarkerContent, useMap } from "@/components/ui/map";
import { createPortal } from "react-dom";
import { RadarFrame, frameDiff, rainViewerTileUrl } from "@/app/utils/radarFrames";
import { backoffFor } from "@/app/utils/freshness";
import type { RadarSource } from "@/app/hooks/useRadar";
import type { MapPadding } from "@/app/hooks/useMapPadding";
import RadarTimestamp from "./RadarTimestamp";

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
  // Screen area covered by the UI; the location centres in what's left.
  padding?: MapPadding;
  // Where the radar legend chip is portalled (outside the aria-hidden map).
  legendTarget?: HTMLElement | null;
  // The weather mood's basemap (Dark Matter when dark, else Positron) and
  // the colour washed over it, below the radar.
  dark?: boolean;
  tint?: string | null;
}

const NO_PADDING: MapPadding = { top: 0, right: 0, bottom: 0, left: 0 };

const POSITRON = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const DARK_MATTER = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
// The vendored map picks between these by theme; the theme is pinned, so
// both slots hold the mood's basemap and a mood change swaps the style.
const BASEMAP_STYLES = {
  light: { light: POSITRON, dark: POSITRON },
  dark: { light: DARK_MATTER, dark: DARK_MATTER },
} as const;

const TINT_LAYER = "mood-tint";
const TINT_FADE_MS = 60_000;

type MapInstance = NonNullable<ReturnType<typeof useMap>["map"]>;

const RADAR_OPACITY = 0.8;
// Gradual boot: the newest frame at once, then one older frame per step, so
// 13 frames × ~12 tiles stay well under RainViewer's 100 requests/min.
const BOOT_STEP_MS = 10_000;
const FRAME_MS = 600;
const HOLD_NEWEST_MS = 2000;
const RAINVIEWER_ATTRIBUTION =
  'Weather data © <a href="https://www.rainviewer.com/" target="_blank" rel="noopener">RainViewer</a>';

const frameSourceId = (f: RadarFrame) => `rain-src-${f.time}`;
const frameLayerId = (f: RadarFrame) => `rain-lyr-${f.time}`;
const byTime = (a: RadarFrame, b: RadarFrame) => a.time - b.time;

// One source + layer per frame, hidden until shown. Frames are never
// re-pointed with setTiles, so tiles already loaded stay cached.
function ensureFrameLayer(map: MapInstance, frame: RadarFrame) {
  if (!map.getSource(frameSourceId(frame))) {
    map.addSource(frameSourceId(frame), {
      type: "raster",
      tiles: [rainViewerTileUrl(frame)],
      tileSize: 512,
      // RainViewer's native max zoom is 7 (z8 returns an error image); the
      // zoom setting goes to 8, so MapLibre overzooms instead.
      maxzoom: 7,
      attribution: RAINVIEWER_ATTRIBUTION,
    });
  }
  if (!map.getLayer(frameLayerId(frame))) {
    map.addLayer({
      id: frameLayerId(frame),
      type: "raster",
      source: frameSourceId(frame),
      paint: {
        "raster-opacity": 0,
        "raster-opacity-transition": { duration: 0, delay: 0 },
        "raster-fade-duration": 0,
        "raster-brightness-max": 1,
        "raster-contrast": 0.3,
      },
    });
  }
}

function removeFrameLayer(map: MapInstance, frame: RadarFrame) {
  try {
    if (map.getLayer(frameLayerId(frame))) map.removeLayer(frameLayerId(frame));
    if (map.getSource(frameSourceId(frame))) map.removeSource(frameSourceId(frame));
  } catch {
    // The map was already removed (watchdog rebuild) — nothing to clean up.
  }
}

const isFrameLoaded = (map: MapInstance, f: RadarFrame) =>
  Boolean(map.getSource(frameSourceId(f))) && map.isSourceLoaded(frameSourceId(f));

// `?radar=still` (kiosk config) or reduced motion → newest frame only, no loop.
function prefersStillRadar(): boolean {
  if (typeof window === "undefined") return false;
  return (
    new URLSearchParams(window.location.search).get("radar") === "still" ||
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

// Keeps one map layer per radar frame in step with `frames`, boots them in
// gradually, and loops through the loaded ones. Returns the visible frame.
function useRadarLoop(map: MapInstance | null, isLoaded: boolean, frames: RadarFrame[] | null) {
  const [still] = useState(prefersStillRadar);
  const onMap = useRef<RadarFrame[]>([]); // oldest → newest
  const pending = useRef<RadarFrame[]>([]); // waiting for gradual boot, newest first
  const visible = useRef<RadarFrame | null>(null);
  const [shown, setShown] = useState<RadarFrame | null>(null);

  const show = useCallback((m: MapInstance, frame: RadarFrame | null) => {
    const prev = visible.current;
    if (prev && prev.path !== frame?.path && m.getLayer(frameLayerId(prev))) {
      m.setPaintProperty(frameLayerId(prev), "raster-opacity", 0);
    }
    if (frame && m.getLayer(frameLayerId(frame))) {
      m.setPaintProperty(frameLayerId(frame), "raster-opacity", RADAR_OPACITY);
    }
    visible.current = frame;
    setShown(frame);
  }, []);

  // A style swap (theme toggle) drops every layer; unmount must too.
  useEffect(() => {
    if (!map || !isLoaded) return;
    return () => {
      const dropped = onMap.current;
      onMap.current = [];
      pending.current = [];
      visible.current = null;
      for (const f of dropped) removeFrameLayer(map, f);
    };
  }, [map, isLoaded]);

  // The vendored map can report the swap loaded before `setStyle` lands, so
  // layers re-added then are diffed away; put back any that went missing.
  useEffect(() => {
    if (!map) return;
    const heal = () => {
      if (!map.isStyleLoaded()) return;
      const lost = onMap.current.filter((f) => !map.getLayer(frameLayerId(f)));
      for (const f of lost) ensureFrameLayer(map, f);
      const current = visible.current;
      if (current && lost.includes(current)) {
        map.setPaintProperty(frameLayerId(current), "raster-opacity", RADAR_OPACITY);
      }
    };
    map.on("styledata", heal);
    return () => {
      map.off("styledata", heal);
    };
  }, [map]);

  // Apply the latest frame list: add the newest new frame now, queue older
  // ones, drop frames that have aged out.
  useEffect(() => {
    if (!map || !isLoaded) return;
    const target = frames ? (still ? frames.slice(-1) : frames) : [];
    const { add, remove } = frameDiff([...onMap.current, ...pending.current], target);
    const gone = new Set(remove.map((f) => f.path));
    onMap.current = onMap.current.filter((f) => !gone.has(f.path));
    for (const f of remove) removeFrameLayer(map, f);
    pending.current = [...pending.current.filter((f) => !gone.has(f.path)), ...add.slice(0, -1)]
      .sort(byTime)
      .reverse();
    if (visible.current && gone.has(visible.current.path)) visible.current = null;

    const newest = add.at(-1);
    if (newest) {
      ensureFrameLayer(map, newest);
      onMap.current = [...onMap.current, newest].sort(byTime);
    }
    const latest = onMap.current.at(-1) ?? null;
    if (still || !visible.current || latest === null) show(map, latest);
  }, [map, isLoaded, frames, still, show]);

  // Gradual boot: one queued frame per step.
  useEffect(() => {
    if (!map || !isLoaded) return;
    const timer = setInterval(() => {
      const [next, ...rest] = pending.current;
      if (!next) return;
      pending.current = rest;
      ensureFrameLayer(map, next);
      onMap.current = [...onMap.current, next].sort(byTime);
    }, BOOT_STEP_MS);
    return () => clearInterval(timer);
  }, [map, isLoaded]);

  // The loop: FRAME_MS per loaded frame, a hold on the newest; paused while
  // the page is hidden.
  useEffect(() => {
    if (!map || !isLoaded || still) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = () => {
      const playable = onMap.current.filter((f) => isFrameLoaded(map, f));
      let delay = FRAME_MS;
      if (playable.length > 0) {
        const i = playable.findIndex((f) => f.path === visible.current?.path);
        const next = i === -1 ? playable[playable.length - 1] : playable[(i + 1) % playable.length];
        if (next.path !== visible.current?.path) show(map, next);
        if (next === playable[playable.length - 1]) delay = HOLD_NEWEST_MS;
      }
      timer = setTimeout(tick, delay);
    };
    const start = () => {
      if (timer === null) timer = setTimeout(tick, FRAME_MS);
    };
    const stop = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden) start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [map, isLoaded, still, show]);

  return { shown, newest: frames?.at(-1) ?? null };
}

// The OpenWeatherMap fallback: one static layer, no loop.
function useFallbackLayer(map: MapInstance | null, isLoaded: boolean, active: boolean, stamp: number) {
  useEffect(() => {
    if (!map || !isLoaded || !active) return;
    // `isLoaded` flips false→true on every theme swap (see components/ui/map.tsx),
    // so this effect re-running IS the "style changed" signal.
    map.addSource("rain-tiles", {
      type: "raster",
      tiles: [`${window.location.origin}/api/rain-tiles/{z}/{x}/{y}?t=${stamp}`],
      tileSize: 256,
      attribution: "© OpenWeatherMap",
    });
    map.addLayer({
      id: "rain-layer",
      type: "raster",
      source: "rain-tiles",
      paint: {
        "raster-opacity": RADAR_OPACITY,
        "raster-opacity-transition": { duration: 300, delay: 0 },
        "raster-brightness-max": 1,
        "raster-contrast": 0.3,
      },
    });
    return () => {
      try {
        if (map.getLayer("rain-layer")) map.removeLayer("rain-layer");
        if (map.getSource("rain-tiles")) map.removeSource("rain-tiles");
      } catch {
        // The map was already removed (watchdog rebuild) — nothing to clean up.
      }
    };
  }, [map, isLoaded, active, stamp]);
}

// Adds the rain overlay (looping RainViewer frames, or the OWM fallback) and
// triggers onLoaded once the base map is ready.
function RainOverlayLayer({
  location,
  onLoaded,
  zoom = 8,
  radar,
  fallbackStamp,
  padding,
  legendTarget,
}: {
  location: { latitude: number; longitude: number };
  onLoaded?: () => void;
  zoom?: number;
  radar: RadarSource;
  fallbackStamp: number;
  padding: MapPadding;
  legendTarget: HTMLElement | null;
}) {
  const { map, isLoaded } = useMap();

  // Reveal the map as soon as it is ready — the radar pops in later when its
  // frame index arrives.
  useEffect(() => {
    if (!map || !isLoaded) return;
    onLoaded?.();
  }, [map, isLoaded, onLoaded]);

  const { shown, newest } = useRadarLoop(map, isLoaded, Array.isArray(radar) ? radar : null);
  useFallbackLayer(map, isLoaded, radar === "fallback", fallbackStamp);

  // Keep the location centred in the area the UI leaves free. setPadding keeps
  // the centre coordinate, so the view shifts without a fly-to.
  useEffect(() => {
    if (!map) return;
    map.setPadding(padding);
  }, [map, padding]);

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

  // Portalled out of the aria-hidden map into the slot the layout provides.
  if (!shown || !newest || !legendTarget) return null;
  return createPortal(<RadarTimestamp frame={shown} newest={newest} />, legendTarget);
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

// Washes the basemap with the mood's colour. It sits below the first radar
// layer (\`rain-*\`), so the radar keeps its true colours, and is re-added
// after a basemap swap drops it.
function MoodTint({ colour }: { colour: string }) {
  const { map } = useMap();

  // Checked on every style change rather than on the map's `isLoaded`, which
  // can flip back before a swap's `setStyle` lands (see useRadarLoop).
  useEffect(() => {
    if (!map) return;
    const ensure = () => {
      if (!map.isStyleLoaded()) return;
      if (map.getLayer(TINT_LAYER)) {
        map.setPaintProperty(TINT_LAYER, "background-color", colour);
        return;
      }
      const radar = map.getStyle().layers.find((l) => l.id.startsWith("rain-"));
      map.addLayer(
        {
          id: TINT_LAYER,
          type: "background",
          paint: {
            "background-color": colour,
            "background-color-transition": { duration: TINT_FADE_MS, delay: 0 },
          },
        },
        radar?.id
      );
    };
    ensure();
    map.on("styledata", ensure);
    return () => {
      map.off("styledata", ensure);
    };
  }, [map, colour]);

  return null;
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

  // A tile that fails to load (offline, rate-limited) is routine: the frame
  // just shows less rain. Without a listener MapLibre console.errors every
  // one, so warn once per source and keep console.error for real faults.
  useEffect(() => {
    if (!map) return;
    const warned = new Set<string>();
    const onError = (e: { error?: Error; sourceId?: string; tile?: unknown }) => {
      if (e.sourceId && e.tile) {
        if (warned.has(e.sourceId)) return;
        warned.add(e.sourceId);
        console.warn(`[Map] tiles failed to load for ${e.sourceId}:`, e.error?.message);
        return;
      }
      console.error('[Map]', e.error ?? e);
    };
    map.on('error', onError);
    return () => {
      map.off('error', onError);
    };
  }, [map]);

  return null;
}

function RainViewerBackground({
  onLoaded,
  location = { latitude: 52.2053, longitude: 0.1218 }, // default Cambridge
  zoom = 8,
  radar,
  fallbackStamp,
  padding = NO_PADDING,
  legendTarget = null,
  dark = false,
  tint = null,
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
        styles={dark ? BASEMAP_STYLES.dark : BASEMAP_STYLES.light}
      >
        <MapWatchdog onLoadedChange={setLoaded} onRemount={remount} />
        {tint && <MoodTint colour={tint} />}
        <RainOverlayLayer
          location={location}
          onLoaded={onLoaded}
          zoom={zoom}
          radar={radar}
          fallbackStamp={fallbackStamp}
          padding={padding}
          legendTarget={legendTarget}
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
    prevProps.fallbackStamp === nextProps.fallbackStamp &&
    prevProps.padding === nextProps.padding &&
    prevProps.legendTarget === nextProps.legendTarget &&
    prevProps.dark === nextProps.dark &&
    prevProps.tint === nextProps.tint
    // Intentionally ignoring onLoaded since it doesn't change behavior once called
  );
});
