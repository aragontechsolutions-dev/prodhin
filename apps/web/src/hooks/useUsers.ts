import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'admin' | 'chofer';
  is_active: boolean;
  must_change_password: boolean;
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
      must_change_password?: boolean;
    }) => {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: { full_name: payload.full_name },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No se pudo crear el usuario');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: payload.full_name,
          phone: payload.phone ?? null,
          role: payload.role,
          must_change_password: payload.must_change_password ?? false,
        })
        .eq('id', authData.user.id);

      if (profileError) throw profileError;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
