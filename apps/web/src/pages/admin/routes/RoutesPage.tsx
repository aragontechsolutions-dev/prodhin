import { useState } from 'react';
import { toast } from 'sonner';
import { useRoutes, useCreateRoute, useUpdateRoute, useDeleteRoute } from '../../../hooks/useRoutes';
import { useUsers } from '../../../hooks/useUsers';
import { useAuth } from '../../../hooks/useAuth';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import RouteDetailPanel from './RouteDetailPanel';

const DAY_LABELS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function isSummerSeason(): boolean {
  const m = new Date().getMonth() + 1; // 1-12
  return m >= 11 || m <= 2;
}

export default function RoutesPage() {
  const { data: routes, isLoading } = useRoutes();
  const { data: users } = useUsers();
  const createRoute = useCreateRoute();
  const updateRoute = useUpdateRoute();
  const deleteRoute = useDeleteRoute();
  const { profile } = useAuth();

  const [modalOpen, setModalOpen] = useState(false);
  const [editRoute, setEditRoute] = useState<{ id: string; name: string; driver_id: string | null } | null>(null);
  const [name, setName] = useState('');
  const [driverId, setDriverId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const drivers = (users ?? []).filter((u) => u.role === 'chofer' && u.is_active);
  const summer = isSummerSeason();
  const activeDays = summer ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const selectedRoute = (routes ?? []).find((r) => r.id === selectedRouteId) ?? null;

  function openCreate() {
    setEditRoute(null);
    setName('');
    setDriverId('');
    setModalOpen(true);
  }

  function openEdit(r: { id: string; name: string; driver_id: string | null }) {
    setEditRoute(r);
    setName(r.name);
    setDriverId(r.driver_id ?? '');
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (editRoute) {
        await updateRoute.mutateAsync({ id: editRoute.id, data: { name: name.trim(), driver_id: driverId || null } });
        toast.success('Ruta actualizada');
      } else {
        await createRoute.mutateAsync({ name: name.trim(), driver_id: driverId || null, created_by: profile?.id ?? '' });
        toast.success('Ruta creada');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteRoute.mutateAsync(confirmDelete.id);
      toast.success('Ruta eliminada');
      if (selectedRouteId === confirmDelete.id) setSelectedRouteId(null);
    } catch {
      toast.error('Error al eliminar la ruta');
    }
    setConfirmDelete(null);
  }

  async function handleToggleActive(id: string, current: boolean) {
    try {
      await updateRoute.mutateAsync({ id, data: { is_active: !current } });
      toast.success(!current ? 'Ruta activada' : 'Ruta desactivada');
    } catch {
      toast.error('Error al cambiar estado');
    }
  }

  const driverOptions = drivers.map((d) => ({ value: d.id, label: d.full_name }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Rutas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Gestiona las rutas de reparto por día · temporada {summer ? 'verano (Lun–Sáb)' : 'normal (Lun–Vie)'}
          </p>
        </div>
        <Button onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva ruta
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (routes ?? []).length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm text-center py-16 text-sm text-gray-500 dark:text-gray-400">
          No hay rutas creadas aún.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          {/* Route list */}
          <div className="space-y-3">
            {(routes ?? []).map((route) => {
              const isSelected = selectedRouteId === route.id;
              return (
                <div
                  key={route.id}
                  className={`bg-white dark:bg-gray-900 rounded-2xl border shadow-sm overflow-hidden transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-primary-400 ring-2 ring-primary-200 dark:ring-primary-800'
                      : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                  }`}
                  onClick={() => setSelectedRouteId(isSelected ? null : route.id)}
                >
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${route.is_active ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className={`font-semibold text-sm truncate ${route.is_active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-600'}`}>
                          {route.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {route.driver_name ?? <span className="italic">Sin chofer asignado</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Day pills */}
                      <div className="hidden sm:flex gap-0.5">
                        {activeDays.map((d) => (
                          <span key={d} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            {DAY_LABELS[d]}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(route); }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded transition"
                        title="Editar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleActive(route.id, route.is_active); }}
                        className={`p-1.5 rounded transition ${route.is_active ? 'text-green-500 hover:text-green-700' : 'text-gray-300 hover:text-green-500'}`}
                        title={route.is_active ? 'Desactivar' : 'Activar'}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="6" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDelete({ id: route.id, name: route.name }); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded transition"
                        title="Eliminar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Route detail panel */}
          <div>
            {selectedRoute ? (
              <RouteDetailPanel route={selectedRoute} activeDays={activeDays} />
            ) : (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center py-20 text-sm text-gray-400 dark:text-gray-600">
                Selecciona una ruta para ver y editar sus paradas
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editRoute ? 'Editar ruta' : 'Nueva ruta'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre de la ruta"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Ruta Norte"
          />
          <Select
            label="Chofer asignado"
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            options={driverOptions}
            placeholder="Sin chofer (asignar después)"
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" isLoading={createRoute.isPending || updateRoute.isPending} className="flex-1">
              {editRoute ? 'Guardar' : 'Crear ruta'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        isLoading={deleteRoute.isPending}
        title="Eliminar ruta"
        message={`¿Eliminar la ruta "${confirmDelete?.name}"? Se eliminarán todas sus paradas.`}
      />
    </div>
  );
}
