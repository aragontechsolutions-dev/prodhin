import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface MyLeave {
  from_driver_id: string;
  to_driver_id: string;
  start_date: string;
  end_date: string;
  cover_name: string | null;
}

/**
 * Devuelve la licencia ACTIVA del chofer (si está cubierto hoy por otro).
 * Si el chofer está de licencia, no debería poder operar en la app.
 * Offline / error: devuelve null (no bloquea, para no dejar afuera a quien
 * sí está trabajando por falta de señal).
 */
export function useMyLeave(driverId?: string) {
  return useQuery({
    queryKey: ['my-leave', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    networkMode: 'offlineFirst',
    refetchOnReconnect: 'always',
    queryFn: async (): Promise<MyLeave | null> => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('driver_delegations')
        .select('from_driver_id, to_driver_id, start_date, end_date, cover:to_driver_id(full_name)')
        .eq('from_driver_id', driverId!)
        .eq('is_active', true)
        .lte('start_date', today)
        .gte('end_date', today)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null; // offline / sin permiso → no bloquear
      if (!data) return null;
      const d = data as unknown as {
        from_driver_id: string; to_driver_id: string; start_date: string; end_date: string;
        cover: { full_name: string | null } | null;
      };
      return {
        from_driver_id: d.from_driver_id,
        to_driver_id: d.to_driver_id,
        start_date: d.start_date,
        end_date: d.end_date,
        cover_name: d.cover?.full_name ?? null,
      };
    },
  });
}
