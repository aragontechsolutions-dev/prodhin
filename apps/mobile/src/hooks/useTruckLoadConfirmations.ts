import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  CONFIRM_LOAD_KEY,
  confirmLoad,
  type LoadConfirmationRow,
  type ConfirmLoadInput,
} from '../lib/loadConfirm';

const SINCE_DAYS = 120;

export function useTruckLoadConfirmations(driverId?: string) {
  return useQuery({
    queryKey: ['load-confirmations', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    refetchOnReconnect: true,
    queryFn: async (): Promise<LoadConfirmationRow[]> => {
      const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('truck_load_confirmations')
        .select('id, load_created_at, has_discrepancy, confirmed_at')
        .eq('driver_id', driverId!)
        .gte('confirmed_at', since)
        .order('confirmed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as LoadConfirmationRow[];
    },
  });
}

export function useConfirmLoad() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CONFIRM_LOAD_KEY,
    mutationFn: confirmLoad,
    // Optimista: agrega la confirmación a la caché al instante para que
    // funcione offline (desbloquea entregas aunque la mutación esté en cola).
    onMutate: async (vars: ConfirmLoadInput) => {
      const key = ['load-confirmations', vars.driver_id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LoadConfirmationRow[]>(key) ?? [];
      const optimistic: LoadConfirmationRow = {
        id: vars.id,
        load_created_at: vars.load_created_at,
        has_discrepancy: vars.has_discrepancy,
        confirmed_at: new Date().toISOString(),
      };
      qc.setQueryData<LoadConfirmationRow[]>(key, [optimistic, ...prev]);
      return { prev, key };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['load-confirmations'] }),
  });
}
