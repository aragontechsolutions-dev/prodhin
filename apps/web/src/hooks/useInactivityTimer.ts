import { useEffect, useRef, useCallback } from 'react';

const WARNING_AFTER_MS = 4.5 * 60 * 1000; // 4m 30s
const LOGOUT_AFTER_MS = 5 * 60 * 1000;    // 5m

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export function useInactivityTimer(onSignOut: () => void, onWarning: (secondsLeft: number) => void, onActive: () => void) {
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityAt = useRef<number>(Date.now());

  const clearTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    onActive();
    lastActivityAt.current = Date.now();

    warningTimer.current = setTimeout(() => {
      onWarning(30);
    }, WARNING_AFTER_MS);

    logoutTimer.current = setTimeout(() => {
      onSignOut();
    }, LOGOUT_AFTER_MS);
  }, [clearTimers, onActive, onWarning, onSignOut]);

  // When the tab becomes visible again, browsers may have throttled or frozen
  // the setTimeout callbacks. Check real elapsed time against last activity.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;

      const elapsed = Date.now() - lastActivityAt.current;

      if (elapsed >= LOGOUT_AFTER_MS) {
        clearTimers();
        onSignOut();
      } else if (elapsed >= WARNING_AFTER_MS) {
        clearTimers();
        const secondsLeft = Math.ceil((LOGOUT_AFTER_MS - elapsed) / 1000);
        onWarning(secondsLeft);
        logoutTimer.current = setTimeout(() => onSignOut(), LOGOUT_AFTER_MS - elapsed);
      } else {
        // Reschedule for the remaining time
        clearTimers();
        warningTimer.current = setTimeout(() => onWarning(30), WARNING_AFTER_MS - elapsed);
        logoutTimer.current = setTimeout(() => onSignOut(), LOGOUT_AFTER_MS - elapsed);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [clearTimers, onSignOut, onWarning]);

  useEffect(() => {
    reset();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [reset, clearTimers]);

  return { reset };
}
