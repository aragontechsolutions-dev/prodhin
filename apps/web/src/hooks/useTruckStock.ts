import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

/** Recuento (ajuste absoluto) del camión de un chofer — solo admin. */
export function useRegisterCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      driver_id: string;
      items: { egg_type_id: string; cajas_plasticas: number }[];
    }) => {
      const counted_at = new Date().toISOString();
      const rows = input.items.map((it) => ({
        driver_id: input.driver_id,
        egg_type_id: it.egg_type_id,
        cajas_plasticas: Math.max(0, it.cajas_plasticas),
        counted_at,
      }));
      if (rows.length === 0) return;
      const { error } = await supabase.from('truck_counts').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['truck-stock'] }),
  });
}
