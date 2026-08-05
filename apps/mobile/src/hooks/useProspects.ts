import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { REGISTER_PROSPECT_KEY, registerProspect, type RegisterProspectInput } from '../lib/prospects';

export interface MyProspectRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  has_competition: boolean;
  status: string;
  created_at: string;
}

export function useMyProspects(driverId?: string) {
  return useQuery({
    queryKey: ['my-prospects', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    refetchOnReconnect: 'always',
    queryFn: async (): Promise<MyProspectRow[]> => {
      const { data, error } = await supabase
        .from('prospects')
        .select('id, name, lat, lng, has_competition, status, created_at')
        .eq('created_by', driverId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MyProspectRow[];
    },
  });
}

export function useRegisterProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: REGISTER_PROSPECT_KEY,
    mutationFn: registerProspect,
    onMutate: async (vars: RegisterProspectInput) => {
      const key = ['my-prospects', vars.created_by];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<MyProspectRow[]>(key) ?? [];
      qc.setQueryData<MyProspectRow[]>(key, [
        { id: vars.id, name: vars.name, lat: vars.lat, lng: vars.lng, has_competition: vars.has_competition, status: 'nuevo', created_at: new Date().toISOString() },
        ...prev,
      ]);
      return { prev, key };
    },
    onError: (_e, _v, ctx) => { if (ctx) qc.setQueryData(ctx.key, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['my-prospects'] }),
  });
}
