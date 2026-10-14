import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type EggReturnStatus = 'pendiente' | 'aprobada' | 'rechazada';

export interface EggReturnItem {
  id: string;
  egg_type_id: string;
  qty: number;
  expiry_date: string;
  returned_qty: number | null;
  returned_expiry_date: string | null;
}

export interface EggReturn {
  id: string;
  driver_id: string;
  broken_qty: number;
  broken_returned: number | null;
  status: EggReturnStatus;
  driver_note: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  driver?: { full_name: string | null } | null;
  items: EggReturnItem[];
}

export function useEggReturns(status?: EggReturnStatus) {
  return useQuery({
    queryKey: ['egg-returns-admin', status ?? 'all'],
    queryFn: async (): Promise<EggReturn[]> => {
      const base = supabase
        .from('egg_returns')
        .select('*, driver:driver_id(full_name), items:egg_return_items(*)');
      const filtered = status ? base.eq('status', status) : base;
      const { data, error } = await filtered.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EggReturn[];
    },
  });
}

export interface ReviewEggReturnInput {
  id: string;
  status: 'aprobada' | 'rechazada';
  broken_returned: number | null;
  review_note: string | null;
  reviewer_id: string;
  items: { id: string; returned_qty: number | null; returned_expiry_date: string | null }[];
}

export function useReviewEggReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReviewEggReturnInput) => {
      const { error } = await supabase
        .from('egg_returns')
        .update({
          status: input.status,
          broken_returned: input.broken_returned,
          review_note: input.review_note,
          reviewed_by: input.reviewer_id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', input.id);
      if (error) throw error;

      for (const it of input.items) {
        const { error: e2 } = await supabase
          .from('egg_return_items')
          .update({ returned_qty: it.returned_qty, returned_expiry_date: it.returned_expiry_date })
          .eq('id', it.id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['egg-returns-admin'] }),
  });
}
