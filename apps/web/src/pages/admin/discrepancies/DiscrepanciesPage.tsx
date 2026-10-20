import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import {
  useStockDiscrepancies, useResolveDiscrepancy, useDiscardDiscrepancy, type Discrepancy,
} from '../../../hooks/useStockDiscrepancies';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';

const REASONS = [
  { value: 'roto', label: 'Roto / rotura' },
  { value: 'merma', label: 'Merma' },
  { value: 'error_carga', label: 'Error al cargar' },
  { value: 'entrega_no_registrada', label: 'Entrega no registrada' },
  { value: 'otro', label: 'Otro' },
];
const REASON_LABEL: Record<string, string> = Object.fromEntries(REASONS.map((r) => [r.value, r.label]));

const TABS: { value: Discrepancy['status']; label: string }[] = [
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'resuelto', label: 'Resueltos' },
  { value: 'descartado', label: 'Descartados' },
];

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
    d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
}

export default function DiscrepanciesPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Discrepancy['status']>('pendiente');
  const { data: list, isLoading } = useStockDiscrepancies(tab);
  const resolve = useResolveDiscrepancy();
  const discard = useDiscardDiscrepancy();

  const [resolving, setResolving] = useState<Discrepancy | null>(null);
  const rows = list ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Descuadres de stock</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Reportes de los choferes cuando el conteo físico no coincide con el sistema. Revisá y aplicá el ajuste.
        </p>
      </div>

      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-1 w-fit">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${tab === t.value ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-14 text-sm text-gray-400">Sin descuadres en este estado.</div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((d) => (
            <div key={d.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{d.driver_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{fmt(d.created_at)}</p>
                </div>
                {d.status === 'pendiente'
                  ? <Badge variant="red">Pendiente</Badge>
                  : d.status === 'resuelto'
                    ? <Badge variant="green">Resuelto</Badge>
                    : <Badge variant="gray">Descartado</Badge>}
              </div>

              <div className="space-y-1">
                {d.items.map((it) => {
                  const diff = it.counted_qty - it.system_qty;
                  return (
                    <div key={it.egg_type_id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{it.egg_type_name ?? 'Categoría'}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        sistema {it.system_qty} · real {it.counted_qty} ·{' '}
                        <strong className={diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          {diff > 0 ? '+' : ''}{diff} cp
                        </strong>
                      </span>
                    </div>
                  );
                })}
              </div>
              {d.note && <p className="text-xs text-gray-500 dark:text-gray-400">Nota del chofer: {d.note}</p>}

              {d.status === 'pendiente' ? (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => setResolving(d)}>Resolver</Button>
                  <Button size="sm" variant="secondary" onClick={() => {
                    discard.mutate({ id: d.id, resolvedBy: profile?.id ?? '', note: null },
                      { onSuccess: () => toast.success('Descartado'), onError: () => toast.error('No se pudo descartar') });
                  }}>Descartar</Button>
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {d.resolution_reason ? `Motivo: ${REASON_LABEL[d.resolution_reason] ?? d.resolution_reason}` : ''}
                  {d.resolution_note ? ` · ${d.resolution_note}` : ''}{d.resolved_at ? ` · ${fmt(d.resolved_at)}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <ResolveModal
        disc={resolving}
        onClose={() => setResolving(null)}
        onConfirm={(reason, note, apply) => {
          if (!resolving) return;
          resolve.mutate(
            {
              id: resolving.id, driver_id: resolving.driver_id, reason, note,
              resolved_by: profile?.id ?? '', apply,
              items: resolving.items.map((it) => ({ egg_type_id: it.egg_type_id, counted_qty: it.counted_qty })),
            },
            { onSuccess: () => { toast.success(apply ? 'Resuelto y stock ajustado' : 'Resuelto'); setResolving(null); }, onError: () => toast.error('No se pudo resolver') },
          );
        }}
        isLoading={resolve.isPending}
      />
    </div>
  );
}

function ResolveModal({ disc, onClose, onConfirm, isLoading }: {
  disc: Discrepancy | null; onClose: () => void;
  onConfirm: (reason: string, note: string | null, apply: boolean) => void; isLoading: boolean;
}) {
  const [reason, setReason] = useState('roto');
  const [note, setNote] = useState('');
  const [apply, setApply] = useState(true);

  const resumen = useMemo(() => (disc?.items ?? []).map((it) => {
    const diff = it.counted_qty - it.system_qty;
    return `${it.egg_type_name ?? 'tipo'}: ${diff > 0 ? '+' : ''}${diff}`;
  }).join(' · '), [disc]);

  return (
    <Modal isOpen={disc !== null} onClose={onClose} title="Resolver descuadre" size="sm">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {disc?.driver_name} — <strong>{resumen}</strong>
        </p>
        <Select label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} options={REASONS} />
        <Input label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Detalle de la conciliación" />
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} className="w-4 h-4 rounded border-gray-300" />
          Ajustar el stock del chofer a lo contado (recomendado)
        </label>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancelar</Button>
          <Button onClick={() => onConfirm(reason, note.trim() || null, apply)} isLoading={isLoading}>Resolver</Button>
        </div>
      </div>
    </Modal>
  );
}
