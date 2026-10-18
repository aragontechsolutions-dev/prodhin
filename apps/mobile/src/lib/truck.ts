import { supabase } from './supabase';
import type { MyDeliveryRow } from '../hooks/useMyDeliveries';

export interface TruckLoadRow {
  id: string;
  egg_type_id: string;
  cajas_plasticas: number;
  created_at: string;
}
export interface TruckCountRow {
  id: string;
  egg_type_id: string;
  cajas_plasticas: number;
  counted_at: string;
}

export const REGISTER_LOADS_KEY = ['register-truck-loads'] as const;
export const REGISTER_COUNTS_KEY = ['register-truck-counts'] as const;

export interface StockLineInput { id: string; egg_type_id: string; cajas_plasticas: number }

export interface RegisterLoadsInput {
  driver_id: string;
  note?: string | null;
  created_at: string;
  items: StockLineInput[]; // cajas > 0
}
export interface RegisterCountsInput {
  driver_id: string;
  counted_at: string;
  items: StockLineInput[]; // cajas >= 0 (absoluto)
}

// Idempotentes (id de cliente) → seguras de reintentar offline.
export async function registerLoads(input: RegisterLoadsInput): Promise<void> {
  const rows = input.items
    .filter((it) => it.egg_type_id && it.cajas_plasticas > 0)
    .map((it) => ({
      id: it.id,
      driver_id: input.driver_id,
      egg_type_id: it.egg_type_id,
      cajas_plasticas: it.cajas_plasticas,
      note: input.note ?? null,
      created_at: input.created_at,
    }));
  if (rows.length === 0) return;
  const { error } = await supabase.from('truck_loads').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

export async function registerCounts(input: RegisterCountsInput): Promise<void> {
  const rows = input.items
    .filter((it) => it.egg_type_id)
    .map((it) => ({
      id: it.id,
      driver_id: input.driver_id,
      egg_type_id: it.egg_type_id,
      cajas_plasticas: Math.max(0, it.cajas_plasticas),
      counted_at: input.counted_at,
    }));
  if (rows.length === 0) return;
  const { error } = await supabase.from('truck_counts').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

/**
 * Stock actual por tipo = último recuento + cargas posteriores − entregas
 * (con venta) posteriores. Mismo cálculo que la vista SQL truck_stock_current.
 */
export function computeStock(
  counts: TruckCountRow[],
  loads: TruckLoadRow[],
  deliveries: MyDeliveryRow[],
): Map<string, number> {
  const lastCount = new Map<string, { base: number; at: number }>();
  for (const c of counts) {
    const at = new Date(c.counted_at).getTime();
    const cur = lastCount.get(c.egg_type_id);
    if (!cur || at > cur.at) lastCount.set(c.egg_type_id, { base: c.cajas_plasticas, at });
  }

  const stock = new Map<string, number>();
  for (const [type, { base }] of lastCount) stock.set(type, base);

  for (const l of loads) {
    const lc = lastCount.get(l.egg_type_id);
    const at = new Date(l.created_at).getTime();
    if (!lc || at > lc.at) stock.set(l.egg_type_id, (stock.get(l.egg_type_id) ?? 0) + l.cajas_plasticas);
  }

  for (const d of deliveries) {
    if (d.status !== 'entregado') continue;
    const at = new Date(d.delivered_at).getTime();
    for (const it of d.items) {
      const lc = lastCount.get(it.egg_type_id);
      if (!lc || at > lc.at) stock.set(it.egg_type_id, (stock.get(it.egg_type_id) ?? 0) - it.cajas_plasticas);
    }
  }

  for (const [k, v] of stock) stock.set(k, Math.max(0, v));
  return stock;
}

export interface Movement {
  kind: 'base' | 'carga' | 'entrega';
  qty: number;        // con signo (+carga, -entrega, base = valor)
  at: string;         // ISO
  label: string;      // cliente / nota
  running: number;    // saldo acumulado tras este movimiento
}

/**
 * Extracto de un tipo desde su último recuento: base + cargas (+) y entregas
 * (−) posteriores, para que el chofer vea dónde se pudo descuadrar.
 */
export function extractoFor(
  typeId: string,
  counts: TruckCountRow[],
  loads: TruckLoadRow[],
  deliveries: MyDeliveryRow[],
): { movements: Movement[]; system: number } {
  // último recuento del tipo
  let baseVal = 0;
  let baseAt = 0;
  let baseIso = '';
  let hasBase = false;
  for (const c of counts) {
    if (c.egg_type_id !== typeId) continue;
    const at = new Date(c.counted_at).getTime();
    if (!hasBase || at > baseAt) { baseVal = c.cajas_plasticas; baseAt = at; baseIso = c.counted_at; hasBase = true; }
  }

  const movements: Movement[] = [];
  if (hasBase) movements.push({ kind: 'base', qty: baseVal, at: baseIso, label: 'Recuento base', running: 0 });

  const evts: { at: number; mv: Omit<Movement, 'running'> }[] = [];
  for (const l of loads) {
    if (l.egg_type_id !== typeId) continue;
    const at = new Date(l.created_at).getTime();
    if (hasBase && at <= baseAt) continue;
    evts.push({ at, mv: { kind: 'carga', qty: l.cajas_plasticas, at: l.created_at, label: 'Carga', running: 0 } });
  }
  for (const d of deliveries) {
    if (d.status !== 'entregado') continue;
    const at = new Date(d.delivered_at).getTime();
    if (hasBase && at <= baseAt) continue;
    for (const it of d.items) {
      if (it.egg_type_id !== typeId) continue;
      evts.push({ at, mv: { kind: 'entrega', qty: -it.cajas_plasticas, at: d.delivered_at, label: d.customer_name, running: 0 } });
    }
  }
  evts.sort((a, b) => a.at - b.at);

  let running = hasBase ? baseVal : 0;
  if (hasBase) movements[0].running = running;
  for (const e of evts) {
    running += e.mv.qty;
    movements.push({ ...e.mv, running });
  }
  return { movements, system: Math.max(0, running) };
}
