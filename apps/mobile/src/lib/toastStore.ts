import { useSyncExternalStore } from 'react';

// Notificación tipo "toast" global: cualquier pantalla puede dispararla con
// showToast(...) y se muestra arriba de todo (ver components/Toast.tsx).
export type ToastType = 'success' | 'error' | 'info';

export interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

let current: ToastState | null = null;
let counter = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function showToast(message: string, type: ToastType = 'success') {
  counter += 1;
  current = { id: counter, message, type };
  emit();
}

export function clearToast() {
  if (current === null) return;
  current = null;
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useToast(): ToastState | null {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
