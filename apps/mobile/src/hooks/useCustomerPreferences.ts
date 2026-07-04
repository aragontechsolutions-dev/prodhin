import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { CustomerEggPreference } from '../types';
import {
  ADD_PREFERENCE_KEY,
  REMOVE_PREFERENCE_KEY,
  SET_PRIMARY_PREFERENCE_KEY,
  addPreference,
  removePreference,
  setPrimaryPreference,
} from '../lib/preferences';

const PREFS_KEY = ['customer-egg-prefs'];

/**
 * Todas las preferencias de los clientes que el chofer puede ver.
 * RLS ya limita las filas a sus clientes, así que basta un select simple.
 */
export function useCustomerPreferences() {
  return useQuery({
    queryKey: PREFS_KEY,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    networkMode: 'offlineFirst',
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
    mutationKey: ADD_PREFERENCE_KEY,
    mutationFn: addPreference,
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}

export function useRemovePreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: REMOVE_PREFERENCE_KEY,
    mutationFn: removePreference,
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}

export function useSetPrimaryPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: SET_PRIMARY_PREFERENCE_KEY,
    mutationFn: setPrimaryPreference,
    onSuccess: () => qc.invalidateQueries({ queryKey: PREFS_KEY }),
  });
}
