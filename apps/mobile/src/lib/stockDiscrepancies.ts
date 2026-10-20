import { supabase } from './supabase';

export const REPORT_DISCREPANCY_KEY = ['report-stock-discrepancy'] as const;

export interface DiscrepancyItemInput {
  id: string;            // uuid cliente
  egg_type_id: string;
  system_qty: number;    // lo que decía el sistema
  counted_qty: number;   // lo contado físicamente
}

export interface ReportDiscrepancyInput {
  id: string;            // uuid cliente (idempotencia offline)
  driver_id: string;
  note?: string | null;
  items: DiscrepancyItemInput[];
}

/**
 * El chofer REPORTA un descuadre (no ajusta nada). Idempotente por id →
 * segura de reintentar offline.
 */
export async function reportDiscrepancy(input: ReportDiscrepancyInput): Promise<void> {
  const { error: hErr } = await supabase.from('stock_discrepancies').upsert(
    { id: input.id, driver_id: input.driver_id, note: input.note ?? null },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (hErr) throw hErr;

  const rows = input.items.map((it) => ({
    id: it.id,
    discrepancy_id: input.id,
    egg_type_id: it.egg_type_id,
    system_qty: it.system_qty,
    counted_qty: it.counted_qty,
  }));
  if (rows.length > 0) {
    const { error: iErr } = await supabase
      .from('stock_discrepancy_items')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (iErr) throw iErr;
  }
}
