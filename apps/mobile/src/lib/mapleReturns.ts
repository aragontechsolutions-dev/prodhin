import { supabase } from './supabase';

export const REGISTER_MAPLE_KEY = ['register-maple-return'] as const;

export type MapleStatus = 'pendiente' | 'aprobada' | 'rechazada';

export interface MapleReturnRow {
  id: string;
  driver_id: string;
  declared_qty: number;
  status: MapleStatus;
  approved_qty: number | null;
  driver_note: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface RegisterMapleInput {
  id: string;            // id generado en el cliente (idempotencia offline)
  driver_id: string;
  declared_qty: number;
  driver_note?: string | null;
}

// Idempotente por id → segura de reintentar offline.
export async function registerMapleReturn(input: RegisterMapleInput): Promise<void> {
  const { error } = await supabase.from('maple_returns').upsert(
    {
      id: input.id,
      driver_id: input.driver_id,
      declared_qty: input.declared_qty,
      driver_note: input.driver_note ?? null,
      status: 'pendiente',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw error;
}
