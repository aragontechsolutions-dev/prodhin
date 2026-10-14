import { useState } from 'react';
import { toast } from 'sonner';
import { useRouteStops, useAddRouteStop, useRemoveRouteStop, useAddRouteStopsBulk } from '../../../hooks/useRoutes';
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
  const addBulk = useAddRouteStopsBulk();

  const [activeDay, setActiveDay] = useState<number>(activeDays[0] ?? 1);
  const [search, setSearch] = useState('');
  const [onlyInRoute, setOnlyInRoute] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

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
  // customer_id -> stop.id (para quitar con un toque)
  const stopIdByCustomer = new Map(dayStops.map((s) => [s.customer_id, s.id]));

  const searchLower = search.toLowerCase();
  const listCustomers = activeCustomers
    .filter((c) => {
      if (onlyInRoute && !dayStopCustomerIds.has(c.id)) return false;
      if (!search) return true;
      const name = getCustomerName(c).toLowerCase();
      const tax = (c.tax_id ?? '').toLowerCase();
      return name.includes(searchLower) || tax.includes(searchLower);
    })
    .sort((a, b) => {
      // Primero los que están en ruta, luego alfabético
      const ai = dayStopCustomerIds.has(a.id) ? 0 : 1;
      const bi = dayStopCustomerIds.has(b.id) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return getCustomerName(a).localeCompare(getCustomerName(b));
    });

  async function toggle(c: Customer) {
    const stopId = stopIdByCustomer.get(c.id);
    if (stopId) {
      try {
        await removeStop.mutateAsync({ id: stopId, route_id: route.id });
      } catch {
        toast.error('Error al quitar el cliente');
      }
    } else {
      try {
        await addStop.mutateAsync({ route_id: route.id, customer_id: c.id, day_of_week: activeDay });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        toast.error(msg.includes('unique') ? 'Ya está en la ruta ese día' : 'Error al agregar');
      }
    }
  }

  async function copyFromDay(sourceDay: number) {
    setCopyOpen(false);
    const sourceIds = (stops ?? [])
      .filter((s) => s.day_of_week === sourceDay)
      .map((s) => s.customer_id)
      // solo clientes válidos del chofer y que no estén ya en el día actual
      .filter((id) => driverCustomerIds.has(id) && !dayStopCustomerIds.has(id));
    if (sourceIds.length === 0) {
      toast.info('No hay clientes nuevos para copiar de ese día');
      return;
    }
    try {
      await addBulk.mutateAsync({ route_id: route.id, day_of_week: activeDay, customer_ids: sourceIds });
      toast.success(`${sourceIds.length} cliente${sourceIds.length > 1 ? 's' : ''} copiado${sourceIds.length > 1 ? 's' : ''} a ${DAY_LABELS[activeDay]}`);
    } catch {
      toast.error('Error al copiar el día');
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
      <div className="flex flex-wrap gap-1.5 px-4 pt-3 pb-0">
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

      {/* Toolbar: contador + copiar día + filtro + buscador */}
      <div className="px-4 pt-3 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            {dayStops.length} en ruta · {DAY_LABELS[activeDay]}
          </p>
          <div className="relative">
            <button
              onClick={() => setCopyOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar día
            </button>
            {copyOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setCopyOpen(false)} />
                <div className="absolute right-0 mt-1 z-20 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg py-1">
                  <p className="px-3 py-1.5 text-[11px] text-gray-400 uppercase tracking-wide">Copiar clientes de:</p>
                  {activeDays.filter((d) => d !== activeDay).map((d) => {
                    const cnt = (stops ?? []).filter((s) => s.day_of_week === d).length;
                    return (
                      <button
                        key={d}
                        onClick={() => copyFromDay(d)}
                        disabled={cnt === 0 || addBulk.isPending}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
                      >
                        <span>{DAY_LABELS[d]}</span>
                        <span className="text-xs text-gray-400">{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <input
          type="text"
          placeholder="Buscar por nombre o RUT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />

        <div className="flex gap-1.5">
          <button
            onClick={() => setOnlyInRoute(false)}
            className={`text-xs font-semibold px-3 py-1 rounded-full transition ${!onlyInRoute ? 'bg-primary-500 text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
          >
            Todos
          </button>
          <button
            onClick={() => setOnlyInRoute(true)}
            className={`text-xs font-semibold px-3 py-1 rounded-full transition ${onlyInRoute ? 'bg-primary-500 text-gray-900' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}
          >
            Solo en ruta
          </button>
        </div>
      </div>

      {/* Lista única: tocar para agregar/quitar del día */}
      <div className="border-t border-gray-100 dark:border-gray-800 min-h-[280px]">
        {stopsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : listCustomers.length === 0 ? (
          <div className="flex items-center justify-center py-16 px-4 text-center">
            <p className="text-sm text-gray-400 dark:text-gray-600">
              {search ? 'Sin resultados' : onlyInRoute ? 'Sin clientes en la ruta de este día' : 'No hay clientes asignados a este chofer'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-[26rem] overflow-y-auto">
            {listCustomers.map((c) => {
              const inRoute = dayStopCustomerIds.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c)}
                  disabled={addStop.isPending || removeStop.isPending}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition disabled:opacity-60"
                >
                  {/* Check */}
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${inRoute ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'}`}>
                    {inRoute && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${inRoute ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}>
                      {getCustomerName(c)}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{c.address}</p>
                  </div>
                  {inRoute && (
                    <span className="flex-shrink-0 text-[10px] font-bold text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                      EN RUTA
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
