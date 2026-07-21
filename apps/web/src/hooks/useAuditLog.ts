import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface AuditRow {
  id: number;
  actor_id: string | null;
  actor_role: string | null;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table_name: string;
  row_id: string | null;
  reason: string | null;
  changed: { old?: Record<string, unknown>; new?: Record<string, unknown> } | null;
  created_at: string;
}

export interface AuditFilters {
  table?: string;
  action?: string;
  actorId?: string;
  limit?: number;
}

export function useAuditLog(filters: AuditFilters = {}) {
  return useQuery({
    queryKey: ['audit-log', filters],
    queryFn: async (): Promise<AuditRow[]> => {
      let q = supabase
        .from('audit_log')
        .select('id, actor_id, actor_role, action, table_name, row_id, reason, changed, created_at')
        .order('created_at', { ascending: false })
        .limit(filters.limit ?? 200);
      if (filters.table) q = q.eq('table_name', filters.table);
      if (filters.action) q = q.eq('action', filters.action);
      if (filters.actorId) q = q.eq('actor_id', filters.actorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });
}

export const TABLE_LABELS: Record<string, string> = {
  deliveries: 'Entregas',
  delivery_items: 'Líneas de entrega',
  customers: 'Clientes',
  profiles: 'Usuarios',
  routes: 'Rutas',
  route_stops: 'Paradas de ruta',
  egg_types: 'Categorías de huevo',
  customer_egg_preferences: 'Preferencias de cliente',
  truck_loads: 'Cargas de camión',
  truck_counts: 'Recuentos de camión',
  driver_customers: 'Asignaciones',
  driver_delegations: 'Delegaciones',
};
