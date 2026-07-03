import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface EggType {
  id: string;
  name: string;
  color: 'rojo' | 'blanco' | null;
  sort_order: number;
  is_active: boolean;
}

export function useEggTypes() {
  return useQuery({
    queryKey: ['egg-types'],
    queryFn: async (): Promise<EggType[]> => {
      const { data, error } = await supabase
        .from('egg_types')
        .select('id, name, color, sort_order, is_active')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EggType[];
    },
  });
}
