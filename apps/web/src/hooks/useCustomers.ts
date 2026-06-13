import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from '@prodhin/shared';

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async (): Promise<Customer[]> => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateCustomerDto & { created_by: string }) => {
      const { error } = await supabase.from('customers').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCustomerDto }) => {
      const { error } = await supabase
        .from('customers')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useDriverCustomers() {
  return useQuery({
    queryKey: ['driver-customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_customers')
        .select(`
          id,
          driver_id,
          customer_id,
          assigned_at,
          profiles!driver_id(full_name, role),
          customers!customer_id(id, customer_type, first_name, last_name, business_name)
        `);

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAssignCustomer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      driver_id,
      customer_id,
      assigned_by,
    }: {
      driver_id: string;
      customer_id: string;
      assigned_by: string;
    }) => {
      const { error } = await supabase
        .from('driver_customers')
        .upsert({ driver_id, customer_id, assigned_by });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-customers'] }),
  });
}

export function useUnassignCustomer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ driver_id, customer_id }: { driver_id: string; customer_id: string }) => {
      const { error } = await supabase
        .from('driver_customers')
        .delete()
        .eq('driver_id', driver_id)
        .eq('customer_id', customer_id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['driver-customers'] }),
  });
}
