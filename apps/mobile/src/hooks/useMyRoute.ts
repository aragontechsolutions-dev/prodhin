import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface RouteStop {
  customer_id: string;
  day_of_week: number;
}

export function getTodayDayOfWeek(): number {
  // JS: 0=Sun, 1=Mon...6=Sat → DB: 1=Mon...6=Sat, -1=Sunday (no route)
  const day = new Date().getDay();
  return day === 0 ? -1 : day;
}

export function isSummerSeason(): boolean {
  const m = new Date().getMonth() + 1; // 1-12
  return m >= 11 || m <= 2;
}

export function useMyRoute(driverId: string | undefined) {
  return useQuery({
    queryKey: ['my-route', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 60 * 24,
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<RouteStop[]> => {
      const today = new Date().toISOString().split('T')[0];

      // If covering another driver, use their route
      const { data: delegations } = await supabase
        .from('driver_delegations')
        .select('from_driver_id')
        .eq('to_driver_id', driverId!)
        .eq('is_active', true)
        .lte('start_date', today)
        .gte('end_date', today);

      const effectiveDriverId =
        delegations?.length ? delegations[0].from_driver_id : driverId!;

      console.log('[ROUTE] driverId:', driverId, 'effectiveDriverId:', effectiveDriverId);

      const { data: routes, error: rErr } = await supabase
        .from('routes')
        .select('id')
        .eq('driver_id', effectiveDriverId)
        .eq('is_active', true)
        .limit(1);

      console.log('[ROUTE] routes:', JSON.stringify(routes), 'error:', rErr?.message);

      // Fallback: if covering driver but absent has no route, use own route
      let finalRoutes = routes;
      if ((!routes?.length) && effectiveDriverId !== driverId!) {
        const { data: ownRoutes } = await supabase
          .from('routes')
          .select('id')
          .eq('driver_id', driverId!)
          .eq('is_active', true)
          .limit(1);
        console.log('[ROUTE] fallback to own route:', JSON.stringify(ownRoutes));
        finalRoutes = ownRoutes;
      }

      if (!finalRoutes?.length) return [];

      const { data: stops, error } = await supabase
        .from('route_stops')
        .select('customer_id, day_of_week')
        .eq('route_id', finalRoutes![0].id);

      console.log('[ROUTE] stops:', JSON.stringify(stops), 'error:', error?.message);
      console.log('[ROUTE] todayDow:', new Date().getDay(), 'today:', new Date().toISOString().split('T')[0]);

      if (error) throw error;
      return (stops ?? []) as RouteStop[];
    },
  });
}
