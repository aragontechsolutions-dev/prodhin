import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import LocationPicker from '../../components/map/LocationPicker';
import { normalizeUruguayPhone } from '../../utils/phone';

type Status = 'loading' | 'ok' | 'invalid' | 'used' | 'expired' | 'done';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-primary-50 flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="text-4xl">🥚</div>
          <h1 className="text-xl font-bold text-gray-900 mt-1">Prodhin</h1>
        </div>
        {children}
      </div>
    </div>
  );
}

interface IntakeCustomer {
  id: string;
  customer_type: 'empresa' | 'persona_fisica';
  first_name: string | null;
  last_name: string | null;
  business_name: string | null;
  tax_id: string | null;
  business_type: string | null;
  contact_name: string | null;
  phone: string;
  email: string | null;
  address: string;
  lat: number;
  lng: number;
  notes: string | null;
}

export default function CustomerIntakePage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>('loading');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const [form, setForm] = useState({
    customer_type: 'empresa' as 'empresa' | 'persona_fisica',
    first_name: '',
    last_name: '',
    business_name: '',
    tax_id: '',
    business_type: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    lat: null as number | null,
    lng: null as number | null,
    notes: '',
  });

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) { setStatus('invalid'); return; }
      const { data, error: rpcError } = await supabase.rpc('intake_get', { p_token: token });
      if (!active) return;
      if (rpcError || !data) { setStatus('invalid'); return; }
      const st = (data as { status: string }).status;
      if (st !== 'ok') { setStatus(st as Status); return; }
      const c = (data as { customer: IntakeCustomer }).customer;
      setForm({
        customer_type: c.customer_type,
        first_name: c.first_name ?? '',
        last_name: c.last_name ?? '',
        business_name: c.business_name ?? '',
        tax_id: c.tax_id ?? '',
        business_type: c.business_type ?? '',
        contact_name: c.contact_name ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        address: c.address ?? '',
        lat: c.lat ?? null,
        lng: c.lng ?? null,
        notes: c.notes ?? '',
      });
      setStatus('ok');
    })();
    return () => { active = false; };
  }, [token]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError('Tu dispositivo no permite compartir ubicación.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('lat', parseFloat(pos.coords.latitude.toFixed(6)));
        set('lng', parseFloat(pos.coords.longitude.toFixed(6)));
        setLocating(false);
      },
      () => {
        setError('No pudimos obtener tu ubicación. Podés marcarla en el mapa.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function validate(): string | null {
    if (form.customer_type === 'empresa' && !form.business_name.trim())
      return 'Ingresá el nombre del local / empresa.';
    if (form.customer_type === 'persona_fisica' && (!form.first_name.trim() || !form.last_name.trim()))
      return 'Ingresá tu nombre y apellido.';
    if (!form.phone.trim()) return 'Ingresá un teléfono.';
    if (!form.address.trim()) return 'Ingresá tu dirección.';
    if (form.lat === null || form.lng === null)
      return 'Marcá tu ubicación (usá el botón "Usar mi ubicación" o tocá el mapa).';
    const rut = form.tax_id.trim();
    if (rut && !/^\d{12}$/.test(rut)) return 'El RUT debe tener 12 dígitos.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const v = validate();
    if (v) { setError(v); return; }

    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc('intake_submit', {
      p_token: token,
      p_data: {
        first_name: form.first_name,
        last_name: form.last_name,
        business_name: form.business_name,
        tax_id: form.tax_id.trim(),
        business_type: form.business_type,
        contact_name: form.contact_name,
        phone: normalizeUruguayPhone(form.phone),
        email: form.email,
        address: form.address,
        lat: form.lat,
        lng: form.lng,
        notes: form.notes,
      },
    });
    setSaving(false);

    if (rpcError) { setError('Ocurrió un error al guardar. Intentá de nuevo.'); return; }
    const res = data as { status: string; message?: string };
    if (res.status === 'ok') { setStatus('done'); return; }
    if (res.status === 'error') { setError(res.message ?? 'Revisá los datos.'); return; }
    // used / expired / invalid
    setStatus(res.status as Status);
  }

  if (status === 'loading') {
    return <Shell><div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">Cargando…</div></Shell>;
  }

  if (status === 'invalid' || status === 'used' || status === 'expired') {
    const msg =
      status === 'used' ? 'Este link ya fue usado. Pedile a Prodhin uno nuevo si necesitás corregir tus datos.'
        : status === 'expired' ? 'Este link venció. Pedile a Prodhin uno nuevo.'
          : 'Este link no es válido. Verificá que lo hayas abierto completo.';
    return (
      <Shell>
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-3">
          <div className="text-3xl">⚠️</div>
          <p className="text-sm text-gray-600">{msg}</p>
        </div>
      </Shell>
    );
  }

  if (status === 'done') {
    return (
      <Shell>
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center space-y-3">
          <div className="text-4xl">✅</div>
          <h2 className="text-lg font-bold text-gray-900">¡Datos guardados!</h2>
          <p className="text-sm text-gray-600">Gracias. Ya recibimos tu información. Podés cerrar esta página.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Completá o corregí tus datos. Marcá tu ubicación para que el repartidor te encuentre.
        </p>

        {form.customer_type === 'empresa' ? (
          <>
            <Input label="Nombre del local / empresa" required value={form.business_name}
              onChange={(e) => set('business_name', e.target.value)} placeholder="Almacén Los Amigos" />
            <Input label="RUT" inputMode="numeric" value={form.tax_id}
              onChange={(e) => set('tax_id', e.target.value.replace(/\D/g, ''))}
              placeholder="12 dígitos" hint="Opcional. Si lo ponés, deben ser 12 dígitos." />
            <Input label="Persona de contacto" value={form.contact_name}
              onChange={(e) => set('contact_name', e.target.value)} placeholder="María González" />
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre" required value={form.first_name}
              onChange={(e) => set('first_name', e.target.value)} placeholder="Juan" />
            <Input label="Apellido" required value={form.last_name}
              onChange={(e) => set('last_name', e.target.value)} placeholder="Pérez" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Teléfono" type="tel" required value={form.phone}
            onChange={(e) => set('phone', e.target.value)} placeholder="09X XXX XXX" />
          <Input label="Email" type="email" value={form.email}
            onChange={(e) => set('email', e.target.value)} placeholder="cliente@email.com" />
        </div>

        <Input label="Dirección" required value={form.address}
          onChange={(e) => set('address', e.target.value)} placeholder="Calle, número, ciudad" />

        <div className="space-y-2">
          <Button type="button" variant="secondary" onClick={useMyLocation} isLoading={locating} className="w-full">
            📍 Usar mi ubicación actual
          </Button>
          <LocationPicker lat={form.lat} lng={form.lng} onChange={(lat, lng) => { set('lat', lat); set('lng', lng); }} />
        </div>

        <Input label="Notas (opcional)" value={form.notes}
          onChange={(e) => set('notes', e.target.value)} placeholder="Referencias, horarios, etc." />

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <Button type="submit" isLoading={saving} className="w-full">Enviar mis datos</Button>
      </form>
    </Shell>
  );
}
