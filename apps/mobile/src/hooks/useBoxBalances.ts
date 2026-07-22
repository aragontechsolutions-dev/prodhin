import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Saldo de cajas plásticas de TODOS los clientes (customer_id -> cajas_en_local).
 * Se trae de una sola vez y se cachea en el teléfono, así funciona offline
 * aunque no se haya abierto ese cliente antes.
 */
export function useBoxBalances() {
  return useQuery({
    queryKey: ['box-balances-all'],
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 60 * 24 * 3, // 3 días en caché para uso offline
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('customer_box_balance')
        .select('customer_id, cajas_en_local');
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.customer_id as string] = (r.cajas_en_local as number) ?? 0;
      return map;
    },
  });
}
