import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  REGISTER_MAPLE_KEY,
  registerMapleReturn,
  type MapleReturnRow,
  type RegisterMapleInput,
} from '../lib/mapleReturns';

const SINCE_DAYS = 120;

export function useMapleReturns(driverId?: string) {
  return useQuery({
    queryKey: ['maple-returns', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    refetchOnReconnect: true,
    queryFn: async (): Promise<MapleReturnRow[]> => {
      const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('maple_returns')
        .select('id, driver_id, declared_qty, status, approved_qty, driver_note, review_note, reviewed_at, created_at')
        .eq('driver_id', driverId!)
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MapleReturnRow[];
    },
  });
}

export function useRegisterMapleReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: REGISTER_MAPLE_KEY,
    mutationFn: registerMapleReturn,
    // Optimista: aparece al instante en la lista (funciona offline).
    onMutate: async (vars: RegisterMapleInput) => {
      const key = ['maple-returns', vars.driver_id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<MapleReturnRow[]>(key) ?? [];
      const optimistic: MapleReturnRow = {
        id: vars.id,
        driver_id: vars.driver_id,
        declared_qty: vars.declared_qty,
        status: 'pendiente',
        approved_qty: null,
        driver_note: vars.driver_note ?? null,
        review_note: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
      };
      qc.setQueryData<MapleReturnRow[]>(key, [optimistic, ...prev]);
      return { prev, key };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['maple-returns'] }),
  });
}
