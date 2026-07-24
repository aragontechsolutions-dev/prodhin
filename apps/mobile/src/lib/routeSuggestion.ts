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

export interface LatLng { lat: number; lng: number }

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371, p = Math.PI / 180;
  const dLat = (b.lat - a.lat) * p, dLng = (b.lng - a.lng) * p;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Sugiere el próximo cliente entre los pendientes.
 *
 * Si hay posición actual + coordenadas, optimiza por RUTA MÁS CORTA usando la
 * distancia como base, ajustada por el historial: descuenta al cliente que
 * suele ir después del último y penaliza a los que suelen ir al final. Así
 * gana el más cercano, salvo que la costumbre sugiera fuerte otra cosa.
 *
 * Sin posición, cae al histórico puro (transición y luego rango).
 */
export function suggestNext(
  model: SuggestionModel,
  lastId: string | null,
  pendingIds: string[],
  opts?: { coords?: Map<string, LatLng>; current?: LatLng | null },
): string | null {
  if (pendingIds.length === 0) return null;

  const coords = opts?.coords;
  const current = opts?.current ?? null;
  const transFrom = lastId ? model.transitions.get(lastId) : undefined;

  // Con posición → optimizar por distancia + costumbre
  if (coords && current) {
    let best: string | null = null;
    let bestCost = Infinity;
    for (const id of pendingIds) {
      const c = coords.get(id);
      const dist = c ? haversineKm(current, c) : 5; // 5 km si falta la coord
      const rank = model.avgRank.get(id) ?? 3;
      const trans = transFrom?.get(id) ?? 0;
      // costo en "km": distancia + peso por posición histórica − bonus de transición
      const cost = dist + rank * 0.35 - Math.min(trans, 5) * 0.6;
      if (cost < bestCost) { bestCost = cost; best = id; }
    }
    if (best) return best;
  }

  // Sin posición → histórico puro
  if (transFrom) {
    let best: string | null = null;
    let bestC = 0;
    for (const id of pendingIds) {
      const c = transFrom.get(id) ?? 0;
      if (c > bestC) { bestC = c; best = id; }
    }
    if (best) return best;
  }
  let best: string | null = null;
  let bestR = Infinity;
  for (const id of pendingIds) {
    const r = model.avgRank.get(id) ?? Infinity;
    if (r < bestR) { bestR = r; best = id; }
  }
  return best ?? pendingIds[0];
}
