import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// ── Competidores ────────────────────────────────────────────
export type CompetitorStatus = 'pendiente' | 'aprobado';

export interface Competitor {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  notes: string | null;
  status: CompetitorStatus;
  creator?: { full_name: string | null } | null;
}

export function useCompetitors() {
  return useQuery({
    queryKey: ['competitors'],
    queryFn: async (): Promise<Competitor[]> => {
      const { data, error } = await supabase
        .from('competitors')
        .select('id, name, lat, lng, radius_m, notes, status, creator:created_by(full_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Competitor[];
    },
  });
}

export function useSaveCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<Competitor> & { name: string; lat: number; lng: number; radius_m: number }) => {
      // Al guardar desde el panel de admin la zona queda aprobada.
      const payload = { name: c.name, lat: c.lat, lng: c.lng, radius_m: c.radius_m, notes: c.notes ?? null, status: 'aprobado' as const };
      const { error } = c.id
        ? await supabase.from('competitors').update(payload).eq('id', c.id)
        : await supabase.from('competitors').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitors'] }),
  });
}

export function useApproveCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('competitors').update({ status: 'aprobado' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitors'] }),
  });
}

export function useDeleteCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('competitors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['competitors'] }),
  });
}

// ── Prospectos ──────────────────────────────────────────────
export type ProspectStatus = 'nuevo' | 'contactado' | 'convertido' | 'descartado';

export interface ProspectOffer {
  id: string;
  egg_type: string | null;
  format: string | null;
  price: number | null;
  photo_path: string | null;
}

export interface Prospect {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  lat: number;
  lng: number;
  has_competition: boolean;
  status: ProspectStatus;
  notes: string | null;
  created_by: string | null;
  converted_customer_id: string | null;
  created_at: string;
  offers: ProspectOffer[];
  creator?: { full_name: string | null } | null;
}

export function useProspects(status?: ProspectStatus) {
  return useQuery({
    queryKey: ['prospects', status ?? 'all'],
    queryFn: async (): Promise<Prospect[]> => {
      const base = supabase
        .from('prospects')
        .select('*, creator:created_by(full_name), offers:prospect_offers(id, egg_type, format, price, photo_path)');
      const filtered = status ? base.eq('status', status) : base;
      const { data, error } = await filtered.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Prospect[];
    },
  });
}

export function useUpdateProspectStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProspectStatus }) => {
      const { error } = await supabase.from('prospects').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  });
}

export interface ConvertInput {
  prospectId: string;
  customer_number: number;
  customer_type: 'empresa' | 'persona_fisica';
  business_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  created_by: string;
}

export function useConvertProspect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: ConvertInput) => {
      const { data, error } = await supabase.from('customers').insert({
        customer_type: i.customer_type,
        customer_number: i.customer_number,
        business_name: i.customer_type === 'empresa' ? i.business_name ?? null : null,
        first_name: i.customer_type === 'persona_fisica' ? i.first_name ?? null : null,
        last_name: i.customer_type === 'persona_fisica' ? i.last_name ?? null : null,
        phone: i.phone,
        address: i.address,
        lat: i.lat,
        lng: i.lng,
        created_by: i.created_by,
      }).select('id').single();
      if (error) throw error;
      const customerId = (data as { id: string }).id;
      const { error: e2 } = await supabase.from('prospects')
        .update({ status: 'convertido', converted_customer_id: customerId })
        .eq('id', i.prospectId);
      if (e2) throw e2;
      return customerId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prospects'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function prospectPhotoUrl(path: string): string {
  return supabase.storage.from('prospects').getPublicUrl(path).data.publicUrl;
}
