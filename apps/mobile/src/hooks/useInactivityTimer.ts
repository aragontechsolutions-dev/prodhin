import { useEffect, useRef, useCallback } from 'react';

const WARNING_AFTER_MS = 19 * 60 * 1000;
const LOGOUT_AFTER_MS = 20 * 60 * 1000;

export function useInactivityTimer(
  onSignOut: () => void,
  onWarning?: () => void,
  onLogout?: () => void,
) {
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();

    warningTimer.current = setTimeout(() => {
      onWarning?.();
    }, WARNING_AFTER_MS);

    logoutTimer.current = setTimeout(() => {
      onLogout?.();
      onSignOut();
    }, LOGOUT_AFTER_MS);
  }, [clearTimers, onSignOut, onWarning, onLogout]);

  useEffect(() => {
    resetTimers();
    return clearTimers;
  }, [resetTimers, clearTimers]);

  return { resetTimers };
}
