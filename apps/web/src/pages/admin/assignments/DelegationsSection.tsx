import { useState } from 'react';
import { toast } from 'sonner';
import { useDriverDelegations, useCreateDelegation, useEndDelegation } from '../../../hooks/useUsers';
import { useUsers } from '../../../hooks/useUsers';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import Modal from '../../../components/ui/Modal';
import Select from '../../../components/ui/Select';

function today() {
  return new Date().toISOString().split('T')[0];
}

function isCurrentlyActive(d: { start_date: string; end_date: string; is_active: boolean }) {
  if (!d.is_active) return false;
  const now = today();
  return d.start_date <= now && d.end_date >= now;
}

export default function DelegationsSection() {
  const { data: delegations, isLoading } = useDriverDelegations();
  const { data: users } = useUsers();
  const createDelegation = useCreateDelegation();
  const endDelegation = useEndDelegation();
  const { profile } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState<{ id: string; label: string } | null>(null);
  const [form, setForm] = useState({ from_driver_id: '', to_driver_id: '', start_date: today(), end_date: '' });

  const drivers = (users ?? []).filter((u) => u.role === 'chofer' && u.is_active);
  const driverOptions = drivers.map((d) => ({ value: d.id, label: d.full_name }));

  function openModal() {
    setForm({ from_driver_id: '', to_driver_id: '', start_date: today(), end_date: '' });
    setModalOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.from_driver_id || !form.to_driver_id || !form.start_date || !form.end_date) return;
    if (form.from_driver_id === form.to_driver_id) {
      toast.error('El chofer origen y destino no pueden ser el mismo');
      return;
    }
    try {
      await createDelegation.mutateAsync({
        ...form,
        created_by: profile?.id ?? '',
      });
      toast.success('Cobertura creada correctamente');
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al crear la cobertura');
    }
  }

  async function handleEnd() {
    if (!confirmEnd) return;
    try {
      await endDelegation.mutateAsync(confirmEnd.id);
      toast.success('Cobertura finalizada');
    } catch {
      toast.error('Error al finalizar la cobertura');
    }
    setConfirmEnd(null);
  }

  const activeDelegations = (delegations ?? []).filter(isCurrentlyActive);
  const pastDelegations = (delegations ?? []).filter((d) => !isCurrentlyActive(d));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Coberturas temporales</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Cuando un chofer sale de vacaciones, otro asume sus clientes temporalmente</p>
        </div>
        <Button onClick={openModal}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva cobertura
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : delegations?.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 text-center py-10 text-sm text-gray-500 dark:text-gray-400">
          No hay coberturas registradas.
        </div>
      ) : (
        <div className="space-y-3">
          {activeDelegations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Activas ahora</p>
              {activeDelegations.map((d) => {
                const from = (d.from_driver as unknown as { full_name: string } | null)?.full_name ?? d.from_driver_id;
                const to = (d.to_driver as unknown as { full_name: string } | null)?.full_name ?? d.to_driver_id;
                return (
                  <div key={d.id} className="bg-white dark:bg-gray-900 rounded-xl border border-green-200 dark:border-green-800 px-4 py-3 flex items-center gap-3 flex-wrap">
                    <Badge variant="green">Activa</Badge>
                    <p className="text-sm text-gray-800 dark:text-gray-200 flex-1">
                      <span className="font-medium">{to}</span>
                      <span className="text-gray-500 dark:text-gray-400"> cubre a </span>
                      <span className="font-medium">{from}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{d.start_date} → {d.end_date}</p>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setConfirmEnd({ id: d.id, label: `${to} cubriendo a ${from}` })}
                    >
                      Finalizar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {pastDelegations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Historial</p>
              {pastDelegations.map((d) => {
                const from = (d.from_driver as unknown as { full_name: string } | null)?.full_name ?? d.from_driver_id;
                const to = (d.to_driver as unknown as { full_name: string } | null)?.full_name ?? d.to_driver_id;
                return (
                  <div key={d.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3 flex-wrap opacity-60">
                    <Badge variant="red">{d.is_active ? 'Pendiente' : 'Finalizada'}</Badge>
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                      <span className="font-medium">{to}</span>
                      <span className="text-gray-500"> cubrió a </span>
                      <span className="font-medium">{from}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{d.start_date} → {d.end_date}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal nueva cobertura */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nueva cobertura temporal">
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Chofer que sale de vacaciones (origen)"
            required
            value={form.from_driver_id}
            onChange={(e) => setForm((f) => ({ ...f, from_driver_id: e.target.value }))}
            options={driverOptions}
            placeholder="Selecciona un chofer"
          />
          <Select
            label="Chofer que cubre (destino)"
            required
            value={form.to_driver_id}
            onChange={(e) => setForm((f) => ({ ...f, to_driver_id: e.target.value }))}
            options={driverOptions.filter((o) => o.value !== form.from_driver_id)}
            placeholder="Selecciona un chofer"
            disabled={!form.from_driver_id}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha inicio</label>
              <input
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fecha fin</label>
              <input
                type="date"
                required
                min={form.start_date}
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
          {form.from_driver_id && form.to_driver_id && form.start_date && form.end_date && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <strong>{driverOptions.find((o) => o.value === form.to_driver_id)?.label}</strong> verá sus propios clientes más los de <strong>{driverOptions.find((o) => o.value === form.from_driver_id)?.label}</strong> entre el {form.start_date} y el {form.end_date}.
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)} className="flex-1">Cancelar</Button>
            <Button type="submit" isLoading={createDelegation.isPending} className="flex-1" disabled={!form.from_driver_id || !form.to_driver_id || !form.start_date || !form.end_date}>
              Crear cobertura
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmEnd}
        onClose={() => setConfirmEnd(null)}
        onConfirm={handleEnd}
        isLoading={endDelegation.isPending}
        title="Finalizar cobertura"
        message={`¿Finalizar la cobertura de ${confirmEnd?.label}? El chofer sustituto dejará de ver los clientes del chofer ausente.`}
      />
    </div>
  );
}
