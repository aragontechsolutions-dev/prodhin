import { useSyncExternalStore } from 'react';

/**
 * Store en memoria de clientes marcados como "visitado" en el día.
 * Se comparte entre el mapa (MapScreen) y la pantalla de entrega, para que
 * registrar una entrega marque el cliente como visitado automáticamente.
 */
let visited = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function markVisited(id: string) {
  if (visited.has(id)) return;
  visited = new Set(visited);
  visited.add(id);
  emit();
}

export function getVisited(): Set<string> {
  return visited;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useVisited(): Set<string> {
  return useSyncExternalStore(subscribe, getVisited, getVisited);
}
