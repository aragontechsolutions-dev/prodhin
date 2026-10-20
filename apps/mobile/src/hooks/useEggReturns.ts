import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  REGISTER_EGG_RETURN_KEY,
  registerEggReturn,
  type EggReturnRow,
  type RegisterEggReturnInput,
} from '../lib/eggReturns';

const SINCE_DAYS = 120;

export function useEggReturns(driverId?: string) {
  return useQuery({
    queryKey: ['egg-returns', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    refetchOnReconnect: 'always',
    queryFn: async (): Promise<EggReturnRow[]> => {
      const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('egg_returns')
        .select('id, driver_id, broken_qty, broken_returned, status, driver_note, review_note, reviewed_at, created_at, items:egg_return_items(id, egg_type_id, qty, expiry_date, returned_qty, returned_expiry_date)')
        .eq('driver_id', driverId!)
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EggReturnRow[];
    },
  });
}

export function useRegisterEggReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: REGISTER_EGG_RETURN_KEY,
    mutationFn: registerEggReturn,
    onMutate: async (vars: RegisterEggReturnInput) => {
      const key = ['egg-returns', vars.driver_id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<EggReturnRow[]>(key) ?? [];
      const optimistic: EggReturnRow = {
        id: vars.id,
        driver_id: vars.driver_id,
        broken_qty: vars.broken_qty,
        broken_returned: null,
        status: 'pendiente',
        driver_note: vars.driver_note ?? null,
        review_note: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
        items: vars.items.map((it) => ({
          id: it.id,
          egg_type_id: it.egg_type_id,
          qty: it.qty,
          expiry_date: it.expiry_date,
          returned_qty: null,
          returned_expiry_date: null,
        })),
      };
      qc.setQueryData<EggReturnRow[]>(key, [optimistic, ...prev]);
      return { prev, key };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['egg-returns'] }),
  });
}
