import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { REGISTER_PAYMENT_KEY, registerCustomerPayment, type RegisterPaymentInput } from '../lib/customerPayments';

export interface DebtRow {
  customer_id: string;
  saldo: number;
  entregas_credito_sin_cobrar: number;
  ultima_entrega_credito: string | null;
  ultimo_pago: string | null;
}

/** Deudas de todos los clientes accesibles (RLS). Para la pantalla de deudas. */
export function useMyDebts() {
  return useQuery({
    queryKey: ['debt-balances'],
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    refetchOnReconnect: 'always',
    queryFn: async (): Promise<DebtRow[]> => {
      const { data, error } = await supabase
        .from('customer_debt_balance')
        .select('customer_id, saldo, entregas_credito_sin_cobrar, ultima_entrega_credito, ultimo_pago');
      if (error) throw error;
      return (data ?? []) as DebtRow[];
    },
  });
}

/** Deuda de un cliente concreto (para el flujo de entrega). */
export function useCustomerDebt(customerId?: string) {
  return useQuery({
    queryKey: ['customer-debt', customerId],
    enabled: !!customerId,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<DebtRow | null> => {
      const { data, error } = await supabase
        .from('customer_debt_balance')
        .select('customer_id, saldo, entregas_credito_sin_cobrar, ultima_entrega_credito, ultimo_pago')
        .eq('customer_id', customerId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as DebtRow | null;
    },
  });
}

export function useRegisterCustomerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: REGISTER_PAYMENT_KEY,
    mutationFn: registerCustomerPayment,
    onSettled: (_d, _e, vars: RegisterPaymentInput) => {
      qc.invalidateQueries({ queryKey: ['debt-balances'] });
      qc.invalidateQueries({ queryKey: ['customer-debt', vars.customer_id] });
    },
  });
}
