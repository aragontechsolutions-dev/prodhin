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

export function useResetPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.patch(`/users/${id}/password`, { password }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useForcePasswordChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, must_change_password }: { id: string; must_change_password: boolean }) =>
      api.patch(`/users/${id}`, { must_change_password }),
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

export function useDriverDelegations() {
  return useQuery({
    queryKey: ['driver-delegations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_delegations')
        .select(`
          id,
          from_driver_id,
          to_driver_id,
          start_date,
          end_date,
          is_active,
          created_at,
          from_driver:profiles!from_driver_id(full_name),
          to_driver:profiles!to_driver_id(full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      from_driver_id: string;
      to_driver_id: string;
      start_date: string;
      end_date: string;
      created_by: string;
    }) => {
      const { error } = await supabase.from('driver_delegations').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-delegations'] }),
  });
}

export function useEndDelegation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('driver_delegations')
        .update({ is_active: false, end_date: new Date().toISOString().split('T')[0] })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-delegations'] }),
  });
}
