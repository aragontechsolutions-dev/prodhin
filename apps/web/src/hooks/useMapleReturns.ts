import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type MapleStatus = 'pendiente' | 'aprobada' | 'rechazada';

export interface MapleReturn {
  id: string;
  driver_id: string;
  declared_qty: number;
  status: MapleStatus;
  approved_qty: number | null;
  driver_note: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  driver?: { full_name: string | null } | null;
}

export function useMapleReturns(status?: MapleStatus) {
  return useQuery({
    queryKey: ['maple-returns', status ?? 'all'],
    queryFn: async (): Promise<MapleReturn[]> => {
      const base = supabase.from('maple_returns').select('*, driver:driver_id(full_name)');
      const filtered = status ? base.eq('status', status) : base;
      const { data, error } = await filtered.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as MapleReturn[];
    },
  });
}

interface ReviewInput {
  id: string;
  status: 'aprobada' | 'rechazada';
  approved_qty: number | null;
  review_note: string | null;
  reviewer_id: string;
}

export function useReviewMapleReturn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, approved_qty, review_note, reviewer_id }: ReviewInput) => {
      const { error } = await supabase
        .from('maple_returns')
        .update({
          status,
          approved_qty,
          review_note,
          reviewed_by: reviewer_id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maple-returns'] }),
  });
}
