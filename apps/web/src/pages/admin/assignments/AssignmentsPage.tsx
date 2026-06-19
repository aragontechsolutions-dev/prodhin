import { useState, useMemo } from 'react';
import DelegationsSection from './DelegationsSection';
import { toast } from 'sonner';
import {
  useDriverCustomers,
  useBulkAssignCustomers,
  useUnassignCustomer,
  useCustomers,
} from '../../../hooks/useCustomers';
import { useUsers } from '../../../hooks/useUsers';
import { useAuth } from '../../../hooks/useAuth';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import type { Customer } from '@prodhin/shared';

function getCustomerName(c: Pick<Customer, 'customer_type' | 'business_name' | 'first_name' | 'last_name'>): string {
  return c.customer_type === 'empresa'
    ? (c.business_name ?? 'Sin nombre')
    : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Sin nombre';
}

export default function AssignmentsPage() {
  const { data: assignments, isLoading } = useDriverCustomers();
  const { data: customers } = useCustomers();
  const { data: users } = useUsers();
  const bulkAssign = useBulkAssignCustomers();
  const unassignCustomer = useUnassignCustomer();
  const { profile } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [confirmUnassign, setConfirmUnassign] = useState<{ driverId: string; customerId: string; label: string } | null>(null);
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);

  const drivers = (users ?? []).filter((u) => u.role === 'chofer' && u.is_active);

  // Group assignments by driver
  const byDriver = useMemo(() => {
    const map = new Map<string, { driverName: string; customers: Array<{ customerId: string; name: string }> }>();
    for (const a of assignments ?? []) {
      const profilesRaw = a.profiles as unknown;
      const customersRaw = a.customers as unknown;
      const driver = (Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw) as { full_name: string } | null;
      const customer = (Array.isArray(customersRaw) ? customersRaw[0] : customersRaw) as { id: string; customer_type: string; first_name: string | null; last_name: string | null; business_name: string | null } | null;
      if (!driver || !customer) continue;
      if (!map.has(a.driver_id)) map.set(a.driver_id, { driverName: driver.full_name, customers: [] });
      map.get(a.driver_id)!.customers.push({
        customerId: customer.id,
        name: getCustomerName(customer as Pick<Customer, 'customer_type' | 'business_name' | 'first_name' | 'last_name'>),
      });
    }
    return map;
  }, [assignments]);

  // Customers already assigned to selected driver
  const assignedToDriver = useMemo(
    () => new Set(byDriver.get(selectedDriverId)?.customers.map((c) => c.customerId) ?? []),
    [byDriver, selectedDriverId],
  );

  // Available = active + not yet assigned to this driver
  const availableCustomers = useMemo(
    () => (customers ?? []).filter((c) => c.is_active && !assignedToDriver.has(c.id)),
    [customers, assignedToDriver],
  );

  // Filtered by search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableCustomers;
    return availableCustomers.filter((c) => {
      const name = getCustomerName(c).toLowerCase();
      const taxId = (c.tax_id ?? '').toLowerCase();
      const phone = (c.phone ?? '').toLowerCase();
      return name.includes(q) || taxId.includes(q) || phone.includes(q);
    });
  }, [availableCustomers, search]);

  function openModal(driverId = '') {
    setSelectedDriverId(driverId);
    setCheckedIds(new Set());
    setSearch('');
    setModalOpen(true);
  }

  function toggleCheck(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checkedIds.size === filtered.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filtered.map((c) => c.id)));
    }
  }

  async function handleAssign() {
    if (!selectedDriverId || checkedIds.size === 0) return;
    try {
      await bulkAssign.mutateAsync({
        driver_id: selectedDriverId,
        customer_ids: [...checkedIds],
        assigned_by: profile?.id ?? '',
      });
      toast.success(`${checkedIds.size} cliente${checkedIds.size > 1 ? 's' : ''} asignado${checkedIds.size > 1 ? 's' : ''} correctamente`);
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al asignar');
    }
  }

  async function handleUnassign() {
    if (!confirmUnassign) return;
    try {
      await unassignCustomer.mutateAsync({ driver_id: confirmUnassign.driverId, customer_id: confirmUnassign.customerId });
      toast.success('Asignación eliminada');
    } catch {
      toast.error('Error al quitar la asignación');
    }
    setConfirmUnassign(null);
  }

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);
  const allChecked = filtered.length > 0 && checkedIds.size === filtered.length;
  const someChecked = checkedIds.size > 0 && !allChecked;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Asignaciones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Asigna clientes a los choferes</p>
        </div>
        <Button onClick={() => openModal()}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva asignación
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : drivers.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center py-16 text-sm text-gray-500 dark:text-gray-400">
          No hay choferes activos registrados.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.map((driver) => {
            const entry = byDriver.get(driver.id);
            const count = entry?.customers.length ?? 0;
            const isExpanded = expandedDriverId === driver.id;
            return (
              <div key={driver.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
                <button
                  type="button"
                  className="w-full px-4 py-3 flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  onClick={() => setExpandedDriverId(isExpanded ? null : driver.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs flex-shrink-0">
                      {driver.full_name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{driver.full_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{count} cliente{count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800">
                    <div className="px-4 py-2 flex justify-end border-b border-gray-50 dark:border-gray-800">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openModal(driver.id); }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Asignar clientes
                      </Button>
                    </div>
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                      {count === 0 ? (
                        <p className="px-4 py-4 text-xs text-gray-400 dark:text-gray-600 text-center">Sin clientes asignados</p>
                      ) : (
                        entry!.customers.map((ac) => {
                          const full = (customers ?? []).find((c) => c.id === ac.customerId);
                          return (
                            <div key={ac.customerId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">{ac.name}</p>
                                {full && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{full.phone}</p>}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {full && (
                                  <Badge variant={full.customer_type === 'empresa' ? 'blue' : 'yellow'}>
                                    {full.customer_type === 'empresa' ? 'Empresa' : 'Persona'}
                                  </Badge>
                                )}
                                <button
                                  onClick={() => setConfirmUnassign({ driverId: driver.id, customerId: ac.customerId, label: `${ac.name} de ${driver.full_name}` })}
                                  className="p-1 text-gray-400 hover:text-red-500 transition rounded"
                                  title="Quitar asignación"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal asignación con buscador + checkboxes ── */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Asignar clientes a chofer">
        <div className="space-y-4">
          {/* Driver selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chofer</label>
            <select
              className="w-full border border-gray-300 dark:border-gray-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
              value={selectedDriverId}
              onChange={(e) => { setSelectedDriverId(e.target.value); setCheckedIds(new Set()); setSearch(''); }}
            >
              <option value="">Selecciona un chofer</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.full_name}</option>
              ))}
            </select>
          </div>

          {selectedDriverId && (
            <>
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por nombre, RUT o teléfono..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCheckedIds(new Set()); }}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  autoFocus
                />
                {search && (
                  <button onClick={() => { setSearch(''); setCheckedIds(new Set()); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
                )}
              </div>

              {/* Select-all bar */}
              {filtered.length > 0 && (
                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-400 cursor-pointer"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {allChecked ? 'Deseleccionar todos' : `Seleccionar todos (${filtered.length})`}
                    </span>
                  </label>
                  {checkedIds.size > 0 && (
                    <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full">
                      {checkedIds.size} seleccionado{checkedIds.size > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}

              {/* Customer list */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    {availableCustomers.length === 0
                      ? 'Todos los clientes activos ya están asignados a este chofer'
                      : 'Sin resultados para tu búsqueda'}
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((c) => {
                      const name = getCustomerName(c);
                      const isChecked = checkedIds.has(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isChecked ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheck(c.id)}
                            className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-400 cursor-pointer flex-shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {c.phone}{c.tax_id ? ` · ${c.tax_id}` : ''}
                            </p>
                          </div>
                          <Badge variant={c.customer_type === 'empresa' ? 'blue' : 'yellow'}>
                            {c.customer_type === 'empresa' ? 'Empresa' : 'Persona'}
                          </Badge>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleAssign}
              isLoading={bulkAssign.isPending}
              className="flex-1"
              disabled={!selectedDriverId || checkedIds.size === 0}
            >
              {checkedIds.size > 0
                ? `Asignar ${checkedIds.size} cliente${checkedIds.size > 1 ? 's' : ''}`
                : 'Asignar'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmUnassign}
        onClose={() => setConfirmUnassign(null)}
        onConfirm={handleUnassign}
        isLoading={unassignCustomer.isPending}
        title="Quitar asignación"
        message={`¿Quitar a ${confirmUnassign?.label}?`}
      />

      <hr className="border-gray-200 dark:border-gray-800" />
      <DelegationsSection />
    </div>
  );
}
