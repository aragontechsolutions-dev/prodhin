import { useEffect, useRef, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

const WARNING_AFTER_MS = 19 * 60 * 1000;
const LOGOUT_AFTER_MS = 20 * 60 * 1000;

export function useInactivityTimer(
  onSignOut: () => void,
  onWarning?: () => void,
  onLogout?: () => void,
) {
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityAt = useRef<number>(Date.now());

  const clearTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    lastActivityAt.current = Date.now();

    warningTimer.current = setTimeout(() => {
      onWarning?.();
    }, WARNING_AFTER_MS);

    logoutTimer.current = setTimeout(() => {
      onLogout?.();
      onSignOut();
    }, LOGOUT_AFTER_MS);
  }, [clearTimers, onSignOut, onWarning, onLogout]);

  // When app returns to foreground, check real elapsed time against last activity.
  // JS timers freeze while the app is backgrounded/closed, so setTimeout alone
  // cannot be trusted for inactivity enforcement across app switches.
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState === 'active') {
        const elapsed = Date.now() - lastActivityAt.current;
        if (elapsed >= LOGOUT_AFTER_MS) {
          clearTimers();
          onLogout?.();
          onSignOut();
        } else if (elapsed >= WARNING_AFTER_MS) {
          clearTimers();
          onWarning?.();
          // Schedule the remaining logout time
          const remaining = LOGOUT_AFTER_MS - elapsed;
          logoutTimer.current = setTimeout(() => {
            onLogout?.();
            onSignOut();
          }, remaining);
        } else {
          // Still within active window — reschedule timers for remaining time
          clearTimers();
          const warningRemaining = WARNING_AFTER_MS - elapsed;
          const logoutRemaining = LOGOUT_AFTER_MS - elapsed;
          warningTimer.current = setTimeout(() => onWarning?.(), warningRemaining);
          logoutTimer.current = setTimeout(() => { onLogout?.(); onSignOut(); }, logoutRemaining);
        }
      }
    }

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [clearTimers, onSignOut, onWarning, onLogout]);

  useEffect(() => {
    resetTimers();
    return clearTimers;
  }, [resetTimers, clearTimers]);

  return { resetTimers };
}
