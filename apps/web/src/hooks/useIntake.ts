import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Crea un token de autoservicio (link de un solo uso) para que el cliente
// complete/corrija sus datos. Devuelve el token generado.
export function useCreateIntakeToken() {
  return useMutation({
    mutationFn: async ({ customerId, days }: { customerId: string; days: number }): Promise<string> => {
      const expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('customer_intake_tokens')
        .insert({ customer_id: customerId, expires_at })
        .select('token')
        .single();
      if (error) throw error;
      return (data as { token: string }).token;
    },
  });
}
