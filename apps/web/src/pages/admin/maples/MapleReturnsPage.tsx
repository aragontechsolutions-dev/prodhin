import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import { useMapleReturns, useReviewMapleReturn, type MapleReturn, type MapleStatus } from '../../../hooks/useMapleReturns';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';

const STATUS_TABS: { value: MapleStatus | 'all'; label: string }[] = [
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

function statusBadge(s: MapleStatus) {
  if (s === 'aprobada') return <Badge variant="green">Aprobada</Badge>;
  if (s === 'rechazada') return <Badge variant="red">Rechazada</Badge>;
  return <Badge variant="yellow">Pendiente</Badge>;
}

function PendingCard({ r, reviewerId }: { r: MapleReturn; reviewerId: string }) {
  const review = useReviewMapleReturn();
  const [counted, setCounted] = useState(String(r.declared_qty));
  const [note, setNote] = useState('');

  function approve() {
    const n = parseInt(counted.replace(/[^0-9]/g, ''), 10);
    if (!n || n <= 0) { toast.error('Ingresá la cantidad que contaste'); return; }
    review.mutate(
      { id: r.id, status: 'aprobada', approved_qty: n, review_note: note.trim() || null, reviewer_id: reviewerId },
      { onSuccess: () => toast.success('Entrega aprobada'), onError: () => toast.error('No se pudo aprobar') },
    );
  }
  function reject() {
    review.mutate(
      { id: r.id, status: 'rechazada', approved_qty: null, review_note: note.trim() || null, reviewer_id: reviewerId },
      { onSuccess: () => toast.success('Entrega rechazada'), onError: () => toast.error('No se pudo rechazar') },
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
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Declaró <span className="font-bold text-lg text-gray-900 dark:text-gray-100">{r.declared_qty}</span> maples plásticos.
      </p>
      {r.driver_note && <p className="text-sm text-gray-500 dark:text-gray-400">Nota del chofer: {r.driver_note}</p>}

      <div className="flex flex-wrap items-end gap-3 pt-1">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Cantidad que contaste</label>
          <input
            value={counted}
            onChange={(e) => setCounted(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="flex-1 min-w-[160px] px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={approve} isLoading={review.isPending} className="flex-1">Aprobar</Button>
        <Button variant="danger" onClick={reject} isLoading={review.isPending} className="flex-1">Rechazar</Button>
      </div>
    </div>
  );
}

function ReviewedCard({ r }: { r: MapleReturn }) {
  const mismatch = r.status === 'aprobada' && r.approved_qty != null && r.approved_qty !== r.declared_qty;
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{r.driver?.full_name ?? 'Chofer'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{fmt(r.created_at)}</p>
        </div>
        {statusBadge(r.status)}
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">Declaró: <strong>{r.declared_qty}</strong> maples</p>
      {r.status === 'aprobada' && r.approved_qty != null && (
        <p className={`text-sm font-semibold ${mismatch ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
          Aprobado: {r.approved_qty} maples{mismatch ? ` (diferencia de ${r.approved_qty - r.declared_qty})` : ''}
        </p>
      )}
      {r.review_note && <p className="text-sm text-gray-500 dark:text-gray-400">Nota: {r.review_note}</p>}
    </div>
  );
}

export default function MapleReturnsPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<MapleStatus | 'all'>('pendiente');
  const { data, isLoading } = useMapleReturns(tab === 'all' ? undefined : tab);
  const rows = data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Entregas de maples</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Maples plásticos que los choferes entregan a la empresa. Contá y aprobá (o rechazá) cada entrega.
        </p>
      </div>

      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1 w-fit">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              tab === t.value ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
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
          {tab === 'pendiente' ? 'No hay entregas pendientes de aprobar.' : 'Sin registros.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) =>
            r.status === 'pendiente'
              ? <PendingCard key={r.id} r={r} reviewerId={profile?.id ?? ''} />
              : <ReviewedCard key={r.id} r={r} />,
          )}
        </div>
      )}
    </div>
  );
}
