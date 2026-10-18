import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type DiscStatus = 'pendiente' | 'resuelto' | 'descartado';

export interface DiscItem {
  egg_type_id: string;
  egg_type_name: string | null;
  system_qty: number;
  counted_qty: number;
}

export interface Discrepancy {
  id: string;
  driver_id: string;
  driver_name: string;
  note: string | null;
  status: DiscStatus;
  resolution_reason: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
  items: DiscItem[];
}

export function useStockDiscrepancies(status?: DiscStatus) {
  return useQuery({
    queryKey: ['stock-discrepancies', status ?? 'all'],
    queryFn: async (): Promise<Discrepancy[]> => {
      const base = supabase
        .from('stock_discrepancies')
        .select('id, driver_id, note, status, resolution_reason, resolution_note, resolved_at, created_at, driver:driver_id(full_name), items:stock_discrepancy_items(egg_type_id, system_qty, counted_qty, egg_types(name))');
      const q = status ? base.eq('status', status) : base;
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as Array<{
        id: string; driver_id: string; note: string | null; status: DiscStatus;
        resolution_reason: string | null; resolution_note: string | null; resolved_at: string | null; created_at: string;
        driver: { full_name: string | null } | null;
        items: { egg_type_id: string; system_qty: number; counted_qty: number; egg_types: { name: string } | null }[];
      }>).map((d) => ({
        id: d.id,
        driver_id: d.driver_id,
        driver_name: d.driver?.full_name ?? 'Chofer',
        note: d.note,
        status: d.status,
        resolution_reason: d.resolution_reason,
        resolution_note: d.resolution_note,
        resolved_at: d.resolved_at,
        created_at: d.created_at,
        items: (d.items ?? []).map((it) => ({
          egg_type_id: it.egg_type_id,
          egg_type_name: it.egg_types?.name ?? null,
          system_qty: it.system_qty,
          counted_qty: it.counted_qty,
        })),
      }));
    },
  });
}

export interface ResolveInput {
  id: string;
  driver_id: string;
  reason: string;                 // merma / roto / error_carga / entrega_no_registrada / otro
  note?: string | null;
  resolved_by: string;
  apply: boolean;                 // true = ajustar stock a lo contado (recuento)
  items: { egg_type_id: string; counted_qty: number }[];
}

export function useResolveDiscrepancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: ResolveInput) => {
      // Ajuste: fijar el stock del chofer a lo contado (nuevo recuento base).
      if (i.apply && i.items.length > 0) {
        const now = new Date().toISOString();
        const rows = i.items.map((it) => ({
          id: crypto.randomUUID(),
          driver_id: i.driver_id,
          egg_type_id: it.egg_type_id,
          cajas_plasticas: Math.max(0, it.counted_qty),
          counted_at: now,
        }));
        const { error: cErr } = await supabase.from('truck_counts').insert(rows);
        if (cErr) throw cErr;
      }
      const { error } = await supabase.from('stock_discrepancies').update({
        status: 'resuelto',
        resolution_reason: i.reason,
        resolution_note: i.note ?? null,
        resolved_by: i.resolved_by,
        resolved_at: new Date().toISOString(),
      }).eq('id', i.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-discrepancies'] });
      qc.invalidateQueries({ queryKey: ['truck-stock'] });
    },
  });
}

export function useDiscardDiscrepancy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resolvedBy, note }: { id: string; resolvedBy: string; note?: string | null }) => {
      const { error } = await supabase.from('stock_discrepancies').update({
        status: 'descartado', resolution_note: note ?? null, resolved_by: resolvedBy, resolved_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-discrepancies'] }),
  });
}
