import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface Route {
  id: string;
  name: string;
  driver_id: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RouteStop {
  id: string;
  route_id: string;
  customer_id: string;
  day_of_week: number;
  created_at: string;
}

export interface RouteWithDriver extends Route {
  driver_name?: string | null;
}

export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: async (): Promise<RouteWithDriver[]> => {
      const { data: routes, error } = await supabase
        .from('routes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name');

      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

      return (routes ?? []).map((r) => ({
        ...r,
        driver_name: r.driver_id ? (profileMap.get(r.driver_id) ?? null) : null,
      }));
    },
  });
}

export function useRouteStops(routeId: string | null) {
  return useQuery({
    queryKey: ['route-stops', routeId],
    enabled: !!routeId,
    queryFn: async (): Promise<RouteStop[]> => {
      const { data, error } = await supabase
        .from('route_stops')
        .select('*')
        .eq('route_id', routeId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; driver_id: string | null; created_by: string }) => {
      const { error } = await supabase.from('routes').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  });
}

export function useUpdateRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Pick<Route, 'name' | 'driver_id' | 'is_active'>> }) => {
      const { error } = await supabase.from('routes').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  });
}

export function useDeleteRoute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('routes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  });
}

export function useAddRouteStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { route_id: string; customer_id: string; day_of_week: number }) => {
      const { error } = await supabase.from('route_stops').insert(payload);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['route-stops', v.route_id] }),
  });
}

export function useRemoveRouteStop() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, route_id }: { id: string; route_id: string }) => {
      const { error } = await supabase.from('route_stops').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['route-stops', v.route_id] }),
  });
}
