import { useState } from 'react';
import { toast } from 'sonner';
import { useCreateCustomer, useUpdateCustomer, useCustomers } from '../../../hooks/useCustomers';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import LocationPicker from '../../../components/map/LocationPicker';
import { normalizeUruguayPhone } from '../../../utils/phone';
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
  const { data: allCustomers } = useCustomers();

  const [form, setForm] = useState({
    customer_type: customer?.customer_type ?? 'empresa',
    first_name: customer?.first_name ?? '',
    last_name: customer?.last_name ?? '',
    business_name: customer?.business_name ?? '',
    tax_id: customer?.tax_id ?? '',
    business_type: customer?.business_type ?? '',
    contact_name: customer?.contact_name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    lat: customer?.lat ?? null as number | null,
    lng: customer?.lng ?? null as number | null,
    notes: customer?.notes ?? '',
  });

  const [error, setError] = useState<string | null>(null);
  // Aviso (no bloqueante) de teléfono repetido: nombres de los clientes que ya lo usan
  const [phoneDupNames, setPhoneDupNames] = useState<string | null>(null);

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
    if (validationError) {
      toast.error(validationError);
      setError(validationError);
      return;
    }

    const others = (allCustomers ?? []).filter((c) => c.id !== customer?.id);

    // RUT único (bloqueante): solo aplica a empresa con tax_id
    const rut = form.tax_id.trim();
    if (rut) {
      const dupRut = others.find((c) => (c.tax_id ?? '').trim() === rut);
      if (dupRut) {
        const msg = `Ya existe un cliente con el RUT ${rut}: ${
          dupRut.business_name ?? dupRut.first_name ?? 'cliente'
        }`;
        toast.error(msg);
        setError(msg);
        return;
      }
    }

    // Teléfono repetido (aviso, NO bloqueante): puede ser el mismo dueño
    // con varias empresas/locales. Abrimos un modal de confirmación.
    const normalizedPhone = normalizeUruguayPhone(form.phone);
    const dupPhone = others.filter(
      (c) => normalizeUruguayPhone(c.phone) === normalizedPhone,
    );
    if (dupPhone.length > 0) {
      const names = dupPhone
        .map((c) => c.business_name ?? `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim())
        .filter(Boolean)
        .join(', ');
      setPhoneDupNames(names);
      return;
    }

    await doSave();
  }

  async function doSave() {
    const rut = form.tax_id.trim();
    try {
      const payload = {
        customer_type: form.customer_type as 'empresa' | 'persona_fisica',
        first_name: form.customer_type === 'persona_fisica' ? form.first_name || null : null,
        last_name: form.customer_type === 'persona_fisica' ? form.last_name || null : null,
        business_name: form.customer_type === 'empresa' ? form.business_name || null : null,
        tax_id: rut || null,
        business_type: form.customer_type === 'empresa' ? form.business_type || null : null,
        contact_name: form.contact_name || null,
        phone: normalizeUruguayPhone(form.phone),
        email: form.email || null,
        address: form.address,
        lat: form.lat!,
        lng: form.lng!,
        notes: form.notes || null,
      };

      if (isEditing) {
        await updateCustomer.mutateAsync({ id: customer.id, data: payload });
        toast.success('Cliente actualizado correctamente');
      } else {
        await createCustomer.mutateAsync({ ...payload, created_by: userId });
        toast.success('Cliente creado correctamente');
      }

      onSuccess();
    } catch (err) {
      // Violación de índice único de RUT en la BD (por si dos admin crean a la vez)
      const raw = err instanceof Error ? err.message : String(err);
      const friendly = /uq_customers_tax_id|duplicate key|23505/i.test(raw)
        ? `Ya existe un cliente con el RUT ${rut}`
        : raw || 'Error al guardar el cliente';
      toast.error(friendly);
      setError(friendly);
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
          <Input
            label="Objeto Social"
            value={form.business_type}
            onChange={(e) => set('business_type', e.target.value)}
            placeholder="Distribución de alimentos"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="RUT"
              value={form.tax_id}
              onChange={(e) => set('tax_id', e.target.value)}
              placeholder="21XXXXXXX"
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
          placeholder="09X XXX XXX o +598 9X XXX XXX"
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

      {/* Aviso de teléfono repetido (no bloqueante) */}
      <Modal
        isOpen={phoneDupNames !== null}
        onClose={() => setPhoneDupNames(null)}
        title="Teléfono repetido"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <p>
                Este teléfono ya lo usa: <span className="font-semibold text-gray-900 dark:text-gray-100">{phoneDupNames}</span>.
              </p>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Puede ser el mismo dueño con otra empresa o local. ¿Querés crear el cliente de todas formas?
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => setPhoneDupNames(null)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => { setPhoneDupNames(null); void doSave(); }}
              isLoading={isLoading}
            >
              Crear de todas formas
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  );
}
