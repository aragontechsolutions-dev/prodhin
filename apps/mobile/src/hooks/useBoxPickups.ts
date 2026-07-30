import { useMutation, useQueryClient } from '@tanstack/react-query';
import { REGISTER_PICKUP_KEY, registerBoxPickup, type RegisterPickupInput } from '../lib/boxPickups';

export function useRegisterBoxPickup() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: REGISTER_PICKUP_KEY,
    mutationFn: registerBoxPickup,
    // Optimista: baja el saldo de cajas del local al instante (funciona offline).
    onMutate: async (vars: RegisterPickupInput) => {
      const key = ['box-balances-all'];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Record<string, number>>(key);
      if (prev) {
        const next = { ...prev, [vars.customer_id]: (prev[vars.customer_id] ?? 0) - vars.qty };
        qc.setQueryData(key, next);
      }
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['box-balances-all'], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['box-balances-all'] }),
  });
}
