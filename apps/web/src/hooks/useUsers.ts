import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'admin' | 'chofer';
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  email?: string;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Profile> }) => {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      role: 'admin' | 'chofer';
    }) => {
      // Crear usuario en Supabase Auth vía función edge o API admin
      // Por ahora usamos el signup normal y luego actualizamos el profile
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: { full_name: payload.full_name },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo crear el usuario');

      // Actualizar el profile con el rol correcto
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: payload.full_name,
          phone: payload.phone ?? null,
          role: payload.role,
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
