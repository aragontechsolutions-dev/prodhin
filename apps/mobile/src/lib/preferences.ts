import { supabase } from './supabase';

// Claves de mutación (registradas también en App.tsx para reanudar offline)
export const ADD_PREFERENCE_KEY = ['add-egg-preference'] as const;
export const REMOVE_PREFERENCE_KEY = ['remove-egg-preference'] as const;
export const SET_PRIMARY_PREFERENCE_KEY = ['set-primary-egg-preference'] as const;

export interface AddPreferenceInput {
  customer_id: string;
  egg_type_id: string;
  make_primary?: boolean;
}

export interface PreferenceRef {
  customer_id: string;
  egg_type_id: string;
}

// Todas idempotentes → seguras de reintentar tras recuperar señal.

export async function addPreference(input: AddPreferenceInput): Promise<void> {
  const { error } = await supabase
    .from('customer_egg_preferences')
    .upsert(
      {
        customer_id: input.customer_id,
        egg_type_id: input.egg_type_id,
        is_primary: input.make_primary ?? false,
      },
      { onConflict: 'customer_id,egg_type_id' },
    );
  if (error) throw error;
}

export async function removePreference(ref: PreferenceRef): Promise<void> {
  const { error } = await supabase
    .from('customer_egg_preferences')
    .delete()
    .eq('customer_id', ref.customer_id)
    .eq('egg_type_id', ref.egg_type_id);
  if (error) throw error;
}

export async function setPrimaryPreference(ref: PreferenceRef): Promise<void> {
  // El trigger de la BD desmarca los demás principales del cliente
  const { error } = await supabase
    .from('customer_egg_preferences')
    .update({ is_primary: true })
    .eq('customer_id', ref.customer_id)
    .eq('egg_type_id', ref.egg_type_id);
  if (error) throw error;
}
