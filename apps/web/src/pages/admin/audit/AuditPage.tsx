import { useMemo, useState } from 'react';
import { useAuditLog, TABLE_LABELS, type AuditRow } from '../../../hooks/useAuditLog';
import { useUsers } from '../../../hooks/useUsers';
import { useCustomers } from '../../../hooks/useCustomers';
import { useEggTypes } from '../../../hooks/useEggTypes';
import { useRoutes } from '../../../hooks/useRoutes';
import { PAGE_SIZE_OPTIONS, type PageSize } from '../../../hooks/usePagination';

const ACTION_LABEL: Record<string, string> = { INSERT: 'Creó', UPDATE: 'Editó', DELETE: 'Borró' };
const ACTION_STYLE: Record<string, string> = {
  INSERT: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
  UPDATE: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
  DELETE: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
};

// Campos internos que no aportan a un lector no técnico
const HIDDEN = new Set(['id', 'created_at', 'updated_at', 'edit_reason', 'avatar_url', 'delivery_id']);

const FIELD_LABELS: Record<string, string> = {
  egg_type_id: 'Categoría', customer_id: 'Cliente', driver_id: 'Chofer',
  cajas_plasticas: 'Cajas plásticas', status: 'Estado', mode: 'Modo',
  cajas_recogidas: 'Cajas recogidas', cajas_devueltas: 'Cajas devueltas en el acto', notes: 'Notas', is_primary: 'Principal',
  name: 'Nombre', color: 'Color', sort_order: 'Orden', is_active: 'Activo',
  full_name: 'Nombre', role: 'Rol', phone: 'Teléfono', email: 'Email',
  address: 'Dirección', business_name: 'Razón social', tax_id: 'RUT',
  first_name: 'Nombre', last_name: 'Apellido', contact_name: 'Contacto',
  customer_type: 'Tipo de cliente', day_of_week: 'Día', route_id: 'Ruta',
  counted_at: 'Fecha del recuento', delivered_at: 'Fecha de entrega',
  from_driver_id: 'Chofer ausente', to_driver_id: 'Chofer que cubre',
  start_date: 'Desde', end_date: 'Hasta', assigned_by: 'Asignado por',
  created_by: 'Creado por', must_change_password: 'Cambio de contraseña pendiente',
  preferred_egg_type_id: 'Categoría preferida', note: 'Nota',
  load_created_at: 'Carga del', has_discrepancy: 'Con diferencias',
  details: 'Detalle (asignado/real)', confirmed_at: 'Confirmado',
  declared_qty: 'Maples declarados', approved_qty: 'Maples aprobados',
  driver_note: 'Nota del chofer', review_note: 'Nota del admin',
  reviewed_by: 'Revisado por', reviewed_at: 'Revisado',
  broken_qty: 'Rotos declarados', broken_returned: 'Rotos devueltos',
  qty: 'Cantidad', expiry_date: 'Vence (envase)',
  returned_qty: 'Devuelto', returned_expiry_date: 'Vence (devuelto)',
  eggs_per_package: 'Huevos por paquete', packages_per_box: 'Paquetes por caja',
  lat: 'Latitud', lng: 'Longitud', radius_m: 'Radio (m)',
  has_competition: 'Tiene competencia', format: 'Formato', price: 'Precio',
  photo_path: 'Foto', converted_customer_id: 'Cliente convertido',
};

const STATUS_LABEL: Record<string, string> = {
  entregado: 'Entregado', cliente_ausente: 'Cliente ausente', rechazado: 'No quiso', sin_stock: 'Sin stock',
};
const DAYS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
}

export default function AuditPage() {
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);

  const { data, isLoading } = useAuditLog({
    table: table || undefined,
    action: action || undefined,
    actorId: actorId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
    pageSize,
  });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const { data: users } = useUsers();
  const { data: customers } = useCustomers();
  const { data: eggTypes } = useEggTypes();
  const { data: routes } = useRoutes();

  const routeName = useMemo(() => {
    const m = new Map<string, string>();
    (routes ?? []).forEach((r) => m.set(r.id, r.name));
    return m;
  }, [routes]);

  const userName = useMemo(() => { const m = new Map<string, string>(); (users ?? []).forEach((u) => m.set(u.id, u.full_name)); return m; }, [users]);
  const eggName = useMemo(() => { const m = new Map<string, string>(); (eggTypes ?? []).forEach((t) => m.set(t.id, t.name)); return m; }, [eggTypes]);
  const custName = useMemo(() => {
    const m = new Map<string, string>();
    (customers ?? []).forEach((c) => {
      const n = c.customer_type === 'empresa' ? (c.business_name ?? 'Sin nombre')
        : `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Sin nombre';
      m.set(c.id, n);
    });
    return m;
  }, [customers]);

  function resolve(key: string, val: unknown): string {
    if (val === null || val === undefined || val === '') return '—';
    if (key === 'egg_type_id' || key === 'preferred_egg_type_id') return eggName.get(String(val)) ?? 'categoría';
    if (key === 'customer_id' || key === 'converted_customer_id') return custName.get(String(val)) ?? 'cliente';
    if (['driver_id', 'from_driver_id', 'to_driver_id', 'assigned_by', 'created_by', 'reviewed_by'].includes(key)) return userName.get(String(val)) ?? 'usuario';
    if (key === 'route_id') return routeName.get(String(val)) ?? 'ruta';
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    if (key === 'status') return STATUS_LABEL[String(val)] ?? String(val);
    if (key === 'mode') return val === 'cp' ? 'Deja cajas plásticas' : 'En cartones';
    if (key === 'day_of_week') return DAYS[Number(val)] ?? String(val);
    if (key === 'customer_type') return val === 'empresa' ? 'Empresa' : 'Persona física';
    if (key === 'role') return String(val) === 'admin' ? 'Administrador' : 'Chofer';
    // Detalle de confirmación de carga: { assigned: {egg_type_id: qty}, actual?: {...} }
    if (key === 'details' && typeof val === 'object') {
      const d = val as { assigned?: Record<string, number>; actual?: Record<string, number> };
      const fmtMap = (obj?: Record<string, number>) =>
        obj ? Object.entries(obj).map(([id, q]) => `${eggName.get(id) ?? 'tipo'}: ${q} cp`).join(', ') : '';
      const parts: string[] = [];
      if (d.assigned) parts.push(`Asignado → ${fmtMap(d.assigned)}`);
      if (d.actual) parts.push(`Real → ${fmtMap(d.actual)}`);
      if (parts.length) return parts.join('   ·   ');
    }
    if (key.endsWith('_at')) return fmt(String(val));
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  function fieldLabel(key: string): string { return FIELD_LABELS[key] ?? key; }

  // Devuelve las filas legibles (label + antes/después) de un cambio
  function readableChanges(r: AuditRow): { label: string; before?: string; after?: string; single?: string }[] {
    const oldObj = r.changed?.old ?? null;
    const newObj = r.changed?.new ?? null;
    const out: { label: string; before?: string; after?: string; single?: string }[] = [];
    const keys = new Set<string>([...Object.keys(oldObj ?? {}), ...Object.keys(newObj ?? {})]);
    for (const k of keys) {
      if (HIDDEN.has(k)) continue;
      const ov = oldObj ? (oldObj as Record<string, unknown>)[k] : undefined;
      const nv = newObj ? (newObj as Record<string, unknown>)[k] : undefined;
      if (r.action === 'UPDATE') {
        if (JSON.stringify(ov) === JSON.stringify(nv)) continue;
        out.push({ label: fieldLabel(k), before: resolve(k, ov), after: resolve(k, nv) });
      } else {
        const v = r.action === 'DELETE' ? ov : nv;
        if (v === null || v === undefined || v === '') continue;
        out.push({ label: fieldLabel(k), single: resolve(k, v) });
      }
    }
    return out;
  }

  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Auditoría</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Registro de todas las acciones de los usuarios (solo administradores).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={table} onChange={(e) => { setTable(e.target.value); setPage(1); }}
          className="text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100">
          <option value="">Todas las secciones</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100">
          <option value="">Todas las acciones</option>
          <option value="INSERT">Creaciones</option>
          <option value="UPDATE">Ediciones</option>
          <option value="DELETE">Borrados</option>
        </select>
        <select value={actorId} onChange={(e) => { setActorId(e.target.value); setPage(1); }}
          className="text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100">
          <option value="">Todos los usuarios</option>
          {(users ?? []).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          Desde
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100" />
        </label>
        <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          Hasta
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="text-sm px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100" />
        </label>
        {(table || action || actorId || dateFrom || dateTo) && (
          <button
            onClick={() => { setTable(''); setAction(''); setActorId(''); setDateFrom(''); setDateTo(''); setPage(1); }}
            className="text-sm px-3 py-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !rows.length ? (
          <div className="text-center py-16 text-sm text-gray-400">Sin registros.</div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {rows.map((r: AuditRow) => {
              const changes = readableChanges(r);
              const open = expanded === r.id;
              return (
                <div key={r.id} className="px-5 py-3">
                  <button className="w-full flex items-center gap-3 text-left" onClick={() => setExpanded(open ? null : r.id)}>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${ACTION_STYLE[r.action]}`}>
                      {ACTION_LABEL[r.action] ?? r.action}
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {TABLE_LABELS[r.table_name] ?? r.table_name}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex-1 truncate">
                      {r.actor_id ? (userName.get(r.actor_id) ?? 'Usuario') : 'Sistema'}
                      {r.reason ? ` — «${r.reason}»` : ''}
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{fmt(r.created_at)}</span>
                    <span className="text-gray-400">{open ? '▾' : '▸'}</span>
                  </button>

                  {open && (
                    <div className="mt-2 ml-1 space-y-1">
                      {r.reason && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                          <span className="font-semibold">Motivo:</span> {r.reason}
                        </p>
                      )}
                      {changes.length === 0 ? (
                        <p className="text-sm text-gray-400">Sin detalles.</p>
                      ) : (
                        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 space-y-1">
                          {changes.map((ch, i) => (
                            <div key={i} className="text-sm flex flex-wrap gap-x-2">
                              <span className="text-gray-500 dark:text-gray-400 font-medium">{ch.label}:</span>
                              {ch.single !== undefined ? (
                                <span className="text-gray-800 dark:text-gray-200">{ch.single}</span>
                              ) : (
                                <span className="text-gray-800 dark:text-gray-200">
                                  <span className="line-through text-gray-400">{ch.before}</span>
                                  <span className="mx-1">→</span>
                                  <span className="font-semibold">{ch.after}</span>
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Paginación */}
        {!isLoading && total > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Por página:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value) as PageSize); setPage(1); }}
                className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-800 dark:text-gray-100"
              >
                {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <span>{total} registros</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200">Anterior</button>
              <span className="text-xs text-gray-500 dark:text-gray-400">Página {page} de {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-3 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
