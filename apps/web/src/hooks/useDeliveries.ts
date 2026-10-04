import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { lineTotal } from '../lib/pricing';

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

export type PaymentMethod = 'efectivo' | 'credito';

export interface DeliveryItemRow {
  id: string;
  cajas_plasticas: number;
  egg_type_id: string;
  egg_type_name: string | null;
  egg_type_color: 'rojo' | 'blanco' | null;
  is_packaged: boolean;
  packages_per_box: number | null;
  unit_price: number | null;
  line_total: number | null;
}

export interface DeliveryRow {
  id: string;
  customer_id: string;
  customer_name: string;
  driver_id: string;
  driver_name: string;
  status: DeliveryStatus;
  mode: 'cp' | 'cartones';
  cajas_recogidas: number;
  cajas_devueltas: number;
  payment_method: PaymentMethod | null;
  total_amount: number;
  notes: string | null;
  delivered_at: string;
  items: DeliveryItemRow[];
  total_cajas_plasticas: number;
}

// 1 cajón = 2 cajas plásticas (suelto). Compat: usar cajonesFor para envasados.
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
  mode: 'cp' | 'cartones';
  cajas_recogidas: number;
  cajas_devueltas: number;
  payment_method: PaymentMethod | null;
  total_amount: number | null;
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
    unit_price: number | null;
    line_total: number | null;
    egg_types: { name: string; color: 'rojo' | 'blanco' | null; is_packaged: boolean; packages_per_box: number | null } | null;
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
          id, customer_id, driver_id, status, mode, cajas_recogidas, cajas_devueltas, payment_method, total_amount, notes, delivered_at,
          customers!customer_id(customer_type, first_name, last_name, business_name),
          profiles!driver_id(full_name),
          delivery_items(id, cajas_plasticas, egg_type_id, unit_price, line_total, egg_types(name, color, is_packaged, packages_per_box))
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
          is_packaged: it.egg_types?.is_packaged ?? false,
          packages_per_box: it.egg_types?.packages_per_box ?? null,
          unit_price: it.unit_price ?? null,
          line_total: it.line_total ?? null,
        }));
        return {
          id: d.id,
          customer_id: d.customer_id,
          customer_name: rawCustomerName(d.customers),
          driver_id: d.driver_id,
          driver_name: d.profiles?.full_name ?? 'Chofer',
          status: d.status,
          mode: d.mode ?? 'cp',
          cajas_recogidas: d.cajas_recogidas ?? 0,
          cajas_devueltas: d.cajas_devueltas ?? 0,
          payment_method: d.payment_method ?? null,
          total_amount: d.total_amount ?? 0,
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

export interface UpdateDeliveryItemInput {
  egg_type_id: string;
  cajas_plasticas: number;
  unit_price: number | null;
  is_packaged: boolean;
  packages_per_box: number | null;
}

export interface UpdateDeliveryInput {
  id: string;
  status: DeliveryStatus;
  mode: 'cp' | 'cartones';
  cajas_recogidas: number;
  cajas_devueltas: number;
  payment_method: PaymentMethod | null;
  reason: string;
  items: UpdateDeliveryItemInput[];
}

/** Corrige una entrega (cabecera + líneas). Requiere un motivo, que queda en
 *  la auditoría (edit_reason). Recalcula precios de línea y monto total. */
export function useUpdateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateDeliveryInput) => {
      const priced = input.items
        .filter((it) => it.egg_type_id && it.cajas_plasticas >= 0)
        .map((it) => {
          const lt = it.unit_price && it.unit_price > 0
            ? lineTotal(it.cajas_plasticas, it.unit_price, it.is_packaged, it.packages_per_box)
            : null;
          return {
            delivery_id: input.id,
            egg_type_id: it.egg_type_id,
            cajas_plasticas: it.cajas_plasticas,
            unit_price: it.unit_price ?? null,
            line_total: lt,
          };
        });
      const total = priced.reduce((s, r) => s + (r.line_total ?? 0), 0);

      const { error: dErr } = await supabase
        .from('deliveries')
        .update({
          status: input.status,
          mode: input.mode,
          cajas_recogidas: input.cajas_recogidas,
          cajas_devueltas: input.cajas_devueltas,
          payment_method: input.payment_method,
          total_amount: total,
          edit_reason: input.reason,
        })
        .eq('id', input.id);
      if (dErr) throw dErr;

      const { error: delErr } = await supabase.from('delivery_items').delete().eq('delivery_id', input.id);
      if (delErr) throw delErr;

      if (priced.length > 0) {
        const { error: iErr } = await supabase.from('delivery_items').insert(priced);
        if (iErr) throw iErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      qc.invalidateQueries({ queryKey: ['debt-balances'] });
    },
  });
}
