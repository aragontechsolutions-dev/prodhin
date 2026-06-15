import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Customer } from '../types';

export function useMyCustomers(driverId: string | undefined) {
  return useQuery({
    queryKey: ['my-customers', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<Customer[]> => {
      const today = new Date().toISOString().split('T')[0];

      // Direct assignments
      const { data: assignments, error: aErr } = await supabase
        .from('driver_customers')
        .select('customer_id')
        .eq('driver_id', driverId!);
      if (aErr) throw aErr;

      // Active delegations where this driver is the covering driver (to_driver_id)
      const { data: delegations, error: dErr } = await supabase
        .from('driver_delegations')
        .select('from_driver_id')
        .eq('to_driver_id', driverId!)
        .eq('is_active', true)
        .lte('start_date', today)
        .gte('end_date', today);
      if (dErr) throw dErr;

      const directIds = assignments?.map((r) => r.customer_id) ?? [];

      // For each delegated driver, get their customer IDs
      let delegatedIds: string[] = [];
      if (delegations && delegations.length > 0) {
        const fromDriverIds = delegations.map((d) => d.from_driver_id);
        const { data: delegatedAssignments, error: daErr } = await supabase
          .from('driver_customers')
          .select('customer_id')
          .in('driver_id', fromDriverIds);
        if (daErr) throw daErr;
        delegatedIds = delegatedAssignments?.map((r) => r.customer_id) ?? [];
      }

      const allIds = [...new Set([...directIds, ...delegatedIds])];
      if (allIds.length === 0) return [];

      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .in('id', allIds);
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });
}
