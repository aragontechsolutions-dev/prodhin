import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  REGISTER_LOADS_KEY,
  REGISTER_COUNTS_KEY,
  registerLoads,
  registerCounts,
  type TruckLoadRow,
  type TruckCountRow,
} from '../lib/truck';

const SINCE_DAYS = 120;

export function useTruckLoads(driverId: string | undefined) {
  return useQuery({
    queryKey: ['truck-loads', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    refetchOnReconnect: 'always',
    queryFn: async (): Promise<TruckLoadRow[]> => {
      const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('truck_loads')
        .select('id, egg_type_id, cajas_plasticas, created_at')
        .eq('driver_id', driverId!)
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TruckLoadRow[];
    },
  });
}

export function useTruckCounts(driverId: string | undefined) {
  return useQuery({
    queryKey: ['truck-counts', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    refetchOnReconnect: 'always',
    queryFn: async (): Promise<TruckCountRow[]> => {
      const since = new Date(Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('truck_counts')
        .select('id, egg_type_id, cajas_plasticas, counted_at')
        .eq('driver_id', driverId!)
        .gte('counted_at', since)
        .order('counted_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as TruckCountRow[];
    },
  });
}

export function useRegisterLoads() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: REGISTER_LOADS_KEY,
    mutationFn: registerLoads,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['truck-loads'] }),
  });
}

export function useRegisterCounts() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: REGISTER_COUNTS_KEY,
    mutationFn: registerCounts,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['truck-counts'] }),
  });
}
