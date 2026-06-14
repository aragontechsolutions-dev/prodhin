import { useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';

const WARNING_AFTER_MS = 19 * 60 * 1000; // warn at 19 min
const LOGOUT_AFTER_MS = 20 * 60 * 1000;  // logout at 20 min

export function useInactivityTimer(onSignOut: () => void) {
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();

    warningTimer.current = setTimeout(() => {
      Alert.alert(
        'Sesión a punto de expirar',
        'Tu sesión se cerrará en 1 minuto por inactividad.',
        [{ text: 'Seguir conectado', onPress: resetTimers }],
        { cancelable: false },
      );
    }, WARNING_AFTER_MS);

    logoutTimer.current = setTimeout(() => {
      Alert.alert('Sesión cerrada', 'Se cerró la sesión por inactividad.');
      onSignOut();
    }, LOGOUT_AFTER_MS);
  }, [clearTimers, onSignOut]);

  useEffect(() => {
    resetTimers();
    return clearTimers;
  }, [resetTimers, clearTimers]);

  return { resetTimers };
}
