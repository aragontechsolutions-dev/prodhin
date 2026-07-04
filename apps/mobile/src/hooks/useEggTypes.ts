import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { EggType } from '../types';

export function useEggTypes() {
  return useQuery({
    queryKey: ['egg-types'],
    // Revalida al montar/enfocar para que las categorías nuevas o cambiadas
    // desde el panel web aparezcan enseguida. Offline sigue usando la caché.
    staleTime: 0,
    gcTime: 1000 * 60 * 60 * 24 * 7, // 1 semana en caché (offline)
    refetchOnMount: 'always',
    refetchOnReconnect: true,
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
