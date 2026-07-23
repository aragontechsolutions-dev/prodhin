import { useMemo, useState } from 'react';
import { useUsers } from '../../../hooks/useUsers';
import { useEggTypes } from '../../../hooks/useEggTypes';
import {
  useDeliveries,
  formatCajones,
  DELIVERY_STATUS_LABEL,
  type DeliveryFilters,
  type DeliveryRow,
} from '../../../hooks/useDeliveries';
import { usePagination, PAGE_SIZE_OPTIONS } from '../../../hooks/usePagination';
import { useBoxBalances } from '../../../hooks/useBoxBalances';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import EditDeliveryModal from './EditDeliveryModal';

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

const TODAY = new Date();
const THIRTY_AGO = new Date(TODAY.getTime() - 29 * 24 * 60 * 60 * 1000);

function StatCard({
  label, value, sub, colorBg, colorText, icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  colorBg: string;
  colorText: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
          <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{value}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorBg}`}>
          <span className={colorText}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
}

function itemsSummary(row: DeliveryRow): string {
  if (row.items.length === 0) return '—';
  return row.items
    .map((it) => `${it.egg_type_name ?? '¿?'} (${formatCajones(it.cajas_plasticas)} cj)`)
    .join(', ');
}

export default function ReportsPage() {
  const [from, setFrom] = useState(isoDate(THIRTY_AGO));
  const [to, setTo] = useState(isoDate(TODAY));
  const [driverId, setDriverId] = useState('');
  const [eggTypeId, setEggTypeId] = useState('');
  const [editing, setEditing] = useState<DeliveryRow | null>(null);

  const { data: users } = useUsers();
  const { data: eggTypes } = useEggTypes();
  const { data: boxBalances } = useBoxBalances();

  // Total de cajas plásticas actualmente en los locales (saldo global)
  const boxesInLocals = useMemo(() => {
    let t = 0;
    for (const v of boxBalances?.values() ?? []) t += Math.max(0, v);
    return t;
  }, [boxBalances]);

  const filters: DeliveryFilters = useMemo(
    () => ({ from, to, driverId: driverId || undefined, eggTypeId: eggTypeId || undefined }),
    [from, to, driverId, eggTypeId],
  );
  const { data: deliveries, isLoading, isError, error } = useDeliveries(filters);

  const rows = deliveries ?? [];

  const choferes = (users ?? []).filter((u) => u.role === 'chofer');

  // Métricas
  const metrics = useMemo(() => {
    const entregadas = rows.filter((r) => r.status === 'entregado');
    const totalCajasPlasticas = rows.reduce((s, r) => s + r.total_cajas_plasticas, 0);
    const clientes = new Set(rows.map((r) => r.customer_id)).size;
    const sinVenta = rows.filter((r) => r.status !== 'entregado').length;
    return {
      totalVisitas: rows.length,
      entregadas: entregadas.length,
      totalCajasPlasticas,
      clientes,
      sinVenta,
    };
  }, [rows]);

  // Desglose por tipo de huevo
  const byEggType = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null; cajasPlasticas: number; visitas: number }>();
    for (const r of rows) {
      for (const it of r.items) {
        const key = it.egg_type_id;
        const prev = map.get(key) ?? {
          name: it.egg_type_name ?? '¿?',
          color: it.egg_type_color,
          cajasPlasticas: 0,
          visitas: 0,
        };
        prev.cajasPlasticas += it.cajas_plasticas;
        prev.visitas += 1;
        map.set(key, prev);
      }
    }
    return [...map.values()].sort((a, b) => b.cajasPlasticas - a.cajasPlasticas);
  }, [rows]);

  // Clientes que más compran (por cajas plásticas entregadas en el período)
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; cajas: number; entregas: number }>();
    for (const r of rows) {
      if (r.status !== 'entregado') continue;
      const prev = map.get(r.customer_id) ?? { name: r.customer_name, cajas: 0, entregas: 0 };
      prev.cajas += r.total_cajas_plasticas;
      prev.entregas += 1;
      map.set(r.customer_id, prev);
    }
    return [...map.values()].sort((a, b) => b.cajas - a.cajas).slice(0, 8);
  }, [rows]);

  const maxEgg = byEggType[0]?.cajasPlasticas || 1;
  const maxCust = topCustomers[0]?.cajas || 1;

  const { paginated, page, totalPages, pageSize, changePage, changePageSize } = usePagination(rows, 20);

  function exportCsv() {
    const header = ['Fecha', 'Cliente', 'Chofer', 'Estado', 'Detalle', 'Cajones', 'Notas'];
    const lines = rows.map((r) => [
      fmtDateTime(r.delivered_at),
      r.customer_name,
      r.driver_name,
      DELIVERY_STATUS_LABEL[r.status],
      itemsSummary(r).replace(/"/g, "'"),
      formatCajones(r.total_cajas_plasticas),
      (r.notes ?? '').replace(/"/g, "'").replace(/\n/g, ' '),
    ]);
    const csv = [header, ...lines]
      .map((cols) => cols.map((c) => `"${c}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entregas_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Reportes de entregas</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Huevos entregados por chofer y cliente</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Input label="Desde" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <Input label="Hasta" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        <Select
          label="Chofer"
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
          placeholder="Todos los choferes"
          options={choferes.map((c) => ({ value: c.id, label: c.full_name }))}
        />
        <Select
          label="Tipo de huevo"
          value={eggTypeId}
          onChange={(e) => setEggTypeId(e.target.value)}
          placeholder="Todos los tipos"
          options={(eggTypes ?? []).map((t) => ({ value: t.id, label: t.name }))}
        />
      </div>

      {isError ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5 text-sm text-red-700 dark:text-red-300">
          Error al cargar las entregas: {(error as Error)?.message}
        </div>
      ) : (
        <>
          {/* Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <StatCard label="Cajones entregados" value={formatCajones(metrics.totalCajasPlasticas)}
              colorBg="bg-amber-50 dark:bg-amber-900/30" colorText="text-amber-600 dark:text-amber-400"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
            />
            <StatCard label="Visitas" value={metrics.totalVisitas} sub={`${metrics.entregadas} con entrega`}
              colorBg="bg-blue-50 dark:bg-blue-900/30" colorText="text-blue-600 dark:text-blue-400"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
            />
            <StatCard label="Clientes atendidos" value={metrics.clientes}
              colorBg="bg-green-50 dark:bg-green-900/30" colorText="text-green-600 dark:text-green-400"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
            <StatCard label="Sin venta" value={metrics.sinVenta} sub="ausente / rechazo / sin stock"
              colorBg="bg-gray-50 dark:bg-gray-800" colorText="text-gray-400 dark:text-gray-500"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
            />
            <StatCard label="Tipos distintos" value={byEggType.length}
              colorBg="bg-orange-50 dark:bg-orange-900/30" colorText="text-orange-600 dark:text-orange-400"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" /></svg>}
            />
            <StatCard label="Cajas en locales" value={boxesInLocals} sub="prestadas, sin recoger"
              colorBg="bg-teal-50 dark:bg-teal-900/30" colorText="text-teal-600 dark:text-teal-400"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
            />
          </div>

          {/* Analítica: rankings */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Huevos más vendidos */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">🥚 Más vendidos por tipo</h2>
              </div>
              {byEggType.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin entregas en el período</p>
              ) : (
                <div className="p-4 space-y-3">
                  {byEggType.map((t) => (
                    <div key={t.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.color === 'rojo' ? 'bg-red-500' : t.color === 'blanco' ? 'bg-gray-300' : 'bg-amber-400'}`} />
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{t.name}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap ml-2">
                          {formatCajones(t.cajasPlasticas)} cj <span className="text-xs font-normal text-gray-400">· {t.visitas} ent.</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full bg-primary-500" style={{ width: `${Math.round((t.cajasPlasticas / maxEgg) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clientes que más compran */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">🏆 Clientes que más compran</h2>
              </div>
              {topCustomers.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">Sin entregas en el período</p>
              ) : (
                <div className="p-4 space-y-3">
                  {topCustomers.map((c, i) => (
                    <div key={c.name + i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          <span className="text-gray-400 mr-1">{i + 1}.</span>{c.name}
                        </span>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap ml-2">
                          {formatCajones(c.cajas)} cj <span className="text-xs font-normal text-gray-400">· {c.entregas} ent.</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.round((c.cajas / maxCust) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Tabla de entregas */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Detalle de entregas</h2>
              <span className="text-xs text-gray-400">{rows.length} registros</span>
            </div>

            {isLoading ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Cargando…</p>
            ) : rows.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">No hay entregas para los filtros seleccionados</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                        <th className="px-5 py-3 font-medium">Fecha</th>
                        <th className="px-5 py-3 font-medium">Cliente</th>
                        <th className="px-5 py-3 font-medium">Chofer</th>
                        <th className="px-5 py-3 font-medium">Estado</th>
                        <th className="px-5 py-3 font-medium">Detalle</th>
                        <th className="px-5 py-3 font-medium text-right">Cajones</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {paginated.map((r) => (
                        <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-5 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">{fmtDateTime(r.delivered_at)}</td>
                          <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{r.customer_name}</td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{r.driver_name}</td>
                          <td className="px-5 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              r.status === 'entregado'
                                ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30'
                                : 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800'
                            }`}>
                              {DELIVERY_STATUS_LABEL[r.status]}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{itemsSummary(r)}</td>
                          <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                            {r.status === 'entregado' ? formatCajones(r.total_cajas_plasticas) : '—'}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <button
                              onClick={() => setEditing(r)}
                              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              Corregir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Paginación */}
                <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>Filas por página:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => changePageSize(Number(e.target.value) as typeof pageSize)}
                      className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-gray-100"
                    >
                      {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changePage(page - 1)}
                      disabled={page <= 1}
                      className="px-3 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200"
                    >Anterior</button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Página {page} de {totalPages}</span>
                    <button
                      onClick={() => changePage(page + 1)}
                      disabled={page >= totalPages}
                      className="px-3 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200"
                    >Siguiente</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <EditDeliveryModal delivery={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
