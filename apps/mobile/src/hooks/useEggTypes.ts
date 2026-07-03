import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { EggType } from '../types';

export function useEggTypes() {
  return useQuery({
    queryKey: ['egg-types'],
    staleTime: 1000 * 60 * 60,      // 1 h — el catálogo cambia poco
    gcTime: 1000 * 60 * 60 * 24 * 7, // 1 semana en caché (offline)
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<EggType[]> => {
      const { data, error } = await supabase
        .from('egg_types')
        .select('id, name, color, sort_order, is_active')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EggType[];
    },
  });
}
