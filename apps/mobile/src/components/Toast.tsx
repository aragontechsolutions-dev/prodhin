import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast, clearToast, type ToastType } from '../lib/toastStore';

const BG: Record<ToastType, string> = {
  success: '#16a34a',
  error: '#dc2626',
  info: '#1d4ed8',
};
const ICON: Record<ToastType, string> = {
  success: '✓',
  error: '⚠️',
  info: 'ℹ️',
};

// Notificación global. Se monta una sola vez (en App.tsx) por encima de todo.
export default function Toast() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => clearToast());
    }, 3200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + 8, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={clearToast}
        style={[styles.toast, { backgroundColor: BG[toast.type] }]}
      >
        <Text style={styles.icon}>{ICON[toast.type]}</Text>
        <Text style={styles.text}>{toast.message}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 9999, elevation: 9999 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
  icon: { color: '#fff', fontSize: 16, fontWeight: '800' },
  text: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
});
