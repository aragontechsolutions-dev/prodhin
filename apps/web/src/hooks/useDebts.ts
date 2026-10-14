import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface DebtRow {
  customer_id: string;
  deuda_bruta: number;
  pagos: number;
  saldo: number;
  ultima_entrega_credito: string | null;
  ultimo_pago: string | null;
  entregas_credito_sin_cobrar: number;
}

/** Saldo de deuda por cliente (vista customer_debt_balance). */
export function useDebtBalances() {
  return useQuery({
    queryKey: ['debt-balances'],
    queryFn: async (): Promise<DebtRow[]> => {
      const { data, error } = await supabase
        .from('customer_debt_balance')
        .select('customer_id, deuda_bruta, pagos, saldo, ultima_entrega_credito, ultimo_pago, entregas_credito_sin_cobrar');
      if (error) throw error;
      return (data ?? []) as DebtRow[];
    },
  });
}

export type PaymentMethod = 'efectivo' | 'cheque' | 'transferencia';

export interface PaymentRow {
  id: string;
  customer_id: string;
  driver_id: string | null;
  amount: number;
  method: PaymentMethod;
  proof_path: string | null;
  note: string | null;
  received_at: string;
  driver?: { full_name: string | null } | null;
}

export function useCustomerPayments(customerId?: string) {
  return useQuery({
    queryKey: ['customer-payments', customerId],
    enabled: !!customerId,
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data, error } = await supabase
        .from('customer_payments')
        .select('id, customer_id, driver_id, amount, method, proof_path, note, received_at, driver:driver_id(full_name)')
        .eq('customer_id', customerId!)
        .order('received_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PaymentRow[];
    },
  });
}

/** Sube un comprobante (imagen o PDF) al bucket privado y devuelve la ruta. */
export async function uploadPaymentProof(file: File, customerId: string): Promise<string> {
  const ext = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf' ? 'pdf' : 'jpg';
  const path = `${customerId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('comprobantes').upload(path, file, {
    contentType: file.type || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function paymentProofSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export interface RegisterPaymentInput {
  customer_id: string;
  amount: number;
  method: PaymentMethod;
  proof_path?: string | null;
  note?: string | null;
  driver_id?: string | null;
}

export function useRegisterPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: RegisterPaymentInput) => {
      const { error } = await supabase.from('customer_payments').insert({
        customer_id: i.customer_id,
        amount: i.amount,
        method: i.method,
        proof_path: i.proof_path ?? null,
        note: i.note ?? null,
        driver_id: i.driver_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['debt-balances'] });
      qc.invalidateQueries({ queryKey: ['customer-payments'] });
    },
  });
}
