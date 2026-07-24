import type { MyDeliveryRow } from '../hooks/useMyDeliveries';

/**
 * Modelo suave de orden de entregas, aprendido del historial.
 * No impone un orden fijo (hay muchas variables): solo sugiere.
 *  - avgRank: en qué posición (promedio) se suele visitar cada cliente.
 *  - transitions: qué tan seguido se visita B justo después de A.
 */
export interface SuggestionModel {
  avgRank: Map<string, number>;
  transitions: Map<string, Map<string, number>>;
}

export function buildSuggestionModel(deliveries: MyDeliveryRow[]): SuggestionModel {
  // Agrupar las entregas (con venta o no) por día
  const byDay = new Map<string, { id: string; t: number }[]>();
  for (const d of deliveries) {
    const day = d.delivered_at.slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push({ id: d.customer_id, t: new Date(d.delivered_at).getTime() });
    byDay.set(day, arr);
  }

  const rankSum = new Map<string, number>();
  const rankCount = new Map<string, number>();
  const transitions = new Map<string, Map<string, number>>();

  for (const arr of byDay.values()) {
    arr.sort((a, b) => a.t - b.t);
    // Secuencia única del día (primer paso por cada cliente)
    const seen = new Set<string>();
    const seq: string[] = [];
    for (const x of arr) { if (!seen.has(x.id)) { seen.add(x.id); seq.push(x.id); } }

    seq.forEach((id, i) => {
      rankSum.set(id, (rankSum.get(id) ?? 0) + i);
      rankCount.set(id, (rankCount.get(id) ?? 0) + 1);
      if (i > 0) {
        const from = seq[i - 1];
        const m = transitions.get(from) ?? new Map<string, number>();
        m.set(id, (m.get(id) ?? 0) + 1);
        transitions.set(from, m);
      }
    });
  }

  const avgRank = new Map<string, number>();
  for (const [id, s] of rankSum) avgRank.set(id, s / (rankCount.get(id) ?? 1));

  return { avgRank, transitions };
}

/**
 * Sugiere el próximo cliente entre los pendientes.
 * Prioriza el que suele ir después del último visitado; si no, el de menor
 * rango promedio; si no hay historial, el primero de la lista.
 */
export function suggestNext(
  model: SuggestionModel,
  lastId: string | null,
  pendingIds: string[],
): string | null {
  if (pendingIds.length === 0) return null;

  if (lastId) {
    const m = model.transitions.get(lastId);
    if (m) {
      let best: string | null = null;
      let bestC = 0;
      for (const id of pendingIds) {
        const c = m.get(id) ?? 0;
        if (c > bestC) { bestC = c; best = id; }
      }
      if (best) return best;
    }
  }

  let best: string | null = null;
  let bestR = Infinity;
  for (const id of pendingIds) {
    const r = model.avgRank.get(id) ?? Infinity;
    if (r < bestR) { bestR = r; best = id; }
  }
  return best ?? pendingIds[0];
}
