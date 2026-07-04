import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface EggType {
  id: string;
  name: string;
  color: 'rojo' | 'blanco' | null;
  sort_order: number;
  is_active: boolean;
}

export interface EggTypeInput {
  name: string;
  color: 'rojo' | 'blanco' | null;
  sort_order: number;
  is_active: boolean;
}

const KEY = ['egg-types'];

export function useEggTypes() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<EggType[]> => {
      const { data, error } = await supabase
        .from('egg_types')
        .select('id, name, color, sort_order, is_active')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EggType[];
    },
  });
}

function friendlyError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  if (/duplicate key|egg_types_name_key|23505/i.test(raw)) {
    return new Error('Ya existe una categoría con ese nombre');
  }
  if (/foreign key|23503/i.test(raw)) {
    return new Error(
      'No se puede eliminar: la categoría tiene entregas o preferencias asociadas. Desactivala en su lugar.',
    );
  }
  return err instanceof Error ? err : new Error(raw);
}

export function useCreateEggType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EggTypeInput) => {
      const { error } = await supabase.from('egg_types').insert(input);
      if (error) throw friendlyError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateEggType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<EggTypeInput> }) => {
      const { error } = await supabase.from('egg_types').update(input).eq('id', id);
      if (error) throw friendlyError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteEggType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('egg_types').delete().eq('id', id);
      if (error) throw friendlyError(error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
