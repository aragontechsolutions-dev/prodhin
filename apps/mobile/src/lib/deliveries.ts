import { supabase } from './supabase';
import type { DeliveryStatus } from '../types';

export interface DeliveryLineInput {
  egg_type_id: string;
  cajas_plasticas: number;
}

export type DeliveryMode = 'cp' | 'cartones';

export interface CreateDeliveryInput {
  // id generado en el cliente => reintentos offline idempotentes
  id: string;
  customer_id: string;
  driver_id: string;
  status: DeliveryStatus;
  mode: DeliveryMode;          // 'cp' deja cajas plásticas, 'cartones' no
  cajas_recogidas: number;     // cajas plásticas vacías recogidas en la visita
  notes?: string | null;
  delivered_at: string; // ISO
  items: DeliveryLineInput[];
}

export const CREATE_DELIVERY_KEY = ['create-delivery'] as const;

/**
 * Inserta la cabecera + líneas de una entrega.
 *
 * Es idempotente: la cabecera usa un id fijo generado en el cliente, así que
 * un reintento (típico tras recuperar señal) hace upsert sobre la misma fila
 * en vez de duplicar. Las líneas se re-crean tras limpiar las previas de esa
 * entrega, de modo que reintentar deja el mismo estado final.
 */
export async function createDelivery(input: CreateDeliveryInput): Promise<void> {
  const { items, ...header } = input;

  const { error: dErr } = await supabase
    .from('deliveries')
    .upsert(
      {
        id: header.id,
        customer_id: header.customer_id,
        driver_id: header.driver_id,
        status: header.status,
        mode: header.mode,
        cajas_recogidas: header.cajas_recogidas,
        notes: header.notes ?? null,
        delivered_at: header.delivered_at,
      },
      { onConflict: 'id' },
    );
  if (dErr) throw dErr;

  // Reemplaza las líneas para que el reintento sea idempotente
  const { error: delErr } = await supabase
    .from('delivery_items')
    .delete()
    .eq('delivery_id', header.id);
  if (delErr) throw delErr;

  const rows = items
    .filter((it) => it.egg_type_id)
    .map((it) => ({
      delivery_id: header.id,
      egg_type_id: it.egg_type_id,
      cajas_plasticas: it.cajas_plasticas,
    }));

  if (rows.length > 0) {
    const { error: iErr } = await supabase.from('delivery_items').insert(rows);
    if (iErr) throw iErr;
  }
}
