import { useState } from 'react';
import { toast } from 'sonner';
import { useRouteStops, useAddRouteStop, useRemoveRouteStop } from '../../../hooks/useRoutes';
import { useCustomers, useDriverCustomers } from '../../../hooks/useCustomers';
import type { RouteWithDriver } from '../../../hooks/useRoutes';
import type { Customer } from '@prodhin/shared';

const DAY_LABELS: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

function getCustomerName(c: Pick<Customer, 'customer_type' | 'business_name' | 'first_name' | 'last_name'>): string {
  return c.customer_type === 'empresa'
    ? (c.business_name ?? 'Sin nombre')
    : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Sin nombre';
}

interface Props {
  route: RouteWithDriver;
  activeDays: number[];
}

export default function RouteDetailPanel({ route, activeDays }: Props) {
  const { data: stops, isLoading: stopsLoading } = useRouteStops(route.id);
  const { data: customers } = useCustomers();
  const { data: assignments } = useDriverCustomers();
  const addStop = useAddRouteStop();
  const removeStop = useRemoveRouteStop();

  const [activeDay, setActiveDay] = useState<number>(activeDays[0] ?? 1);
  const [search, setSearch] = useState('');

  // Only customers assigned to this route's driver
  const driverCustomerIds = new Set(
    (assignments ?? [])
      .filter((a) => {
        const d = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
        return (d as { full_name: string } | null) !== null && a.driver_id === route.driver_id;
      })
      .map((a) => a.customer_id),
  );

  const activeCustomers = (customers ?? []).filter((c) => c.is_active && driverCustomerIds.has(c.id));
  const dayStops = (stops ?? []).filter((s) => s.day_of_week === activeDay);
  const dayStopCustomerIds = new Set(dayStops.map((s) => s.customer_id));

  const searchLower = search.toLowerCase();
  const filteredCustomers = activeCustomers.filter((c) => {
    if (dayStopCustomerIds.has(c.id)) return false;
    if (!search) return true;
    const name = getCustomerName(c).toLowerCase();
    const tax = (c.tax_id ?? '').toLowerCase();
    return name.includes(searchLower) || tax.includes(searchLower);
  });

  async function handleAdd(customerId: string) {
    try {
      await addStop.mutateAsync({ route_id: route.id, customer_id: customerId, day_of_week: activeDay });
      toast.success('Cliente agregado a la ruta');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(msg.includes('unique') ? 'Este cliente ya está en esta ruta para ese día' : 'Error al agregar');
    }
  }

  async function handleRemove(stopId: string) {
    try {
      await removeStop.mutateAsync({ id: stopId, route_id: route.id });
      toast.success('Cliente quitado de la ruta');
    } catch {
      toast.error('Error al quitar el cliente');
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="font-bold text-gray-900 dark:text-gray-100">{route.name}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {route.driver_name ?? 'Sin chofer asignado'}
        </p>
      </div>

      {/* Day tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-0 overflow-x-auto">
        {activeDays.map((d) => {
          const count = (stops ?? []).filter((s) => s.day_of_week === d).length;
          return (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeDay === d
                  ? 'bg-primary-500 text-gray-900'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {DAY_LABELS[d]}
              {count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeDay === d ? 'bg-gray-900/20 text-gray-900' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-0 divide-x divide-gray-100 dark:divide-gray-800 mt-3">
        {/* Left: customers in route for this day */}
        <div className="min-h-[300px] flex flex-col">
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            En ruta — {DAY_LABELS[activeDay]}
          </p>
          {stopsLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : dayStops.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-4 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-600">Sin clientes para este día.<br />Agrega desde la lista →</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {dayStops.map((stop) => {
                const c = activeCustomers.find((x) => x.id === stop.customer_id);
                if (!c) return null;
                return (
                  <div key={stop.id} className="px-4 py-2.5 flex items-center justify-between gap-2 group">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{getCustomerName(c)}</p>
                      <p className="text-xs text-gray-400 truncate">{c.address}</p>
                    </div>
                    <button
                      onClick={() => handleRemove(stop.id)}
                      className="p-1 text-gray-300 hover:text-red-500 transition rounded flex-shrink-0"
                      title="Quitar de la ruta"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: available customers to add */}
        <div className="min-h-[300px] flex flex-col">
          <div className="px-4 py-2">
            <input
              type="text"
              placeholder="Buscar por nombre o RUT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800 overflow-y-auto max-h-80">
            {filteredCustomers.length === 0 ? (
              <div className="flex items-center justify-center py-8 px-4 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-600">
                  {search ? 'Sin resultados' : 'Todos los clientes ya están en esta ruta'}
                </p>
              </div>
            ) : (
              filteredCustomers.slice(0, 50).map((c) => (
                <div key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{getCustomerName(c)}</p>
                    <p className="text-xs text-gray-400 truncate">{c.address}</p>
                  </div>
                  <button
                    onClick={() => handleAdd(c.id)}
                    className="p-1 text-gray-300 hover:text-primary-600 transition rounded flex-shrink-0"
                    title="Agregar a la ruta"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
