import { supabase } from './supabase';

export const REGISTER_COMPETITOR_KEY = ['register-competitor'] as const;

export interface RegisterCompetitorInput {
  id: string;            // uuid generado en el cliente (idempotencia offline)
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  notes?: string | null;
}

// El chofer PROPONE un competidor: entra como 'pendiente' para que el admin
// lo apruebe. Idempotente por id → segura de reintentar offline.
export async function registerCompetitor(input: RegisterCompetitorInput): Promise<void> {
  const { error } = await supabase.from('competitors').upsert(
    {
      id: input.id,
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      radius_m: input.radius_m,
      notes: input.notes ?? null,
      status: 'pendiente',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw error;
}
