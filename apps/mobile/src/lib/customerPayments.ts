import { supabase } from './supabase';

export const REGISTER_PAYMENT_KEY = ['register-customer-payment'] as const;

export interface RegisterPaymentInput {
  id: string;            // uuid generado en el cliente (idempotencia offline)
  customer_id: string;
  driver_id: string;
  amount: number;
  note?: string | null;
}

/** Registra un cobro que baja la deuda del cliente. Idempotente por id. */
export async function registerCustomerPayment(input: RegisterPaymentInput): Promise<void> {
  const { error } = await supabase.from('customer_payments').upsert(
    {
      id: input.id,
      customer_id: input.customer_id,
      driver_id: input.driver_id,
      amount: input.amount,
      note: input.note ?? null,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw error;
}
