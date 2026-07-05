import { useCallback, useEffect, useRef, useState } from 'react';

// ============================================
// ROBUST REFRESH SYSTEM
// Hybrid approach: Hour-based staleness + Heartbeat suspension detection
// ============================================

// Heartbeat: Updated every 30 seconds while page is active
// If heartbeat is stale (>60s old), the page was suspended
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TOLERANCE = 60000; // 1 minute - if heartbeat older than this, we were suspended

// Pure countdown helper: minutes remaining until the next refresh boundary
// (minute 1 of the next hour if past minute 1, else minute 1 of this hour).
// Clamped to [0, 59] so a diff that rounds to a full hour (60) displays as 59
// instead of the old "0:60".
export function minutesUntilNextRefresh(now: Date): number {
  const nextHour = new Date(now);

  if (now.getMinutes() >= 1) {
    nextHour.setHours(now.getHours() + 1);
  }
  nextHour.setMinutes(1, 0, 0);

  const diffMs = nextHour.getTime() - now.getTime();
  return Math.min(59, Math.max(0, Math.floor(diffMs / 60000)));
}

// onRefresh: the page's handleRefresh (fade + refetch + cache-bust).
// The hook calls it when an hour boundary or wake-with-stale-hour is detected,
// and persists refresh state itself — the page no longer touches localStorage
// for refresh bookkeeping.
// onWake: called on EVERY wake event, before the staleness checks (e.g. to
// force the page's sun calc to recalculate isDay).
export function useAutoRefresh(
  onRefresh: () => void,
  onWake?: () => void,
): { minutesLeft: number | null; notifyManualRefresh: () => void } {
  // Auto refresh countdown timer (in minutes)
  const [minutesLeft, setMinutesLeft] = useState<number | null>(null);

  // Track the last hour we successfully refreshed the data for.
  // We initialize based on the current time:
  // If we are BEFORE minute 1 (e.g. 10:00), we initialize to PREVIOUS hour (9) so that 10:01 triggers a refresh.
  // If we are AFTER minute 1 (e.g. 10:05), we initialize to CURRENT hour (10) because the initial data load is fresh enough.
  const lastRefreshedHour = useRef<number>(
    (() => {
      const now = new Date();
      return now.getMinutes() < 1 ? now.getHours() - 1 : now.getHours();
    })()
  );

  const lastHeartbeat = useRef<number>(Date.now());

  // Persist last refreshed hour to localStorage for browser restart detection
  useEffect(() => {
    // On mount, restore last refreshed hour from localStorage
    const storedHour = localStorage.getItem('lastRefreshedHour');
    const storedDate = localStorage.getItem('lastRefreshedDate');
    const today = new Date().toDateString();

    if (storedHour && storedDate === today) {
      lastRefreshedHour.current = parseInt(storedHour, 10);
    }
  }, []);

  // Save to localStorage whenever we refresh
  const saveRefreshState = useCallback((hour: number) => {
    lastRefreshedHour.current = hour;
    localStorage.setItem('lastRefreshedHour', hour.toString());
    localStorage.setItem('lastRefreshedDate', new Date().toDateString());
  }, []);

  // Check if we need to refresh based on hour crossing
  const checkHourBasedRefresh = useCallback(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Refresh if: we're past minute 0 AND hour has changed since last refresh
    // This handles: hourly updates, day rollovers, multi-hour gaps
    if (currentMinute >= 1 && currentHour !== lastRefreshedHour.current) {
      console.log(`[AutoRefresh] Hour changed! Current: ${currentHour}:${currentMinute}, Last refreshed hour: ${lastRefreshedHour.current}`);
      onRefresh();
      saveRefreshState(currentHour);
      return true;
    }
    return false;
  }, [onRefresh, saveRefreshState]);

  // Detect suspension via heartbeat staleness
  const checkSuspensionAndRefresh = useCallback(() => {
    const now = Date.now();
    const heartbeatAge = now - lastHeartbeat.current;

    if (heartbeatAge > HEARTBEAT_TOLERANCE) {
      console.log(`[Wake] Suspension detected! Heartbeat was ${Math.round(heartbeatAge / 1000)}s old`);
      // Reset heartbeat
      lastHeartbeat.current = now;
      // Check if hour changed while suspended
      checkHourBasedRefresh();
      return true;
    }
    return false;
  }, [checkHourBasedRefresh]);

  // Unified wake handler - triggered by multiple events
  const handleWake = useCallback(() => {
    console.log('[Wake] Page became active');

    // Force sun calc to recalculate isDay
    onWake?.();

    // First, check if we were suspended (heartbeat stale)
    const wasSuspended = checkSuspensionAndRefresh();

    // If not suspended, still check if hour has changed
    if (!wasSuspended) {
      checkHourBasedRefresh();
    }

    // Reset heartbeat since we're now active
    lastHeartbeat.current = Date.now();
  }, [onWake, checkSuspensionAndRefresh, checkHourBasedRefresh]);

  // Main timer effect
  useEffect(() => {
    const updateTimer = () => {
      setMinutesLeft(minutesUntilNextRefresh(new Date()));
    };

    // Run timer update immediately
    updateTimer();

    // Check for hour-based refresh on mount (handles browser restart with cached page)
    checkHourBasedRefresh();

    // Timer interval - update countdown every second
    const timerInterval = setInterval(updateTimer, 1000);

    // Hourly check interval - more reliable than relying on exact timing
    const hourlyCheckInterval = setInterval(() => {
      checkHourBasedRefresh();
    }, 60000); // Check every minute

    // Heartbeat interval - keeps heartbeat fresh while page is active
    const heartbeatInterval = setInterval(() => {
      lastHeartbeat.current = Date.now();
    }, HEARTBEAT_INTERVAL);

    // === Multiple event listeners for maximum wake detection ===

    // 1. visibilitychange - main event for tab switching
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleWake();
        updateTimer();
      }
    };

    // 2. focus - catches window focus without visibility change
    const handleFocus = () => {
      handleWake();
      updateTimer();
    };

    // 3. pageshow - catches back-forward cache restoration
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        console.log('[Wake] Page restored from BFCache');
        handleWake();
        updateTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      clearInterval(timerInterval);
      clearInterval(hourlyCheckInterval);
      clearInterval(heartbeatInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [handleWake, checkHourBasedRefresh]);

  const notifyManualRefresh = useCallback(() => {
    saveRefreshState(new Date().getHours());
  }, [saveRefreshState]);

  return { minutesLeft, notifyManualRefresh };
}
