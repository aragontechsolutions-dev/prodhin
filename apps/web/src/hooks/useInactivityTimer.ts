import { useEffect, useRef, useCallback } from 'react';

const WARNING_AFTER_MS = 4.5 * 60 * 1000; // 4m 30s
const LOGOUT_AFTER_MS = 5 * 60 * 1000;    // 5m

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

export function useInactivityTimer(onSignOut: () => void, onWarning: (secondsLeft: number) => void, onActive: () => void) {
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    onActive();
    warningTimer.current = setTimeout(() => {
      onWarning(30);
    }, WARNING_AFTER_MS);
    logoutTimer.current = setTimeout(() => {
      onSignOut();
    }, LOGOUT_AFTER_MS);
  }, [clearTimers, onActive, onWarning, onSignOut]);

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
