import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { DeliveryStatus } from '../types';

export type PaymentMethod = 'efectivo' | 'credito';

export interface DeliveryItemRow {
  id: string;
  cajas_plasticas: number;
  egg_type_id: string;
  egg_type_name: string | null;
  egg_type_color: 'rojo' | 'blanco' | null;
  is_packaged: boolean;
  unit_price: number | null;
  line_total: number | null;
}

export interface MyDeliveryRow {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_tax_id: string | null;
  status: DeliveryStatus;
  payment_method: PaymentMethod | null;
  total_amount: number;
  mode: 'cp' | 'cartones';
  cajas_recogidas: number;
  cajas_devueltas: number;
  notes: string | null;
  delivered_at: string;
  items: DeliveryItemRow[];
  total_cajas_plasticas: number;
}

interface RawDelivery {
  id: string;
  customer_id: string;
  status: DeliveryStatus;
  payment_method: PaymentMethod | null;
  total_amount: number | null;
  mode: 'cp' | 'cartones' | null;
  cajas_recogidas: number | null;
  cajas_devueltas: number | null;
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
    unit_price: number | null;
    line_total: number | null;
    egg_types: { name: string; color: 'rojo' | 'blanco' | null; is_packaged: boolean } | null;
  }[];
}

const SELECT = `
  id, customer_id, status, payment_method, total_amount, mode, cajas_recogidas, cajas_devueltas, notes, delivered_at,
  customers!customer_id(customer_type, first_name, last_name, business_name, tax_id),
  delivery_items(id, cajas_plasticas, egg_type_id, unit_price, line_total, egg_types(name, color, is_packaged))
`;

function customerName(c: RawDelivery['customers']): string {
  if (!c) return 'Cliente eliminado';
  if (c.customer_type === 'empresa') return c.business_name ?? 'Sin nombre';
  return `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Sin nombre';
}

function mapRow(d: RawDelivery): MyDeliveryRow {
  const items: DeliveryItemRow[] = (d.delivery_items ?? []).map((it) => ({
    id: it.id,
    cajas_plasticas: it.cajas_plasticas,
    egg_type_id: it.egg_type_id,
    egg_type_name: it.egg_types?.name ?? null,
    egg_type_color: it.egg_types?.color ?? null,
    is_packaged: it.egg_types?.is_packaged ?? false,
    unit_price: it.unit_price ?? null,
    line_total: it.line_total ?? null,
  }));
  return {
    id: d.id,
    customer_id: d.customer_id,
    customer_name: customerName(d.customers),
    customer_tax_id: d.customers?.tax_id ?? null,
    status: d.status,
    payment_method: d.payment_method ?? null,
    total_amount: d.total_amount ?? 0,
    mode: d.mode ?? 'cp',
    cajas_recogidas: d.cajas_recogidas ?? 0,
    cajas_devueltas: d.cajas_devueltas ?? 0,
    notes: d.notes,
    delivered_at: d.delivered_at,
    items,
    total_cajas_plasticas: items.reduce((s, it) => s + it.cajas_plasticas, 0),
  };
}

export const HISTORY_DAYS = 90;

/** Entregas propias del chofer de los últimos HISTORY_DAYS días (para stock). */
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
        .select(SELECT)
        .eq('driver_id', driverId!)
        .gte('delivered_at', since)
        .order('delivered_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as RawDelivery[]).map(mapRow);
    },
  });
}

/**
 * Entregas propias del chofer en un rango (para "Mis entregas"). Sin tope de
 * 90 días: trae todo el historial del rango pedido (hasta 3000 registros).
 * `since`/`until` son timestamps (ms) o null para no acotar ese extremo.
 */
export function useMyDeliveriesRange(driverId: string | undefined, since: number | null, until: number | null) {
  return useQuery({
    queryKey: ['my-deliveries-range', driverId, since, until],
    enabled: !!driverId,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    refetchOnReconnect: 'always',
    queryFn: async (): Promise<MyDeliveryRow[]> => {
      let q = supabase
        .from('deliveries')
        .select(SELECT)
        .eq('driver_id', driverId!)
        .order('delivered_at', { ascending: false })
        .limit(3000);
      if (since != null) q = q.gte('delivered_at', new Date(since).toISOString());
      if (until != null) q = q.lte('delivered_at', new Date(until).toISOString());
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as RawDelivery[]).map(mapRow);
    },
  });
}
