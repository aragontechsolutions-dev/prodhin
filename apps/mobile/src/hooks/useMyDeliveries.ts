import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { DeliveryStatus } from '../types';

export interface DeliveryItemRow {
  id: string;
  cajas_plasticas: number;
  egg_type_id: string;
  egg_type_name: string | null;
  egg_type_color: 'rojo' | 'blanco' | null;
}

export interface MyDeliveryRow {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_tax_id: string | null;
  status: DeliveryStatus;
  notes: string | null;
  delivered_at: string;
  items: DeliveryItemRow[];
  total_cajas_plasticas: number;
}

interface RawDelivery {
  id: string;
  customer_id: string;
  status: DeliveryStatus;
  notes: string | null;
  delivered_at: string;
  customers: {
    customer_type: 'persona_fisica' | 'empresa';
    first_name: string | null;
    last_name: string | null;
    business_name: string | null;
    tax_id: string | null;
  } | null;
  delivery_items: {
    id: string;
    cajas_plasticas: number;
    egg_type_id: string;
    egg_types: { name: string; color: 'rojo' | 'blanco' | null } | null;
  }[];
}

function customerName(c: RawDelivery['customers']): string {
  if (!c) return 'Cliente eliminado';
  if (c.customer_type === 'empresa') return c.business_name ?? 'Sin nombre';
  return `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Sin nombre';
}

export const HISTORY_DAYS = 90;

/** Entregas propias del chofer de los últimos HISTORY_DAYS días. */
export function useMyDeliveries(driverId: string | undefined) {
  return useQuery({
    queryKey: ['my-deliveries', driverId],
    enabled: !!driverId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 60 * 24 * 3, // 3 días en caché para consultas offline
    networkMode: 'offlineFirst',
    refetchOnReconnect: 'always',
    queryFn: async (): Promise<MyDeliveryRow[]> => {
      const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          id, customer_id, status, notes, delivered_at,
          customers!customer_id(customer_type, first_name, last_name, business_name, tax_id),
          delivery_items(id, cajas_plasticas, egg_type_id, egg_types(name, color))
        `)
        .eq('driver_id', driverId!)
        .gte('delivered_at', since)
        .order('delivered_at', { ascending: false });
      if (error) throw error;

      return ((data ?? []) as unknown as RawDelivery[]).map((d) => {
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
          customer_name: customerName(d.customers),
          customer_tax_id: d.customers?.tax_id ?? null,
          status: d.status,
          notes: d.notes,
          delivered_at: d.delivered_at,
          items,
          total_cajas_plasticas: items.reduce((s, it) => s + it.cajas_plasticas, 0),
        };
      });
    },
  });
}
