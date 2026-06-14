import { useState, lazy, Suspense } from 'react';
import { useCustomers, useDeleteCustomer } from '../../../hooks/useCustomers';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Modal from '../../../components/ui/Modal';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import Pagination from '../../../components/ui/Pagination';
import { usePagination } from '../../../hooks/usePagination';
import type { Customer } from '@prodhin/shared';
import CustomerForm from './CustomerForm';

const CustomerMapView = lazy(() => import('./CustomerMapView'));

type ViewMode = 'list' | 'map';

export function getDisplayName(c: Customer): string {
  return c.customer_type === 'empresa'
    ? (c.business_name ?? 'Sin nombre')
    : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Sin nombre';
}

export default function CustomersPage() {
  const { data: customers, isLoading } = useCustomers();
  const deleteCustomer = useDeleteCustomer();
  const { profile } = useAuth();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [confirmCustomer, setConfirmCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState('');

  const filtered = (customers ?? []).filter((c) => {
    const name = getDisplayName(c).toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || c.address.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const { paginated, page, totalPages, pageSize, changePage, changePageSize } = usePagination(filtered);

  function openCreate() {
    setEditingCustomer(null);
    setFormOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditingCustomer(customer);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!confirmCustomer) return;
    await deleteCustomer.mutateAsync(confirmCustomer.id);
    setConfirmCustomer(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {customers?.length ?? 0} clientes registrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle vista */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                viewMode === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              Mapa
            </button>
          </div>
          <Button onClick={openCreate}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo cliente
          </Button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nombre, dirección o teléfono..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); changePage(1); }}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
        />
      </div>

      {/* Vista mapa */}
      {viewMode === 'map' && (
        <Suspense fallback={<div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />}>
          <CustomerMapView customers={filtered} onEdit={openEdit} />
        </Suspense>
      )}

      {/* Vista lista */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !filtered.length ? (
            <div className="text-center py-16 text-gray-500 text-sm">
              {search ? 'Sin resultados para la búsqueda.' : 'No hay clientes registrados aún.'}
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Cliente</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Tipo</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Teléfono</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Dirección</th>
                      <th className="text-left px-5 py-3 font-medium text-gray-600">Estado</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paginated.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50 transition">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-gray-900">{getDisplayName(c)}</p>
                          {c.contact_name && (
                            <p className="text-xs text-gray-500">Contacto: {c.contact_name}</p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={c.customer_type === 'empresa' ? 'blue' : 'yellow'}>
                            {c.customer_type === 'empresa' ? 'Empresa' : 'Persona'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">{c.phone}</td>
                        <td className="px-5 py-3.5 text-gray-600 max-w-xs truncate">{c.address}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant={c.is_active ? 'green' : 'red'}>
                            {c.is_active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => setConfirmCustomer(c)}
                            >
                              {c.is_active ? 'Desactivar' : 'Activar'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {paginated.map((c) => (
                  <div key={c.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{getDisplayName(c)}</p>
                        <p className="text-xs text-gray-500">{c.address}</p>
                        <p className="text-xs text-gray-500">{c.phone}</p>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Badge variant={c.customer_type === 'empresa' ? 'blue' : 'yellow'}>
                          {c.customer_type === 'empresa' ? 'Empresa' : 'Persona'}
                        </Badge>
                        <Badge variant={c.is_active ? 'green' : 'red'}>
                          {c.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)} className="flex-1">
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setConfirmCustomer(c)}
                        className="flex-1"
                      >
                        {c.is_active ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                pageSize={pageSize}
                total={filtered.length}
                onPageChange={changePage}
                onPageSizeChange={changePageSize}
              />
            </>
          )}
        </div>
      )}

      {/* Modal formulario cliente */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCustomer ? 'Editar cliente' : 'Nuevo cliente'}
        size="xl"
      >
        <CustomerForm
          customer={editingCustomer}
          userId={profile?.id ?? ''}
          onSuccess={() => setFormOpen(false)}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      {/* Confirmar desactivar */}
      <ConfirmDialog
        isOpen={!!confirmCustomer}
        onClose={() => setConfirmCustomer(null)}
        onConfirm={handleDelete}
        isLoading={deleteCustomer.isPending}
        title={confirmCustomer?.is_active ? 'Desactivar cliente' : 'Activar cliente'}
        message={`¿${confirmCustomer?.is_active ? 'Desactivar' : 'Activar'} a ${getDisplayName(confirmCustomer ?? {} as Customer)}?`}
      />
    </div>
  );
}
