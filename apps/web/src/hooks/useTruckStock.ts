import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface TruckStockRow {
  driver_id: string;
  egg_type_id: string;
  cajas_plasticas: number;
}

/** Stock actual de todos los camiones (vista truck_stock_current). */
export function useTruckStock() {
  return useQuery({
    queryKey: ['truck-stock'],
    queryFn: async (): Promise<TruckStockRow[]> => {
      const { data, error } = await supabase
        .from('truck_stock_current')
        .select('driver_id, egg_type_id, cajas_plasticas');
      if (error) throw error;
      return (data ?? []) as TruckStockRow[];
    },
  });
}
