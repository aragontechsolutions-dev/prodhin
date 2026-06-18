export interface Customer {
  id: string;
  customer_type: 'empresa' | 'persona_fisica';
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  contact_name: string | null;
  phone: string;
  email: string | null;
  address: string;
  lat: number;
  lng: number;
  notes: string | null;
  is_active: boolean;
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
