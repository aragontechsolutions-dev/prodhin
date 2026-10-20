import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/** Cajas plásticas que hay actualmente en el local de un cliente. */
export function useCustomerBoxBalance(customerId: string | undefined) {
  return useQuery({
    queryKey: ['box-balance', customerId],
    enabled: !!customerId,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from('customer_box_balance')
        .select('cajas_en_local')
        .eq('customer_id', customerId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.cajas_en_local as number | undefined) ?? 0;
    },
  });
}
