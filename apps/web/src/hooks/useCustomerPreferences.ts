import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface CustomerEggPreference {
  id: string;
  customer_id: string;
  egg_type_id: string;
  is_primary: boolean;
}

const PREFS_KEY = ['customer-egg-prefs'];

export function useCustomerPreferences() {
  return useQuery({
    queryKey: PREFS_KEY,
    queryFn: async (): Promise<CustomerEggPreference[]> => {
      const { data, error } = await supabase
        .from('customer_egg_preferences')
        .select('id, customer_id, egg_type_id, is_primary');
      if (error) throw error;
      return (data ?? []) as CustomerEggPreference[];
    },
  });
}

export function useAddPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { customer_id: string; egg_type_id: string; make_primary?: boolean }) => {
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
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}

export function useRemovePreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ref: { customer_id: string; egg_type_id: string }) => {
      const { error } = await supabase
        .from('customer_egg_preferences')
        .delete()
        .eq('customer_id', ref.customer_id)
        .eq('egg_type_id', ref.egg_type_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}

export function useSetPrimaryPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ref: { customer_id: string; egg_type_id: string }) => {
      // El trigger de la BD desmarca los demás principales del cliente
      const { error } = await supabase
        .from('customer_egg_preferences')
        .update({ is_primary: true })
        .eq('customer_id', ref.customer_id)
        .eq('egg_type_id', ref.egg_type_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}
