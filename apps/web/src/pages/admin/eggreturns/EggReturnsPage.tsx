import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import { useEggTypes } from '../../../hooks/useEggTypes';
import { useEggReturns, useReviewEggReturn, type EggReturn, type EggReturnStatus } from '../../../hooks/useEggReturns';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';

const STATUS_TABS: { value: EggReturnStatus | 'all'; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'aprobada', label: 'Aprobadas' },
  { value: 'rechazada', label: 'Rechazadas' },
  { value: 'all', label: 'Todas' },
];

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
}
function statusBadge(s: EggReturnStatus) {
  if (s === 'aprobada') return <Badge variant="green">Aprobada</Badge>;
  if (s === 'rechazada') return <Badge variant="red">Rechazada</Badge>;
  return <Badge variant="yellow">Pendiente</Badge>;
}

function PendingCard({ r, reviewerId, eggName, packText }: { r: EggReturn; reviewerId: string; eggName: Map<string, string>; packText: (id: string, packages: number) => string }) {
  const review = useReviewEggReturn();
  const [brokenRet, setBrokenRet] = useState(r.broken_qty > 0 ? String(r.broken_qty) : '');
  const [note, setNote] = useState('');
  const [items, setItems] = useState(() =>
    r.items.map((it) => ({ id: it.id, returned_qty: String(it.qty), returned_expiry_date: '' })),
  );

  function setItem(id: string, patch: Partial<{ returned_qty: string; returned_expiry_date: string }>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function submit(status: 'aprobada' | 'rechazada') {
    const payloadItems = items.map((it) => ({
      id: it.id,
      returned_qty: status === 'aprobada' ? (parseInt(it.returned_qty.replace(/[^0-9]/g, ''), 10) || 0) : null,
      returned_expiry_date: status === 'aprobada' ? (it.returned_expiry_date.trim() || null) : null,
    }));
    review.mutate(
      {
        id: r.id,
        status,
        broken_returned: status === 'aprobada' ? (parseInt(brokenRet.replace(/[^0-9]/g, ''), 10) || 0) : null,
        review_note: note.trim() || null,
        reviewer_id: reviewerId,
        items: payloadItems,
      },
      {
        onSuccess: () => toast.success(status === 'aprobada' ? 'Devolución aprobada' : 'Devolución rechazada'),
        onError: () => toast.error('No se pudo guardar'),
      },
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{r.driver?.full_name ?? 'Chofer'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{fmt(r.created_at)}</p>
        </div>
        {statusBadge(r.status)}
      </div>
      {r.driver_note && <p className="text-sm text-gray-500 dark:text-gray-400">Nota del chofer: {r.driver_note}</p>}

      {/* Rotos */}
      {r.broken_qty > 0 && (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">🥚 Huevos rotos declarados: <strong>{r.broken_qty}</strong></p>
          <label className="text-xs text-gray-500 dark:text-gray-400 mt-2 block">Le devolvés (sanos):</label>
          <input value={brokenRet} onChange={(e) => setBrokenRet(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric"
            className="w-28 mt-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100" />
        </div>
      )}

      {/* Vencidos */}
      {r.items.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">📦 Envasados vencidos</p>
          {r.items.map((it) => {
            const local = items.find((x) => x.id === it.id)!;
            return (
              <div key={it.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {eggName.get(it.egg_type_id) ?? 'Producto'} — declaró <strong>{it.qty}</strong> paq
                  {packText(it.egg_type_id, it.qty) ? <span className="text-emerald-600 dark:text-emerald-400"> ({packText(it.egg_type_id, it.qty)})</span> : null}
                  <span className="text-gray-500 dark:text-gray-400"> · vence {it.expiry_date}</span>
                </p>
                <div className="flex flex-wrap items-end gap-3 mt-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Le devolvés (paquetes)</label>
                    <input value={local.returned_qty} onChange={(e) => setItem(it.id, { returned_qty: e.target.value.replace(/[^0-9]/g, '') })} inputMode="numeric"
                      className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
                    <label className="text-xs text-gray-500 dark:text-gray-400">Vence (del envase que devolvés)</label>
                    <input value={local.returned_expiry_date} onChange={(e) => setItem(it.id, { returned_expiry_date: e.target.value })} placeholder="Ej: 06/2026"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)"
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100" />
      <div className="flex gap-2">
        <Button onClick={() => submit('aprobada')} isLoading={review.isPending} className="flex-1">Aprobar</Button>
        <Button variant="danger" onClick={() => submit('rechazada')} isLoading={review.isPending} className="flex-1">Rechazar</Button>
      </div>
    </div>
  );
}

function ReviewedCard({ r, eggName, packText }: { r: EggReturn; eggName: Map<string, string>; packText: (id: string, packages: number) => string }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{r.driver?.full_name ?? 'Chofer'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{fmt(r.created_at)}</p>
        </div>
        {statusBadge(r.status)}
      </div>
      {r.broken_qty > 0 && (
        <p className="text-sm text-gray-700 dark:text-gray-300">
          🥚 Rotos: <strong>{r.broken_qty}</strong>
          {r.status === 'aprobada' && r.broken_returned != null ? ` · devueltos ${r.broken_returned}` : ''}
        </p>
      )}
      {r.items.map((it) => (
        <p key={it.id} className="text-sm text-gray-700 dark:text-gray-300">
          📦 {eggName.get(it.egg_type_id) ?? 'Producto'}: <strong>{it.qty}</strong> paq
          {packText(it.egg_type_id, it.qty) ? ` (${packText(it.egg_type_id, it.qty)})` : ''} · vence {it.expiry_date}
          {r.status === 'aprobada' && it.returned_qty != null
            ? ` · devueltos ${it.returned_qty} paq${it.returned_expiry_date ? ` (vence ${it.returned_expiry_date})` : ''}`
            : ''}
        </p>
      ))}
      {r.review_note && <p className="text-sm text-gray-500 dark:text-gray-400">Nota: {r.review_note}</p>}
    </div>
  );
}

export default function EggReturnsPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<EggReturnStatus | 'all'>('pendiente');
  const { data, isLoading } = useEggReturns(tab === 'all' ? undefined : tab);
  const { data: eggTypes } = useEggTypes();
  const rows = data ?? [];

  const eggName = useMemo(() => {
    const m = new Map<string, string>();
    (eggTypes ?? []).forEach((t) => m.set(t.id, t.name));
    return m;
  }, [eggTypes]);

  const packText = useMemo(() => {
    const info = new Map<string, { epp: number | null; ppb: number | null }>();
    (eggTypes ?? []).forEach((t) => info.set(t.id, { epp: t.eggs_per_package, ppb: t.packages_per_box }));
    return (eggTypeId: string, packages: number): string => {
      const i = info.get(eggTypeId);
      if (!i || !i.epp || packages <= 0) return '';
      const huevos = packages * i.epp;
      let extra = '';
      if (i.ppb && i.ppb > 0) {
        const cajas = Math.floor(packages / i.ppb);
        const resto = packages % i.ppb;
        if (cajas > 0) extra = ` · ${cajas} caja${cajas > 1 ? 's' : ''}${resto > 0 ? ` + ${resto} paq` : ''}`;
      }
      return `${huevos} huevos${extra}`;
    };
  }, [eggTypes]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Rotos y devoluciones</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Huevos rotos y productos envasados vencidos que devuelven los choferes. Controlá y registrá qué les devolvés.
        </p>
      </div>

      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1 w-fit">
        {STATUS_TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              tab === t.value ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
          {tab === 'pendiente' ? 'No hay devoluciones pendientes.' : 'Sin registros.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) =>
            r.status === 'pendiente'
              ? <PendingCard key={r.id} r={r} reviewerId={profile?.id ?? ''} eggName={eggName} packText={packText} />
              : <ReviewedCard key={r.id} r={r} eggName={eggName} packText={packText} />,
          )}
        </div>
      )}
    </div>
  );
}
