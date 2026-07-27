import { supabase } from './supabase';
import type { TruckLoadRow } from './truck';

export const CONFIRM_LOAD_KEY = ['confirm-truck-load'] as const;

export interface LoadConfirmationRow {
  id: string;
  load_created_at: string;
  has_discrepancy: boolean;
  confirmed_at: string;
}

export interface ConfirmLoadInput {
  id: string;                 // id generado en el cliente (idempotencia offline)
  driver_id: string;
  load_created_at: string;    // timestamp del lote (tal cual viene de truck_loads)
  has_discrepancy: boolean;
  note?: string | null;
  details?: unknown;          // { assigned: {egg_type_id: qty}, actual?: {egg_type_id: qty} }
}

// Idempotente por id → segura de reintentar offline.
export async function confirmLoad(input: ConfirmLoadInput): Promise<void> {
  const { error } = await supabase.from('truck_load_confirmations').upsert(
    {
      id: input.id,
      driver_id: input.driver_id,
      load_created_at: input.load_created_at,
      has_discrepancy: input.has_discrepancy,
      note: input.note ?? null,
      details: input.details ?? null,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw error;
}

export interface PendingLoad {
  atMs: number;
  loadCreatedAt: string; // ISO original del lote (para guardar en la confirmación)
  items: { egg_type_id: string; cajas_plasticas: number }[];
}

// Ventana de "carga del día": si el último lote tiene más de 48 h, ya no
// bloquea (evita trabar por cargas históricas viejas al estrenar la función).
const RECENT_MS = 1000 * 60 * 60 * 48;

/**
 * Devuelve el último lote de carga SIN confirmar (y reciente), o null si no
 * hay nada pendiente. Un lote = filas de truck_loads con el mismo created_at.
 */
export function getPendingLoad(
  loads: TruckLoadRow[],
  confirmations: LoadConfirmationRow[],
  nowMs: number,
): PendingLoad | null {
  if (!loads.length) return null;

  const batches = new Map<string, { egg_type_id: string; cajas_plasticas: number }[]>();
  for (const l of loads) {
    const arr = batches.get(l.created_at) ?? [];
    arr.push({ egg_type_id: l.egg_type_id, cajas_plasticas: l.cajas_plasticas });
    batches.set(l.created_at, arr);
  }

  const confirmedMs = new Set(confirmations.map((c) => new Date(c.load_created_at).getTime()));

  let latest: { at: string; atMs: number } | null = null;
  for (const at of batches.keys()) {
    const atMs = new Date(at).getTime();
    if (!latest || atMs > latest.atMs) latest = { at, atMs };
  }
  if (!latest) return null;
  if (nowMs - latest.atMs > RECENT_MS) return null; // ya no es del día
  if (confirmedMs.has(latest.atMs)) return null;    // ya confirmado

  return { atMs: latest.atMs, loadCreatedAt: latest.at, items: batches.get(latest.at)! };
}
