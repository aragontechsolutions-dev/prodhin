import { supabase } from './supabase';

export const REGISTER_PICKUP_KEY = ['register-box-pickup'] as const;

export interface RegisterPickupInput {
  id: string;            // id del cliente (idempotencia offline)
  customer_id: string;
  driver_id: string;
  qty: number;
  note?: string | null;
}

// Idempotente por id → segura de reintentar offline.
export async function registerBoxPickup(input: RegisterPickupInput): Promise<void> {
  const { error } = await supabase.from('box_pickups').upsert(
    {
      id: input.id,
      customer_id: input.customer_id,
      driver_id: input.driver_id,
      qty: input.qty,
      note: input.note ?? null,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw error;
}
