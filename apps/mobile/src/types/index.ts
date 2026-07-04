export interface Customer {
  id: string;
  customer_type: 'empresa' | 'persona_fisica';
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  contact_name: string | null;
  tax_id: string | null;
  phone: string;
  email: string | null;
  address: string;
  lat: number;
  lng: number;
  notes: string | null;
  is_active: boolean;
}

export interface CustomerEggPreference {
  id: string;
  customer_id: string;
  egg_type_id: string;
  is_primary: boolean;
}

export interface EggType {
  id: string;
  name: string;
  color: 'rojo' | 'blanco' | null;
  sort_order: number;
  is_active: boolean;
}

export type DeliveryStatus =
  | 'entregado'
  | 'cliente_ausente'
  | 'rechazado'
  | 'sin_stock';

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  egg_type_id: string;
  cajas_plasticas: number;
}

export interface Delivery {
  id: string;
  customer_id: string;
  driver_id: string;
  status: DeliveryStatus;
  notes: string | null;
  delivered_at: string;
}

// 1 cajón = 2 cajas plásticas. La cantidad se guarda en cajas plásticas.
export function cajasPlasticasToCajones(cajasPlasticas: number): number {
  return cajasPlasticas / 2;
}

// "2", "2.5", etc. — sin decimales innecesarios
export function formatCajones(cajasPlasticas: number): string {
  const cajones = cajasPlasticasToCajones(cajasPlasticas);
  return Number.isInteger(cajones) ? String(cajones) : cajones.toFixed(1);
}

export interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'chofer';
  is_active: boolean;
  must_change_password: boolean;
}

export function getDisplayName(c: Customer): string {
  return c.customer_type === 'empresa'
    ? (c.business_name ?? 'Sin nombre')
    : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Sin nombre';
}
