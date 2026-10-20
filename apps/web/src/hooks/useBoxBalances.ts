import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/** Saldo de cajas plásticas por cliente (customer_id -> cajas_en_local). */
export function useBoxBalances() {
  return useQuery({
    queryKey: ['box-balances'],
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('customer_box_balance')
        .select('customer_id, cajas_en_local');
      if (error) throw error;
      const m = new Map<string, number>();
      for (const r of data ?? []) m.set(r.customer_id as string, (r.cajas_en_local as number) ?? 0);
      return m;
    },
  });
}
