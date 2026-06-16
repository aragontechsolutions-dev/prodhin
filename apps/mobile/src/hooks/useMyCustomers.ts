import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Customer } from '../types';

export interface MyCustomers {
  own: Customer[];
  delegated: Customer[];
  debug: string;
}

export function useMyCustomers(driverId: string | undefined) {
  return useQuery({
    queryKey: ['my-customers', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<MyCustomers> => {
      const today = new Date().toISOString().split('T')[0];

      // Direct assignments
      const { data: assignments, error: aErr } = await supabase
        .from('driver_customers')
        .select('customer_id')
        .eq('driver_id', driverId!);
      if (aErr) throw aErr;

      const directIds = assignments?.map((r) => r.customer_id) ?? [];

      const debugLines: string[] = [`Hoy: ${today}`, `IDs propios: ${directIds.length}`];
      console.log('[DELEGATION] driverId:', driverId);
      console.log('[DELEGATION] today:', today);
      console.log('[DELEGATION] directIds:', directIds);

      let delegatedIds: string[] = [];
      try {
        const { data: delegations, error: dErr } = await supabase
          .from('driver_delegations')
          .select('from_driver_id')
          .eq('to_driver_id', driverId!)
          .eq('is_active', true)
          .lte('start_date', today)
          .gte('end_date', today);

        if (dErr) {
          debugLines.push(`Delegaciones ERROR: ${dErr.message} (${dErr.code})`);
          console.log('[DELEGATION] ERROR querying driver_delegations:', dErr.code, dErr.message);
        } else {
          debugLines.push(`Delegaciones encontradas: ${delegations?.length ?? 0}`);
          console.log('[DELEGATION] delegations found:', delegations?.length, JSON.stringify(delegations));
          if (delegations && delegations.length > 0) {
            const fromDriverIds = delegations.map((d) => d.from_driver_id);
            debugLines.push(`from_driver_ids: ${fromDriverIds.join(', ')}`);
            console.log('[DELEGATION] from_driver_ids:', fromDriverIds);
            const { data: delegatedAssignments, error: daErr } = await supabase
              .from('driver_customers')
              .select('customer_id')
              .in('driver_id', fromDriverIds);
            if (daErr) {
              debugLines.push(`Clientes delegados ERROR: ${daErr.message}`);
              console.log('[DELEGATION] ERROR querying delegated driver_customers:', daErr.message);
            } else {
              delegatedIds = delegatedAssignments?.map((r) => r.customer_id) ?? [];
              debugLines.push(`IDs delegados: ${delegatedIds.length}`);
              console.log('[DELEGATION] delegated customer ids:', delegatedIds);
            }
          }
        }
      } catch (e) {
        debugLines.push(`Excepción: ${e instanceof Error ? e.message : String(e)}`);
      }

      const delegatedOnlyIds = delegatedIds.filter((id) => !directIds.includes(id));
      const allIds = [...new Set([...directIds, ...delegatedOnlyIds])];
      debugLines.push(`Total IDs a buscar: ${allIds.length}`);

      if (allIds.length === 0) return { own: [], delegated: [], debug: debugLines.join('\n') };

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
        debug: debugLines.join('\n'),
      };
    },
  });
}
