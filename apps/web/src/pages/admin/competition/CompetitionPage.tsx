import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, CircleMarker, useMapEvents, Popup } from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';
import {
  useCompetitors, useSaveCompetitor, useDeleteCompetitor, useApproveCompetitor,
  useProspects, useUpdateProspectStatus, useConvertProspect,
  prospectPhotoUrl, type Competitor, type Prospect, type ProspectStatus,
} from '../../../hooks/useMarketIntel';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const DEFAULT_CENTER: [number, number] = [-34.9011, -54.9595];
const STATUS_TABS: { value: ProspectStatus | 'all'; label: string }[] = [
  { value: 'nuevo', label: 'Nuevos' },
  { value: 'contactado', label: 'Contactados' },
  { value: 'convertido', label: 'Convertidos' },
  { value: 'descartado', label: 'Descartados' },
  { value: 'all', label: 'Todos' },
];

function ClickToAdd({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onPick(+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)); } });
  return null;
}

function statusBadge(s: ProspectStatus) {
  if (s === 'convertido') return <Badge variant="green">Convertido</Badge>;
  if (s === 'contactado') return <Badge variant="blue">Contactado</Badge>;
  if (s === 'descartado') return <Badge variant="red">Descartado</Badge>;
  return <Badge variant="yellow">Nuevo</Badge>;
}

export default function CompetitionPage() {
  const { profile } = useAuth();
  const { data: competitors } = useCompetitors();
  const { data: allProspects } = useProspects();
  const saveComp = useSaveCompetitor();
  const delComp = useDeleteCompetitor();
  const approveComp = useApproveCompetitor();
  const updStatus = useUpdateProspectStatus();
  const convert = useConvertProspect();

  const [tab, setTab] = useState<ProspectStatus | 'all'>('nuevo');
  const [addMode, setAddMode] = useState(false);
  const [comp, setComp] = useState<{ id?: string; name: string; lat: number | null; lng: number | null; radius_m: string; notes: string }>({ name: '', lat: null, lng: null, radius_m: '500', notes: '' });
  const [converting, setConverting] = useState<Prospect | null>(null);

  const prospects = allProspects ?? [];
  const listProspects = tab === 'all' ? prospects : prospects.filter((p) => p.status === tab);

  const approvedComp = (competitors ?? []).filter((c) => c.status === 'aprobado');
  const pendingComp = (competitors ?? []).filter((c) => c.status === 'pendiente');

  const center = useMemo<[number, number]>(() => {
    if (competitors?.[0]) return [competitors[0].lat, competitors[0].lng];
    if (prospects[0]) return [prospects[0].lat, prospects[0].lng];
    return DEFAULT_CENTER;
  }, [competitors, prospects]);

  function pickOnMap(lat: number, lng: number) {
    if (!addMode) return;
    setComp((c) => ({ ...c, lat, lng }));
  }
  function saveCompetitor() {
    if (!comp.name.trim() || comp.lat == null || comp.lng == null) { toast.error('Poné nombre y tocá el mapa para la ubicación'); return; }
    saveComp.mutate(
      { id: comp.id, name: comp.name.trim(), lat: comp.lat, lng: comp.lng, radius_m: parseInt(comp.radius_m, 10) || 500, notes: comp.notes.trim() || null },
      { onSuccess: () => { toast.success('Competidor guardado'); setComp({ name: '', lat: null, lng: null, radius_m: '500', notes: '' }); setAddMode(false); }, onError: () => toast.error('No se pudo guardar') },
    );
  }
  function editCompetitor(c: Competitor) {
    setComp({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, radius_m: String(c.radius_m), notes: c.notes ?? '' });
    setAddMode(true);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Competencia y prospectos</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Mapa de calor de la competencia (zonas marcadas + relevamientos de los choferes) y gestión de potenciales clientes.
        </p>
      </div>

      {/* Competencia propuesta por choferes, pendiente de aprobar */}
      {pendingComp.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            🚩 {pendingComp.length} competidor(es) marcado(s) por choferes, pendiente(s) de aprobar
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {pendingComp.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-amber-800 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Radio {c.radius_m} m · {c.creator?.full_name ?? 'chofer'}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" onClick={() => approveComp.mutate(c.id)}>Aprobar</Button>
                  <Button size="sm" variant="secondary" onClick={() => editCompetitor(c)}>Editar</Button>
                  <Button size="sm" variant="danger" onClick={() => delComp.mutate(c.id)}>Borrar</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mapa */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500" /> zona competidor</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400/30 border border-amber-500 border-dashed" /> propuesta del chofer</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500/60" /> prospecto c/competencia</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-teal-500/70" /> prospecto s/competencia</span>
          </div>
          <Button size="sm" variant={addMode ? 'primary' : 'secondary'} onClick={() => setAddMode((v) => !v)}>
            {addMode ? 'Tocá el mapa para ubicar…' : '＋ Agregar competidor'}
          </Button>
        </div>
        <div className="h-[420px]">
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickToAdd onPick={pickOnMap} />
            {/* Zonas de competidores aprobadas */}
            {approvedComp.map((c) => (
              <Circle key={c.id} center={[c.lat, c.lng]} radius={c.radius_m}
                pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.12, weight: 1.5 }}>
                <Popup>
                  <strong>{c.name}</strong><br />Radio: {c.radius_m} m
                  <br /><button onClick={() => editCompetitor(c)} style={{ color: '#1d4ed8' }}>Editar</button>
                  {' · '}
                  <button onClick={() => delComp.mutate(c.id)} style={{ color: '#dc2626' }}>Borrar</button>
                </Popup>
              </Circle>
            ))}
            {/* Propuestas de choferes (pendientes de aprobar) */}
            {pendingComp.map((c) => (
              <Circle key={c.id} center={[c.lat, c.lng]} radius={c.radius_m}
                pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.12, weight: 1.5, dashArray: '6 6' }}>
                <Popup>
                  <strong>{c.name}</strong> <em>(pendiente)</em><br />Radio: {c.radius_m} m
                  <br />Propuesto por: {c.creator?.full_name ?? 'chofer'}
                  <br /><button onClick={() => approveComp.mutate(c.id)} style={{ color: '#16a34a' }}>Aprobar</button>
                  {' · '}
                  <button onClick={() => editCompetitor(c)} style={{ color: '#1d4ed8' }}>Editar</button>
                  {' · '}
                  <button onClick={() => delComp.mutate(c.id)} style={{ color: '#dc2626' }}>Borrar</button>
                </Popup>
              </Circle>
            ))}
            {/* Prospectos (efecto calor: puntos translúcidos) */}
            {prospects.map((p) => (
              <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={9}
                pathOptions={{ color: p.has_competition ? '#ea580c' : '#0d9488', fillColor: p.has_competition ? '#f97316' : '#14b8a6', fillOpacity: 0.5, weight: 1 }}>
                <Popup>
                  <strong>{p.name}</strong><br />{p.has_competition ? 'Con competencia' : 'Sin competencia'} · {p.status}
                  {p.offers.length > 0 && <><br />{p.offers.length} producto(s) relevado(s)</>}
                </Popup>
              </CircleMarker>
            ))}
            {/* Marcador temporal del competidor a agregar */}
            {addMode && comp.lat != null && comp.lng != null && (
              <Marker position={[comp.lat, comp.lng]} />
            )}
          </MapContainer>
        </div>
        {/* Form competidor */}
        {addMode && (
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <Input label="Nombre del competidor" value={comp.name} onChange={(e) => setComp((c) => ({ ...c, name: e.target.value }))} placeholder="Ej: Granja XX" />
            <Input label="Radio (m)" type="number" value={comp.radius_m} onChange={(e) => setComp((c) => ({ ...c, radius_m: e.target.value.replace(/[^0-9]/g, '') }))} />
            <Input label="Notas" value={comp.notes} onChange={(e) => setComp((c) => ({ ...c, notes: e.target.value }))} placeholder="Opcional" />
            <div className="flex gap-2">
              <Button onClick={saveCompetitor} isLoading={saveComp.isPending} className="flex-1">{comp.id ? 'Guardar' : 'Agregar'}</Button>
              <Button variant="secondary" onClick={() => { setAddMode(false); setComp({ name: '', lat: null, lng: null, radius_m: '500', notes: '' }); }}>Cancelar</Button>
            </div>
            <p className="sm:col-span-4 text-xs text-gray-400">{comp.lat != null ? `Ubicación: ${comp.lat}, ${comp.lng}` : 'Tocá el mapa para fijar la ubicación del competidor.'}</p>
          </div>
        )}
      </div>

      {/* Prospectos */}
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1 w-fit">
        {STATUS_TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${tab === t.value ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {listProspects.length === 0 ? (
        <div className="text-center py-14 text-gray-500 dark:text-gray-400 text-sm">Sin prospectos en este estado.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {listProspects.map((p) => (
            <div key={p.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{p.address || 'Sin dirección'} · {p.phone || 'sin tel.'} · {p.creator?.full_name ?? 'chofer'}</p>
                </div>
                {statusBadge(p.status)}
              </div>
              {p.notes && <p className="text-sm text-gray-600 dark:text-gray-300">{p.notes}</p>}
              {p.offers.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Oferta de la competencia relevada:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {p.offers.map((o) => (
                      <div key={o.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {o.photo_path && (
                          <a href={prospectPhotoUrl(o.photo_path)} target="_blank" rel="noopener noreferrer">
                            <img src={prospectPhotoUrl(o.photo_path)} alt="oferta" className="w-full h-28 object-cover" />
                          </a>
                        )}
                        <div className="p-2 text-xs">
                          <p className="font-semibold text-gray-800 dark:text-gray-200">{o.egg_type || 'Producto'}</p>
                          <p className="text-gray-500 dark:text-gray-400">{o.format || '—'}{o.price != null ? ` · $${o.price}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {p.status !== 'convertido' && <Button size="sm" onClick={() => setConverting(p)}>Convertir a cliente</Button>}
                {p.status === 'nuevo' && <Button size="sm" variant="secondary" onClick={() => updStatus.mutate({ id: p.id, status: 'contactado' })}>Marcar contactado</Button>}
                {p.status !== 'descartado' && p.status !== 'convertido' && <Button size="sm" variant="danger" onClick={() => updStatus.mutate({ id: p.id, status: 'descartado' })}>Descartar</Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConvertModal prospect={converting} onClose={() => setConverting(null)} reviewerId={profile?.id ?? ''} convert={convert} />
    </div>
  );
}

function ConvertModal({ prospect, onClose, reviewerId, convert }: { prospect: Prospect | null; onClose: () => void; reviewerId: string; convert: ReturnType<typeof useConvertProspect> }) {
  const [num, setNum] = useState('');
  const [type, setType] = useState<'empresa' | 'persona_fisica'>('empresa');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');

  function submit() {
    if (!prospect) return;
    const n = parseInt(num.replace(/[^0-9]/g, ''), 10);
    if (!n) { toast.error('Ingresá el número de cliente'); return; }
    if (type === 'persona_fisica' && (!first.trim() || !last.trim())) { toast.error('Nombre y apellido'); return; }
    convert.mutate(
      {
        prospectId: prospect.id, customer_number: n, customer_type: type,
        business_name: type === 'empresa' ? prospect.name : null,
        first_name: type === 'persona_fisica' ? first.trim() : null,
        last_name: type === 'persona_fisica' ? last.trim() : null,
        phone: prospect.phone || 's/d', address: prospect.address || 's/d',
        lat: prospect.lat, lng: prospect.lng, created_by: reviewerId,
      },
      { onSuccess: () => { toast.success('Convertido a cliente'); onClose(); setNum(''); setFirst(''); setLast(''); }, onError: (e) => toast.error(e instanceof Error && /uq_customers_customer_number/.test(e.message) ? 'Ese número ya existe' : 'No se pudo convertir') },
    );
  }

  return (
    <Modal isOpen={prospect !== null} onClose={onClose} title="Convertir en cliente" size="md">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Se crea un cliente con los datos de <strong>{prospect?.name}</strong> (ubicación incluida). Completá lo que falta.</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="N° de cliente" value={num} onChange={(e) => setNum(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Ej: 130" />
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value as 'empresa' | 'persona_fisica')}
            options={[{ value: 'empresa', label: 'Empresa / Local' }, { value: 'persona_fisica', label: 'Persona física' }]} />
        </div>
        {type === 'persona_fisica' && (
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre" value={first} onChange={(e) => setFirst(e.target.value)} />
            <Input label="Apellido" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={convert.isPending}>Cancelar</Button>
          <Button onClick={submit} isLoading={convert.isPending}>Crear cliente</Button>
        </div>
      </div>
    </Modal>
  );
}
