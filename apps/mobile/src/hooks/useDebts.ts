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

// ── Detalle por cliente (entregas a crédito + cobros) ───────
export interface DebtDeliveryItem {
  cajas_plasticas: number;
  egg_type_name: string | null;
  color: 'rojo' | 'blanco' | null;
  is_packaged: boolean;
  packages_per_box: number | null;
  eggs_per_package: number | null;
  maples_per_box: number | null;
}

export interface DebtDelivery {
  id: string;
  delivered_at: string;
  total_amount: number;
  items: DebtDeliveryItem[];
}

interface RawDebtDelivery {
  id: string;
  delivered_at: string;
  total_amount: number | null;
  delivery_items: {
    cajas_plasticas: number;
    egg_types: {
      name: string; color: 'rojo' | 'blanco' | null; is_packaged: boolean;
      packages_per_box: number | null; eggs_per_package: number | null; maples_per_box: number | null;
    } | null;
  }[];
}

/** Entregas a crédito del chofer a un cliente (las que forman la deuda). */
export function useCustomerCreditDeliveries(customerId?: string) {
  return useQuery({
    queryKey: ['customer-credit-deliveries', customerId],
    enabled: !!customerId,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<DebtDelivery[]> => {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          id, delivered_at, total_amount,
          delivery_items(cajas_plasticas, egg_types(name, color, is_packaged, packages_per_box, eggs_per_package, maples_per_box))
        `)
        .eq('customer_id', customerId!)
        .eq('payment_method', 'credito')
        .eq('status', 'entregado')
        .order('delivered_at', { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as RawDebtDelivery[]).map((d) => ({
        id: d.id,
        delivered_at: d.delivered_at,
        total_amount: d.total_amount ?? 0,
        items: (d.delivery_items ?? []).map((it) => ({
          cajas_plasticas: it.cajas_plasticas,
          egg_type_name: it.egg_types?.name ?? null,
          color: it.egg_types?.color ?? null,
          is_packaged: it.egg_types?.is_packaged ?? false,
          packages_per_box: it.egg_types?.packages_per_box ?? null,
          eggs_per_package: it.egg_types?.eggs_per_package ?? null,
          maples_per_box: it.egg_types?.maples_per_box ?? null,
        })),
      }));
    },
  });
}

export interface DebtPayment {
  id: string;
  amount: number;
  note: string | null;
  received_at: string;
}

/** Cobros registrados a un cliente. */
export function useCustomerPaymentsHistory(customerId?: string) {
  return useQuery({
    queryKey: ['customer-payments-history', customerId],
    enabled: !!customerId,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<DebtPayment[]> => {
      const { data, error } = await supabase
        .from('customer_payments')
        .select('id, amount, note, received_at')
        .eq('customer_id', customerId!)
        .order('received_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DebtPayment[];
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
      qc.invalidateQueries({ queryKey: ['customer-payments-history', vars.customer_id] });
    },
  });
}
