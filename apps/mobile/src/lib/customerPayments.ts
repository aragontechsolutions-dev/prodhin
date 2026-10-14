import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

export const REGISTER_PAYMENT_KEY = ['register-customer-payment'] as const;

export type PaymentMethod = 'efectivo' | 'cheque' | 'transferencia';

export interface RegisterPaymentInput {
  id: string;            // uuid generado en el cliente (idempotencia offline)
  customer_id: string;
  driver_id: string;
  amount: number;
  method: PaymentMethod;
  note?: string | null;
  proof_path?: string | null;   // ruta en el bucket "comprobantes"
}

// ── Base64 → Uint8Array (sin dependencias extra) ─────────────
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) |
      (B64.indexOf(clean[i + 2]) << 6) | B64.indexOf(clean[i + 3]);
    out[p++] = (n >> 16) & 0xff;
    if (clean[i + 2] !== undefined) out[p++] = (n >> 8) & 0xff;
    if (clean[i + 3] !== undefined) out[p++] = n & 0xff;
  }
  return out;
}

/**
 * Sube un comprobante (foto de cheque o PDF de transferencia) al bucket privado
 * "comprobantes" y devuelve la ruta. Requiere conexión.
 */
export async function uploadPaymentProof(
  uri: string, customerId: string, isPdf: boolean,
): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const bytes = base64ToBytes(base64);
  const ext = isPdf ? 'pdf' : 'jpg';
  const contentType = isPdf ? 'application/pdf' : 'image/jpeg';
  const path = `${customerId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('comprobantes').upload(path, bytes, {
    contentType, upsert: true,
  });
  if (error) throw error;
  return path;
}

/** URL firmada para ver un comprobante (bucket privado). */
export async function paymentProofSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Registra un cobro que baja la deuda del cliente. Idempotente por id. */
export async function registerCustomerPayment(input: RegisterPaymentInput): Promise<void> {
  const { error } = await supabase.from('customer_payments').upsert(
    {
      id: input.id,
      customer_id: input.customer_id,
      driver_id: input.driver_id,
      amount: input.amount,
      method: input.method,
      note: input.note ?? null,
      proof_path: input.proof_path ?? null,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw error;
}
