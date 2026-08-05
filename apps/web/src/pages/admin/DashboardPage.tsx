import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useUsers, useDriverDelegations } from '../../hooks/useUsers';
import { useCustomers } from '../../hooks/useCustomers';
import { useRoutes } from '../../hooks/useRoutes';
import { useMapleReturns } from '../../hooks/useMapleReturns';
import { useEggReturns } from '../../hooks/useEggReturns';
import { useBoxBalances } from '../../hooks/useBoxBalances';
import { useProspects, useCompetitors } from '../../hooks/useMarketIntel';

function StatCard({
  label, value, icon, colorBg, colorText, alert,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  colorBg: string;
  colorText: string;
  alert?: boolean;
}) {
  return (
    <div className={`bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border ${alert && Number(value) > 0 ? 'border-red-300 dark:border-red-700' : 'border-gray-100 dark:border-gray-800'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${alert && Number(value) > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorBg}`}>
          <span className={colorText}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

const TODAY = new Date().toISOString().split('T')[0];

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: users } = useUsers();
  const { data: customers } = useCustomers();
  const { data: routes } = useRoutes();
  const { data: delegations } = useDriverDelegations();
  const { data: maplesPend } = useMapleReturns('pendiente');
  const { data: returnsPend } = useEggReturns('pendiente');
  const { data: boxBalances } = useBoxBalances();
  const { data: prospectosNuevosList } = useProspects('nuevo');
  const { data: competidores } = useCompetitors();

  const maplesPendientes = (maplesPend ?? []).length;
  const devolucionesPendientes = (returnsPend ?? []).length;
  const prospectosNuevos = (prospectosNuevosList ?? []).length;
  const competenciaPendiente = (competidores ?? []).filter((c) => c.status === 'pendiente').length;
  const cajasEnLocales = (() => { let t = 0; for (const v of boxBalances?.values() ?? []) t += Math.max(0, v); return t; })();

  const pendientes = [
    { n: maplesPendientes, label: 'maples por aprobar', to: '/admin/maples' },
    { n: devolucionesPendientes, label: 'rotos/devoluciones por aprobar', to: '/admin/devoluciones' },
    { n: prospectosNuevos, label: 'prospectos por gestionar', to: '/admin/competencia' },
    { n: competenciaPendiente, label: 'competidores por aprobar', to: '/admin/competencia' },
  ].filter((p) => p.n > 0);
  const totalPendientes = pendientes.reduce((s, p) => s + p.n, 0);

  const choferes = (users ?? []).filter((u) => u.role === 'chofer');
  const choferesActivos = choferes.filter((u) => u.is_active).length;
  const clientesActivos = (customers ?? []).filter((c) => c.is_active).length;
  const clientesInactivos = (customers ?? []).filter((c) => !c.is_active).length;
  const rutasActivas = (routes ?? []).filter((r) => r.is_active);
  const rutasSinChofer = rutasActivas.filter((r) => !r.driver_id).length;
  const delegacionesHoy = (delegations ?? []).filter(
    (d) => d.is_active && d.start_date <= TODAY && d.end_date >= TODAY,
  ).length;

  const quickLinks = [
    { to: '/admin/usuarios', emoji: '👤', label: 'Usuarios', desc: 'Crear y gestionar choferes' },
    { to: '/admin/clientes', emoji: '📍', label: 'Clientes', desc: 'Gestionar clientes en el mapa' },
    { to: '/admin/asignaciones', emoji: '📋', label: 'Asignaciones', desc: 'Asignar clientes a choferes' },
    { to: '/admin/rutas', emoji: '🗺️', label: 'Rutas', desc: 'Configurar rutas por día' },
    { to: '/admin/reportes', emoji: '📊', label: 'Reportes', desc: 'Entregas y cajas por chofer y cliente' },
    { to: '/admin/categorias', emoji: '🥚', label: 'Categorías', desc: 'Tipos de huevo (suelto/envasado)' },
    { to: '/admin/stock', emoji: '🚚', label: 'Stock camiones', desc: 'Cargas, recuentos y stock' },
    { to: '/admin/maples', emoji: '🧺', label: 'Maples', desc: 'Aprobar entregas de maples' },
    { to: '/admin/devoluciones', emoji: '♻️', label: 'Rotos y devoluciones', desc: 'Aprobar rotos y vencidos' },
    { to: '/admin/competencia', emoji: '🎯', label: 'Competencia', desc: 'Mapa de calor y prospectos' },
    { to: '/admin/auditoria', emoji: '📝', label: 'Auditoría', desc: 'Historial de acciones' },
    { to: '/admin/manual', emoji: '📖', label: 'Manual', desc: 'Guía completa del sistema' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Bienvenido, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Resumen general del sistema</p>
      </div>

      {/* Aviso: cosas pendientes de aprobar/gestionar */}
      {totalPendientes > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔔</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Tenés {totalPendientes} {totalPendientes === 1 ? 'cosa pendiente' : 'cosas pendientes'} de aprobar o gestionar
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {pendientes.map((p) => (
                  <Link key={p.label} to={p.to}
                    className="inline-flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-full px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-300 hover:border-amber-400 transition">
                    <span className="font-bold">{p.n}</span> {p.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard label="Choferes activos" value={choferesActivos} colorBg="bg-blue-50 dark:bg-blue-900/30" colorText="text-blue-600 dark:text-blue-400"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
        />
        <StatCard label="Clientes activos" value={clientesActivos} colorBg="bg-green-50 dark:bg-green-900/30" colorText="text-green-600 dark:text-green-400"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatCard label="Rutas activas" value={rutasActivas.length} colorBg="bg-amber-50 dark:bg-amber-900/30" colorText="text-amber-600 dark:text-amber-400"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}
        />
        <StatCard label="Rutas sin chofer" value={rutasSinChofer} colorBg={rutasSinChofer > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-gray-50 dark:bg-gray-800'} colorText={rutasSinChofer > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'} alert
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>}
        />
        <StatCard label="Clientes inactivos" value={clientesInactivos} colorBg="bg-gray-50 dark:bg-gray-800" colorText="text-gray-400 dark:text-gray-500"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>}
        />
        <StatCard label="Delegaciones hoy" value={delegacionesHoy} colorBg="bg-orange-50 dark:bg-orange-900/30" colorText="text-orange-600 dark:text-orange-400"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>}
        />
      </div>

      {/* Requiere atención: aprobaciones pendientes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Link to="/admin/maples" className={`rounded-2xl p-5 shadow-sm border transition ${maplesPendientes > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 hover:border-amber-400' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Maples por aprobar</p>
          <p className={`text-2xl font-bold mt-1 ${maplesPendientes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>{maplesPendientes} 🧺</p>
          <p className="text-xs text-gray-400 mt-0.5">{maplesPendientes > 0 ? 'Tocá para controlar' : 'Nada pendiente'}</p>
        </Link>
        <Link to="/admin/devoluciones" className={`rounded-2xl p-5 shadow-sm border transition ${devolucionesPendientes > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 hover:border-amber-400' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Rotos/devoluciones por aprobar</p>
          <p className={`text-2xl font-bold mt-1 ${devolucionesPendientes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>{devolucionesPendientes} ♻️</p>
          <p className="text-xs text-gray-400 mt-0.5">{devolucionesPendientes > 0 ? 'Tocá para controlar' : 'Nada pendiente'}</p>
        </Link>
        <Link to="/admin/competencia" className={`rounded-2xl p-5 shadow-sm border transition ${prospectosNuevos > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 hover:border-amber-400' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Prospectos por gestionar</p>
          <p className={`text-2xl font-bold mt-1 ${prospectosNuevos > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>{prospectosNuevos} 🎯</p>
          <p className="text-xs text-gray-400 mt-0.5">{prospectosNuevos > 0 ? 'Nuevos sin gestionar' : 'Nada pendiente'}</p>
        </Link>
        <Link to="/admin/competencia" className={`rounded-2xl p-5 shadow-sm border transition ${competenciaPendiente > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 hover:border-amber-400' : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'}`}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Competencia por aprobar</p>
          <p className={`text-2xl font-bold mt-1 ${competenciaPendiente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}`}>{competenciaPendiente} 🚩</p>
          <p className="text-xs text-gray-400 mt-0.5">{competenciaPendiente > 0 ? 'Marcada por choferes' : 'Nada pendiente'}</p>
        </Link>
        <Link to="/admin/reportes" className="rounded-2xl p-5 shadow-sm border bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 hover:border-teal-300 transition">
          <p className="text-xs text-gray-500 dark:text-gray-400">Cajas plásticas en locales</p>
          <p className="text-2xl font-bold mt-1 text-teal-600 dark:text-teal-400">{cajasEnLocales} 📦</p>
          <p className="text-xs text-gray-400 mt-0.5">Prestadas, sin recoger</p>
        </Link>
      </div>

      {/* Estado de rutas */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Estado de rutas activas</h2>
          <Link to="/admin/rutas" className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">Ver todas →</Link>
        </div>
        {rutasActivas.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">No hay rutas activas</p>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {rutasActivas.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{r.name}</span>
                <div className="flex items-center gap-2">
                  {r.driver_id ? (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{r.driver_name}</span>
                  ) : (
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">Sin asignar</span>
                  )}
                  <span className="text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Activa</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accesos rápidos */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
        <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {quickLinks.map((l) => (
            <Link key={l.to} to={l.to}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition group text-center"
            >
              <span className="text-3xl">{l.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-700 dark:group-hover:text-primary-400">{l.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{l.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
