import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CREATE_DELIVERY_KEY,
  createDelivery,
  type CreateDeliveryInput,
} from '../lib/deliveries';

/**
 * Registra una entrega. Funciona offline: si no hay red la mutación queda
 * pausada y persistida, y se reenvía sola al reconectar (ver App.tsx).
 */
export function useCreateDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: CREATE_DELIVERY_KEY,
    mutationFn: createDelivery,
    onSuccess: (_data, variables: CreateDeliveryInput) => {
      qc.invalidateQueries({ queryKey: ['deliveries', variables.customer_id] });
      // Refrescar el historial del chofer (Mis entregas, Carga del día, mapa)
      qc.invalidateQueries({ queryKey: ['my-deliveries'] });
      // Refrescar saldos de cajas en locales (afectados por la entrega)
      qc.invalidateQueries({ queryKey: ['box-balances-all'] });
      qc.invalidateQueries({ queryKey: ['box-balance'] });
    },
  });
}
