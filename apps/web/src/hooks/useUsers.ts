import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';

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
    mutationFn: (payload: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      role: 'admin' | 'chofer';
      email_confirmed?: boolean;
      must_change_password?: boolean;
    }) => api.post('/users', payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
