import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Clientes marcados como "visitado" EN EL DÍA.
 *
 * Persistencia: se guarda en el teléfono (AsyncStorage) para sobrevivir a
 * reinicios/cierres de la app. Además, MapScreen reconstruye el estado a
 * partir de las entregas del día (que están en la BD), de modo que aunque se
 * pierda el almacenamiento local, los clientes con entrega hoy siguen
 * apareciendo como visitados.
 *
 * El estado es por-día: al cambiar de día arranca vacío (lo que se guardó
 * ayer no aplica hoy).
 */
const KEY = 'prodhin-visited-v1';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

let visited = new Set<string>();
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ date: todayStr(), ids: [...visited] }));
  } catch {
    // almacenamiento no disponible: no es crítico, las entregas reconstruyen el estado
  }
}

/** Carga el estado guardado (solo si es de hoy). Idempotente. */
export async function hydrateVisited() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.date === todayStr() && Array.isArray(o.ids) && o.ids.length) {
        visited = new Set(o.ids);
        emit();
      }
    }
  } catch {
    // ignorar
  }
}

export function markVisited(id: string) {
  if (visited.has(id)) return;
  visited = new Set(visited);
  visited.add(id);
  emit();
  void persist();
}

/** Marca varios de una vez (p. ej. reconstruido desde las entregas del día). */
export function markVisitedMany(ids: string[]) {
  let changed = false;
  const next = new Set(visited);
  for (const id of ids) {
    if (!next.has(id)) { next.add(id); changed = true; }
  }
  if (changed) {
    visited = next;
    emit();
    void persist();
  }
}

export function getVisited(): Set<string> {
  return visited;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useVisited(): Set<string> {
  return useSyncExternalStore(subscribe, getVisited, getVisited);
}
