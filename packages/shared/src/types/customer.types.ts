export type CustomerType = 'persona_fisica' | 'empresa';

export interface Customer {
  id: string;
  customer_type: CustomerType;
  // Número que asigna administración (único entre clientes)
  customer_number: number | null;
  // Persona física
  first_name: string | null;
  last_name: string | null;
  // Empresa
  business_name: string | null;
  tax_id: string | null;
  business_type: string | null;
  contact_name: string | null;
  // Común
  phone: string;
  email: string | null;
  address: string;
  lat: number;
  lng: number;
  notes: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerDto {
  customer_type: CustomerType;
  customer_number?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
  tax_id?: string | null;
  business_type?: string | null;
  contact_name?: string | null;
  phone: string;
  email?: string | null;
  address: string;
  lat: number;
  lng: number;
  notes?: string | null;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {
  is_active?: boolean;
}

// Lo que el chofer recibe (sin datos sensibles de otros clientes)
export interface CustomerMapPin {
  id: string;
  display_name: string;
  customer_type: CustomerType;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  contact_name: string | null;
}
