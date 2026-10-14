import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Clientes marcados como "visitado" EN EL DÍA, con su tipo:
 *   - 'delivered' : se registró una entrega con venta (estado Entregado)
 *   - 'visited'   : se visitó sin venta (ausente/rechazo/sin stock o marca manual)
 *
 * Persistencia: se guarda en el teléfono (AsyncStorage) para sobrevivir a
 * reinicios/cierres. Además, MapScreen reconstruye el estado desde las
 * entregas del día (BD), así que aunque se pierda el estado local, los
 * clientes con entrega hoy siguen marcados.
 *
 * Es por-día: al cambiar de día arranca vacío.
 */
export type VisitKind = 'delivered' | 'visited';

const KEY = 'prodhin-visited-v2';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

let kinds = new Map<string, VisitKind>();
let idSet = new Set<string>();
let loaded = false;
const listeners = new Set<() => void>();

function rebuildSet() {
  idSet = new Set(kinds.keys());
}
function emit() {
  for (const l of listeners) l();
}
async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ date: todayStr(), entries: [...kinds.entries()] }));
  } catch {
    // no crítico: las entregas reconstruyen el estado
  }
}

/** Carga lo guardado (solo si es de hoy). Idempotente. */
export async function hydrateVisited() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.date === todayStr() && Array.isArray(o.entries) && o.entries.length) {
        kinds = new Map(o.entries);
        rebuildSet();
        emit();
      }
    }
  } catch {
    // ignorar
  }
}

// 'delivered' nunca se degrada a 'visited'
function applyOne(map: Map<string, VisitKind>, id: string, kind: VisitKind): boolean {
  const cur = map.get(id);
  if (cur === kind) return false;
  if (cur === 'delivered' && kind === 'visited') return false;
  map.set(id, kind);
  return true;
}

export function markVisited(id: string, kind: VisitKind = 'visited') {
  const next = new Map(kinds);
  if (!applyOne(next, id, kind)) return;
  kinds = next;
  rebuildSet();
  emit();
  void persist();
}

export function markVisitedMany(ids: string[], kind: VisitKind = 'visited') {
  const next = new Map(kinds);
  let changed = false;
  for (const id of ids) if (applyOne(next, id, kind)) changed = true;
  if (!changed) return;
  kinds = next;
  rebuildSet();
  emit();
  void persist();
}

export function getVisited(): Set<string> {
  return idSet;
}
export function getVisitedKinds(): Map<string, VisitKind> {
  return kinds;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useVisited(): Set<string> {
  return useSyncExternalStore(subscribe, getVisited, getVisited);
}
export function useVisitedKinds(): Map<string, VisitKind> {
  return useSyncExternalStore(subscribe, getVisitedKinds, getVisitedKinds);
}
