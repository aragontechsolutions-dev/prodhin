import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Customer } from '../types';

export interface MyCustomers {
  own: Customer[];
  delegated: Customer[];
}

export function useMyCustomers(driverId: string | undefined) {
  return useQuery({
    queryKey: ['my-customers', driverId],
    enabled: !!driverId,
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<MyCustomers> => {
      const today = new Date().toISOString().split('T')[0];

      const { data: assignments, error: aErr } = await supabase
        .from('driver_customers')
        .select('customer_id')
        .eq('driver_id', driverId!);
      if (aErr) throw aErr;

      const directIds = assignments?.map((r) => r.customer_id) ?? [];

      let delegatedIds: string[] = [];
      try {
        const { data: delegations, error: dErr } = await supabase
          .from('driver_delegations')
          .select('from_driver_id')
          .eq('to_driver_id', driverId!)
          .eq('is_active', true)
          .lte('start_date', today)
          .gte('end_date', today);

        if (!dErr && delegations && delegations.length > 0) {
          const fromDriverIds = delegations.map((d) => d.from_driver_id);
          const { data: delegatedAssignments, error: daErr } = await supabase
            .from('driver_customers')
            .select('customer_id')
            .in('driver_id', fromDriverIds);
          if (!daErr) {
            delegatedIds = delegatedAssignments?.map((r) => r.customer_id) ?? [];
          }
        }
      } catch {
        // Silently skip delegated customers if query fails
      }

      const delegatedOnlyIds = delegatedIds.filter((id) => !directIds.includes(id));
      const allIds = [...new Set([...directIds, ...delegatedOnlyIds])];
      if (allIds.length === 0) return { own: [], delegated: [] };

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .in('id', allIds);
      if (error) throw error;

      const all = (data ?? []) as Customer[];
      const directSet = new Set(directIds);

      return {
        own: all.filter((c) => directSet.has(c.id)),
        delegated: all.filter((c) => !directSet.has(c.id)),
      };
    },
  });
}
