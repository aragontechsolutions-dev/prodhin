import { supabase } from './supabase';

export const REGISTER_EGG_RETURN_KEY = ['register-egg-return'] as const;

export type EggReturnStatus = 'pendiente' | 'aprobada' | 'rechazada';

export interface EggReturnItemRow {
  id: string;
  egg_type_id: string;
  qty: number;
  expiry_date: string;
  returned_qty: number | null;
  returned_expiry_date: string | null;
}

export interface EggReturnRow {
  id: string;
  driver_id: string;
  broken_qty: number;
  broken_returned: number | null;
  status: EggReturnStatus;
  driver_note: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  items: EggReturnItemRow[];
}

export interface RegisterEggReturnInput {
  id: string;                 // id del encabezado (idempotencia offline)
  driver_id: string;
  broken_qty: number;
  driver_note?: string | null;
  items: { id: string; egg_type_id: string; qty: number; expiry_date: string }[];
}

// Inserta encabezado + líneas. Idempotente por id (upsert ignoreDuplicates).
export async function registerEggReturn(input: RegisterEggReturnInput): Promise<void> {
  const { error: e1 } = await supabase.from('egg_returns').upsert(
    {
      id: input.id,
      driver_id: input.driver_id,
      broken_qty: input.broken_qty,
      driver_note: input.driver_note ?? null,
      status: 'pendiente',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (e1) throw e1;

  if (input.items.length > 0) {
    const rows = input.items.map((it) => ({
      id: it.id,
      return_id: input.id,
      egg_type_id: it.egg_type_id,
      qty: it.qty,
      expiry_date: it.expiry_date,
    }));
    const { error: e2 } = await supabase.from('egg_return_items').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (e2) throw e2;
  }
}
