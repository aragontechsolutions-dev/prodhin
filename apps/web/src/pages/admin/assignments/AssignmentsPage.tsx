import { useState } from 'react';
import { toast } from 'sonner';
import {
  useDriverCustomers,
  useAssignCustomer,
  useUnassignCustomer,
  useCustomers,
} from '../../../hooks/useCustomers';
import { useUsers } from '../../../hooks/useUsers';
import { useAuth } from '../../../hooks/useAuth';
import Badge from '../../../components/ui/Badge';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import Select from '../../../components/ui/Select';
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
  const assignCustomer = useAssignCustomer();
  const unassignCustomer = useUnassignCustomer();
  const { profile } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [confirmUnassign, setConfirmUnassign] = useState<{ driverId: string; customerId: string; label: string } | null>(null);
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);

  const drivers = (users ?? []).filter((u) => u.role === 'chofer' && u.is_active);

  // Group assignments by driver
  const byDriver = new Map<string, { driverName: string; customers: Array<{ customerId: string; name: string; phone: string }> }>();
  for (const a of assignments ?? []) {
    const profilesRaw = a.profiles as unknown;
    const customersRaw = a.customers as unknown;
    const driver = (Array.isArray(profilesRaw) ? profilesRaw[0] : profilesRaw) as { full_name: string } | null;
    const customer = (Array.isArray(customersRaw) ? customersRaw[0] : customersRaw) as { id: string; customer_type: string; first_name: string | null; last_name: string | null; business_name: string | null } | null;
    if (!driver || !customer) continue;

    if (!byDriver.has(a.driver_id)) {
      byDriver.set(a.driver_id, { driverName: driver.full_name, customers: [] });
    }
    byDriver.get(a.driver_id)!.customers.push({
      customerId: customer.id,
      name: getCustomerName(customer as Pick<Customer, 'customer_type' | 'business_name' | 'first_name' | 'last_name'>),
      phone: '',
    });
  }

  // Customers not yet assigned to selected driver (for modal)
  const assignedCustomerIds = new Set(
    (assignments ?? [])
      .filter((a) => a.driver_id === selectedDriverId)
      .map((a) => a.customer_id)
  );
  const availableCustomers = (customers ?? []).filter(
    (c) => c.is_active && !assignedCustomerIds.has(c.id)
  );

  function openModal(driverId = '') {
    setSelectedDriverId(driverId);
    setSelectedCustomerId('');
    setModalOpen(true);
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDriverId || !selectedCustomerId) return;
    try {
      await assignCustomer.mutateAsync({
        driver_id: selectedDriverId,
        customer_id: selectedCustomerId,
        assigned_by: profile?.id ?? '',
      });
      toast.success('Cliente asignado correctamente');
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al asignar');
    }
  }

  async function handleUnassign() {
    if (!confirmUnassign) return;
    try {
      await unassignCustomer.mutateAsync({
        driver_id: confirmUnassign.driverId,
        customer_id: confirmUnassign.customerId,
      });
      toast.success('Asignación eliminada');
    } catch {
      toast.error('Error al quitar la asignación');
    }
    setConfirmUnassign(null);
  }

  const driverOptions = drivers.map((d) => ({ value: d.id, label: d.full_name }));
  const customerOptions = availableCustomers.map((c) => ({
    value: c.id,
    label: getCustomerName(c),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asignaciones</h1>
          <p className="text-sm text-gray-500 mt-0.5">Asigna clientes a los choferes</p>
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 text-sm text-gray-500">
          No hay choferes activos registrados.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drivers.map((driver) => {
            const entry = byDriver.get(driver.id);
            const count = entry?.customers.length ?? 0;
            const isExpanded = expandedDriverId === driver.id;
            return (
              <div key={driver.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Driver header — clickable to expand */}
                <button
                  type="button"
                  className="w-full px-4 py-3 flex items-center justify-between gap-2 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpandedDriverId(isExpanded ? null : driver.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-xs flex-shrink-0">
                      {driver.full_name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{driver.full_name}</p>
                      <p className="text-xs text-gray-500">{count} cliente{count !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Collapsible customer list */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <div className="px-4 py-2 flex justify-end border-b border-gray-50">
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openModal(driver.id); }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Asignar cliente
                      </Button>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {count === 0 ? (
                        <p className="px-4 py-4 text-xs text-gray-400 text-center">Sin clientes asignados</p>
                      ) : (
                        entry!.customers.map((ac) => {
                          const full = (customers ?? []).find((c) => c.id === ac.customerId);
                          return (
                            <div key={ac.customerId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm text-gray-800 font-medium truncate">{ac.name}</p>
                                {full && <p className="text-xs text-gray-500 truncate">{full.phone}</p>}
                              </div>
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                {full && (
                                  <Badge variant={full.customer_type === 'empresa' ? 'blue' : 'yellow'}>
                                    {full.customer_type === 'empresa' ? 'Empresa' : 'Persona'}
                                  </Badge>
                                )}
                                <button
                                  onClick={() =>
                                    setConfirmUnassign({
                                      driverId: driver.id,
                                      customerId: ac.customerId,
                                      label: `${ac.name} de ${driver.full_name}`,
                                    })
                                  }
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

      {/* Modal nueva asignación */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Asignar cliente a chofer"
      >
        <form onSubmit={handleAssign} className="space-y-4">
          <Select
            label="Chofer"
            required
            value={selectedDriverId}
            onChange={(e) => { setSelectedDriverId(e.target.value); setSelectedCustomerId(''); }}
            options={driverOptions}
            placeholder="Selecciona un chofer"
          />
          <Select
            label="Cliente"
            required
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            options={customerOptions}
            placeholder={selectedDriverId ? 'Selecciona un cliente' : 'Primero selecciona un chofer'}
            disabled={!selectedDriverId}
          />
          {selectedDriverId && customerOptions.length === 0 && (
            <p className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg">
              Este chofer tiene todos los clientes asignados.
            </p>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={assignCustomer.isPending}
              className="flex-1"
              disabled={!selectedDriverId || !selectedCustomerId}
            >
              Asignar
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmar quitar asignación */}
      <ConfirmDialog
        isOpen={!!confirmUnassign}
        onClose={() => setConfirmUnassign(null)}
        onConfirm={handleUnassign}
        isLoading={unassignCustomer.isPending}
        title="Quitar asignación"
        message={`¿Quitar a ${confirmUnassign?.label}?`}
      />
    </div>
  );
}
