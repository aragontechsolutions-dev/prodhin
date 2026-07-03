import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type DeliveryStatus =
  | 'entregado'
  | 'cliente_ausente'
  | 'rechazado'
  | 'sin_stock';

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  entregado: 'Entregado',
  cliente_ausente: 'Cliente ausente',
  rechazado: 'No quiso',
  sin_stock: 'Sin stock',
};

export interface DeliveryItemRow {
  id: string;
  cajas_plasticas: number;
  egg_type_id: string;
  egg_type_name: string | null;
  egg_type_color: 'rojo' | 'blanco' | null;
}

export interface DeliveryRow {
  id: string;
  customer_id: string;
  customer_name: string;
  driver_id: string;
  driver_name: string;
  status: DeliveryStatus;
  notes: string | null;
  delivered_at: string;
  items: DeliveryItemRow[];
  total_cajas_plasticas: number;
}

// 1 cajón = 2 cajas plásticas
export function cajones(cajasPlasticas: number): number {
  return cajasPlasticas / 2;
}

export function formatCajones(cajasPlasticas: number): string {
  const c = cajones(cajasPlasticas);
  return Number.isInteger(c) ? String(c) : c.toFixed(1);
}

interface RawDelivery {
  id: string;
  customer_id: string;
  driver_id: string;
  status: DeliveryStatus;
  notes: string | null;
  delivered_at: string;
  customers: {
    customer_type: 'persona_fisica' | 'empresa';
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
  } | null;
  profiles: { full_name: string } | null;
  delivery_items: {
    id: string;
    cajas_plasticas: number;
    egg_type_id: string;
    egg_types: { name: string; color: 'rojo' | 'blanco' | null } | null;
  }[];
}

function rawCustomerName(c: RawDelivery['customers']): string {
  if (!c) return 'Cliente eliminado';
  if (c.customer_type === 'empresa') return c.business_name ?? 'Sin nombre';
  return `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Sin nombre';
}

export interface DeliveryFilters {
  from: string; // fecha ISO (inclusive) — inicio del día
  to: string;   // fecha ISO (inclusive) — fin del día
  driverId?: string;
  eggTypeId?: string;
}

export function useDeliveries(filters: DeliveryFilters) {
  return useQuery({
    queryKey: ['deliveries', filters],
    queryFn: async (): Promise<DeliveryRow[]> => {
      // El rango de fechas se convierte a límites de día completos
      const fromTs = new Date(`${filters.from}T00:00:00`).toISOString();
      const toTs = new Date(`${filters.to}T23:59:59.999`).toISOString();

      let query = supabase
        .from('deliveries')
        .select(`
          id, customer_id, driver_id, status, notes, delivered_at,
          customers!customer_id(customer_type, first_name, last_name, business_name),
          profiles!driver_id(full_name),
          delivery_items(id, cajas_plasticas, egg_type_id, egg_types(name, color))
        `)
        .gte('delivered_at', fromTs)
        .lte('delivered_at', toTs)
        .order('delivered_at', { ascending: false });

      if (filters.driverId) query = query.eq('driver_id', filters.driverId);

      const { data, error } = await query;
      if (error) throw error;

      let rows: DeliveryRow[] = ((data ?? []) as unknown as RawDelivery[]).map((d) => {
        const items: DeliveryItemRow[] = (d.delivery_items ?? []).map((it) => ({
          id: it.id,
          cajas_plasticas: it.cajas_plasticas,
          egg_type_id: it.egg_type_id,
          egg_type_name: it.egg_types?.name ?? null,
          egg_type_color: it.egg_types?.color ?? null,
        }));
        return {
          id: d.id,
          customer_id: d.customer_id,
          customer_name: rawCustomerName(d.customers),
          driver_id: d.driver_id,
          driver_name: d.profiles?.full_name ?? 'Chofer',
          status: d.status,
          notes: d.notes,
          delivered_at: d.delivered_at,
          items,
          total_cajas_plasticas: items.reduce((s, it) => s + it.cajas_plasticas, 0),
        };
      });

      // El filtro por tipo de huevo se aplica en cliente (afecta a las líneas)
      if (filters.eggTypeId) {
        rows = rows
          .map((r) => ({
            ...r,
            items: r.items.filter((it) => it.egg_type_id === filters.eggTypeId),
          }))
          .filter((r) => r.items.length > 0)
          .map((r) => ({
            ...r,
            total_cajas_plasticas: r.items.reduce((s, it) => s + it.cajas_plasticas, 0),
          }));
      }

      return rows;
    },
  });
}
