import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface PriceOption {
  price: number;   // precio unitario (por cajón en suelto, por envase en envasado)
  count: number;   // cuántas veces se cobró ese precio
  lastAt: string;  // última vez que se cobró
}

export interface PriceHint {
  suggested: number;        // el precio más cobrado (moda; desempata el más reciente)
  options: PriceOption[];   // todos los precios distintos, de más usado a menos
}

interface RawItem {
  unit_price: number | null;
  egg_type_id: string;
  deliveries: { delivered_at: string } | null;
}

/**
 * Historial de precios cobrados a un cliente, por tipo de huevo. Sirve para
 * sugerir el precio al registrar una entrega y para mostrar al chofer qué
 * precios ya se le cobraron (sin ir a "Mis entregas").
 * Devuelve un mapa egg_type_id -> PriceHint.
 */
export function useCustomerPriceHistory(customerId?: string) {
  return useQuery({
    queryKey: ['customer-price-history', customerId],
    enabled: !!customerId,
    staleTime: 1000 * 60,
    gcTime: 1000 * 60 * 60 * 24 * 3,
    networkMode: 'offlineFirst',
    queryFn: async (): Promise<Record<string, PriceHint>> => {
      const { data, error } = await supabase
        .from('delivery_items')
        .select('unit_price, egg_type_id, deliveries!inner(customer_id, status, delivered_at)')
        .eq('deliveries.customer_id', customerId!)
        .eq('deliveries.status', 'entregado')
        .not('unit_price', 'is', null)
        .limit(1000);
      if (error) throw error;

      // egg_type_id -> (precio -> { count, lastAt })
      const byType = new Map<string, Map<number, { count: number; lastAt: string }>>();
      for (const r of (data ?? []) as unknown as RawItem[]) {
        if (r.unit_price == null) continue;
        const price = Number(r.unit_price);
        const at = r.deliveries?.delivered_at ?? '';
        let prices = byType.get(r.egg_type_id);
        if (!prices) { prices = new Map(); byType.set(r.egg_type_id, prices); }
        const prev = prices.get(price);
        if (!prev) prices.set(price, { count: 1, lastAt: at });
        else { prev.count += 1; if (at > prev.lastAt) prev.lastAt = at; }
      }

      const out: Record<string, PriceHint> = {};
      for (const [typeId, prices] of byType) {
        const options: PriceOption[] = [...prices.entries()]
          .map(([price, v]) => ({ price, count: v.count, lastAt: v.lastAt }))
          .sort((a, b) => (b.count - a.count) || (b.lastAt < a.lastAt ? -1 : 1));
        if (options.length > 0) out[typeId] = { suggested: options[0].price, options };
      }
      return out;
    },
  });
}
