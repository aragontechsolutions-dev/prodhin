import { useState } from 'react';
import { useCreateCustomer, useUpdateCustomer } from '../../../hooks/useCustomers';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import LocationPicker from '../../../components/map/LocationPicker';
import type { Customer } from '@prodhin/shared';

interface Props {
  customer: Customer | null;
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const typeOptions = [
  { value: 'empresa', label: 'Empresa / Local' },
  { value: 'persona_fisica', label: 'Persona física' },
];

export default function CustomerForm({ customer, userId, onSuccess, onCancel }: Props) {
  const isEditing = !!customer;
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const [form, setForm] = useState({
    customer_type: customer?.customer_type ?? 'empresa',
    first_name: customer?.first_name ?? '',
    last_name: customer?.last_name ?? '',
    business_name: customer?.business_name ?? '',
    tax_id: customer?.tax_id ?? '',
    contact_name: customer?.contact_name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    lat: customer?.lat ?? null as number | null,
    lng: customer?.lng ?? null as number | null,
    notes: customer?.notes ?? '',
  });

  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): string | null {
    if (!form.phone.trim()) return 'El teléfono es obligatorio';
    if (!form.address.trim()) return 'La dirección es obligatoria';
    if (form.lat === null || form.lng === null) return 'Selecciona la ubicación en el mapa';
    if (form.customer_type === 'empresa' && !form.business_name.trim())
      return 'El nombre de la empresa es obligatorio';
    if (form.customer_type === 'persona_fisica' && (!form.first_name.trim() || !form.last_name.trim()))
      return 'El nombre y apellido son obligatorios';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    try {
      const payload = {
        customer_type: form.customer_type as 'empresa' | 'persona_fisica',
        first_name: form.customer_type === 'persona_fisica' ? form.first_name || null : null,
        last_name: form.customer_type === 'persona_fisica' ? form.last_name || null : null,
        business_name: form.customer_type === 'empresa' ? form.business_name || null : null,
        tax_id: form.tax_id || null,
        contact_name: form.contact_name || null,
        phone: form.phone,
        email: form.email || null,
        address: form.address,
        lat: form.lat!,
        lng: form.lng!,
        notes: form.notes || null,
      };

      if (isEditing) {
        await updateCustomer.mutateAsync({ id: customer.id, data: payload });
      } else {
        await createCustomer.mutateAsync({ ...payload, created_by: userId });
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el cliente');
    }
  }

  const isLoading = createCustomer.isPending || updateCustomer.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tipo de cliente */}
      <Select
        label="Tipo de cliente"
        required
        value={form.customer_type}
        onChange={(e) => set('customer_type', e.target.value as 'empresa' | 'persona_fisica')}
        options={typeOptions}
      />

      {/* Campos según tipo */}
      {form.customer_type === 'empresa' ? (
        <div className="space-y-3 p-4 bg-blue-50 rounded-xl">
          <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Datos de la empresa</p>
          <Input
            label="Nombre de la empresa"
            required
            value={form.business_name}
            onChange={(e) => set('business_name', e.target.value)}
            placeholder="Distribuidora XYZ C.A."
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="RIF / NIT"
              value={form.tax_id}
              onChange={(e) => set('tax_id', e.target.value)}
              placeholder="J-00000000-0"
            />
            <Input
              label="Persona de contacto"
              value={form.contact_name}
              onChange={(e) => set('contact_name', e.target.value)}
              placeholder="María González"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-4 bg-yellow-50 rounded-xl">
          <p className="text-xs font-medium text-yellow-700 uppercase tracking-wide">Datos personales</p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nombre"
              required
              value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)}
              placeholder="Juan"
            />
            <Input
              label="Apellido"
              required
              value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)}
              placeholder="Pérez"
            />
          </div>
        </div>
      )}

      {/* Datos comunes */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Teléfono"
          type="tel"
          required
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="+58 412 000 0000"
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="cliente@email.com"
        />
      </div>

      <Input
        label="Dirección"
        required
        value={form.address}
        onChange={(e) => set('address', e.target.value)}
        placeholder="Av. Principal, Local 5, Ciudad"
      />

      {/* Coordenadas manuales */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Latitud"
          type="number"
          step="any"
          value={form.lat ?? ''}
          onChange={(e) => set('lat', e.target.value ? parseFloat(e.target.value) : null)}
          placeholder="10.4696"
          hint="O haz clic en el mapa"
        />
        <Input
          label="Longitud"
          type="number"
          step="any"
          value={form.lng ?? ''}
          onChange={(e) => set('lng', e.target.value ? parseFloat(e.target.value) : null)}
          placeholder="-66.9036"
        />
      </div>

      {/* Mapa */}
      <LocationPicker
        lat={form.lat}
        lng={form.lng}
        onChange={(lat, lng) => { set('lat', lat); set('lng', lng); }}
      />

      <Input
        label="Notas"
        value={form.notes}
        onChange={(e) => set('notes', e.target.value)}
        placeholder="Información adicional del cliente..."
      />

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading} className="flex-1">
          {isEditing ? 'Guardar cambios' : 'Crear cliente'}
        </Button>
      </div>
    </form>
  );
}
