import { useMemo, useState } from 'react';
import { useAuditLog, TABLE_LABELS, type AuditRow } from '../../../hooks/useAuditLog';
import { useUsers } from '../../../hooks/useUsers';

const ACTION_LABEL: Record<string, string> = { INSERT: 'Creó', UPDATE: 'Editó', DELETE: 'Borró' };
const ACTION_STYLE: Record<string, string> = {
  INSERT: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
  UPDATE: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
  DELETE: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
};

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-UY', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' });
}

export default function AuditPage() {
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const { data: rows, isLoading } = useAuditLog({ table: table || undefined, action: action || undefined });
  const { data: users } = useUsers();

  const userName = useMemo(() => {
    const m = new Map<string, string>();
    (users ?? []).forEach((u) => m.set(u.id, u.full_name));
    return m;
  }, [users]);

  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Auditoría</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Registro de todas las acciones de los usuarios (solo administradores).
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select
          value={table}
          onChange={(e) => setTable(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Todas las tablas</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Todas las acciones</option>
          <option value="INSERT">Creaciones</option>
          <option value="UPDATE">Ediciones</option>
          <option value="DELETE">Borrados</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !(rows ?? []).length ? (
          <div className="text-center py-16 text-sm text-gray-400">Sin registros.</div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {(rows ?? []).map((r: AuditRow) => (
              <div key={r.id} className="px-5 py-3">
                <button className="w-full flex items-center gap-3 text-left" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ACTION_STYLE[r.action]}`}>
                    {ACTION_LABEL[r.action] ?? r.action}
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {TABLE_LABELS[r.table_name] ?? r.table_name}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 flex-1 truncate">
                    {r.actor_id ? (userName.get(r.actor_id) ?? 'Usuario') : 'Sistema'}
                    {r.actor_role ? ` (${r.actor_role})` : ''}
                    {r.reason ? ` — «${r.reason}»` : ''}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{fmt(r.created_at)}</span>
                  <span className="text-gray-400">{expanded === r.id ? '▾' : '▸'}</span>
                </button>
                {expanded === r.id && (
                  <pre className="mt-2 text-xs bg-gray-50 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto text-gray-600 dark:text-gray-300">
                    {JSON.stringify(r.changed, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">Se muestran los últimos 200 registros.</p>
    </div>
  );
}
