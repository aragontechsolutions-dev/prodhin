import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Customer } from '../types';

export function useMyCustomers(driverId: string | undefined) {
  return useQuery({
    queryKey: ['my-customers', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 60 * 5, // 5 min
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .in(
          'id',
          (
            await supabase
              .from('driver_customers')
              .select('customer_id')
              .eq('driver_id', driverId!)
          ).data?.map((r) => r.customer_id) ?? [],
        );

      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });
}
