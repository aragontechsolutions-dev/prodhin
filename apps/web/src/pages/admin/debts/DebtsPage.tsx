import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Customer } from '@prodhin/shared';
import { useCustomers } from '../../../hooks/useCustomers';
import { useAuth } from '../../../hooks/useAuth';
import { useDebtBalances, useCustomerPayments, useRegisterPayment, type DebtRow } from '../../../hooks/useDebts';
import { formatMoney } from '../../../lib/pricing';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Modal from '../../../components/ui/Modal';
import Badge from '../../../components/ui/Badge';

function customerName(c: Customer | undefined): string {
  if (!c) return 'Cliente';
  if (c.customer_type === 'empresa') return c.business_name ?? 'Sin nombre';
  return `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Sin nombre';
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function DebtsPage() {
  const { profile } = useAuth();
  const { data: balances, isLoading } = useDebtBalances();
  const { data: customers } = useCustomers();
  const register = useRegisterPayment();

  const [cobro, setCobro] = useState<{ row: DebtRow; name: string } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);

  const custMap = useMemo(() => {
    const m = new Map<string, Customer>();
    (customers ?? []).forEach((c) => m.set(c.id, c));
    return m;
  }, [customers]);

  const rows = useMemo(() => {
    return (balances ?? [])
      .filter((b) => b.saldo > 0.009)
      .map((b) => ({ ...b, name: customerName(custMap.get(b.customer_id)) }))
      .sort((a, b) => b.saldo - a.saldo);
  }, [balances, custMap]);

  const totalDeuda = rows.reduce((s, r) => s + r.saldo, 0);
  const enAlerta = rows.filter((r) => r.entregas_credito_sin_cobrar >= 2);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Deudas de crédito</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Clientes con saldo pendiente, de mayor a menor. Registrá los cobros para bajar la deuda.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Deuda total</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{formatMoney(totalDeuda)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400">Clientes con deuda</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{rows.length}</p>
        </div>
        <div className={`rounded-2xl p-5 shadow-sm border ${enAlerta.length > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400">En alerta (≥2 sin cobrar)</p>
          <p className={`text-2xl font-bold mt-1 ${enAlerta.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{enAlerta.length} ⚠️</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400">No hay deudas pendientes. 🎉</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Cliente</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Deuda</th>
                  <th className="text-center px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Sin cobrar</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Última entrega</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 dark:text-gray-400">Último cobro</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {rows.map((r) => {
                  const alerta = r.entregas_credito_sin_cobrar >= 2;
                  return (
                    <tr key={r.customer_id} className={`transition ${alerta ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
                      <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-gray-100">
                        {alerta && <span title="2+ entregas a crédito sin cobrar">⚠️ </span>}{r.name}
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-gray-900 dark:text-gray-100">{formatMoney(r.saldo)}</td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge variant={alerta ? 'red' : 'gray'}>{r.entregas_credito_sin_cobrar}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400">{fmtDate(r.ultima_entrega_credito)}</td>
                      <td className="px-5 py-3.5 text-gray-600 dark:text-gray-400">{fmtDate(r.ultimo_pago)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          <Button size="sm" onClick={() => setCobro({ row: r, name: r.name })}>Registrar cobro</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDetail(detail === r.customer_id ? null : r.customer_id)}>
                            {detail === r.customer_id ? 'Ocultar' : 'Historial'}
                          </Button>
                        </div>
                        {detail === r.customer_id && <PaymentHistory customerId={r.customer_id} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CobroModal
        open={cobro !== null}
        name={cobro?.name ?? ''}
        saldo={cobro?.row.saldo ?? 0}
        onClose={() => setCobro(null)}
        onConfirm={(amount, note) => {
          if (!cobro) return;
          register.mutate(
            { customer_id: cobro.row.customer_id, amount, note, driver_id: profile?.id ?? null },
            { onSuccess: () => { toast.success('Cobro registrado'); setCobro(null); }, onError: () => toast.error('No se pudo registrar el cobro') },
          );
        }}
        isLoading={register.isPending}
      />
    </div>
  );
}

function PaymentHistory({ customerId }: { customerId: string }) {
  const { data, isLoading } = useCustomerPayments(customerId);
  if (isLoading) return <p className="text-xs text-gray-400 mt-2">Cargando…</p>;
  if (!data || data.length === 0) return <p className="text-xs text-gray-400 mt-2 text-right">Sin cobros registrados.</p>;
  return (
    <div className="mt-2 space-y-1 text-right">
      {data.map((p) => (
        <p key={p.id} className="text-xs text-gray-500 dark:text-gray-400">
          {fmtDate(p.received_at)} · {formatMoney(p.amount)} · {p.driver?.full_name ?? 'admin'}{p.note ? ` · ${p.note}` : ''}
        </p>
      ))}
    </div>
  );
}

function CobroModal({ open, name, saldo, onClose, onConfirm, isLoading }: {
  open: boolean; name: string; saldo: number;
  onClose: () => void; onConfirm: (amount: number, note: string | null) => void; isLoading: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  function submit() {
    const n = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) { toast.error('Ingresá un monto válido'); return; }
    onConfirm(n, note.trim() || null);
    setAmount(''); setNote('');
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Registrar cobro" size="sm">
      <div className="p-6 space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cobro a <strong>{name}</strong>. Deuda actual: <strong>{formatMoney(saldo)}</strong>.
        </p>
        <Input label="Monto cobrado (UYU)" type="number" value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="Ej: 1440" />
        <Input label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: pago parcial" />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancelar</Button>
          <Button onClick={submit} isLoading={isLoading}>Registrar cobro</Button>
        </div>
      </div>
    </Modal>
  );
}
