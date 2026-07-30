import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface CustomerScheduleRow {
  customer_id: string;
  closing_time: string; // "HH:MM:SS"
}

// Todos los horarios de cierre (customer_id -> closing_time). Cacheado offline.
export function useCustomerSchedules() {
  return useQuery({
    queryKey: ['customer-schedules'],
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    refetchOnReconnect: 'always',
    queryFn: async (): Promise<CustomerScheduleRow[]> => {
      const { data, error } = await supabase
        .from('customer_schedules')
        .select('customer_id, closing_time');
      if (error) throw error;
      return (data ?? []) as CustomerScheduleRow[];
    },
  });
}

export function useSetSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ customer_id, closing_time, updated_by }: { customer_id: string; closing_time: string; updated_by: string }) => {
      const { error } = await supabase
        .from('customer_schedules')
        .upsert({ customer_id, closing_time, updated_by, updated_at: new Date().toISOString() }, { onConflict: 'customer_id' });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-schedules'] }),
  });
}

export function useClearSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customer_id: string) => {
      const { error } = await supabase.from('customer_schedules').delete().eq('customer_id', customer_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customer-schedules'] }),
  });
}
