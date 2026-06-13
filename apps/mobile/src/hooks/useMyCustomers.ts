import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Customer } from '../types';

export function useMyCustomers(driverId: string | undefined) {
  return useQuery({
    queryKey: ['my-customers', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 60 * 5,         // 5 min frescos
    gcTime: 1000 * 60 * 60 * 24,      // 24 h en caché
    networkMode: 'offlineFirst',       // usar caché aunque no haya red
    queryFn: async (): Promise<Customer[]> => {
      // Traer IDs de clientes asignados a este chofer
      const { data: assignments, error: aErr } = await supabase
        .from('driver_customers')
        .select('customer_id')
        .eq('driver_id', driverId!);

      if (aErr) throw aErr;

      const ids = assignments?.map((r) => r.customer_id) ?? [];
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .in('id', ids);

      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });
}
