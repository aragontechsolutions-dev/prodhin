import { useUsers } from '../../hooks/useUsers';
import { useCustomers } from '../../hooks/useCustomers';
import { useAuth } from '../../hooks/useAuth';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { data: users } = useUsers();
  const { data: customers } = useCustomers();

  const totalUsers = users?.length ?? 0;
  const totalChoferes = users?.filter((u) => u.role === 'chofer').length ?? 0;
  const totalClientes = customers?.length ?? 0;
  const clientesActivos = customers?.filter((c) => c.is_active).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bienvenido, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Resumen general del sistema</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total usuarios"
          value={totalUsers}
          color="bg-blue-50 text-blue-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
            </svg>
          }
        />
        <StatCard
          label="Choferes"
          value={totalChoferes}
          color="bg-primary-50 text-primary-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          }
        />
        <StatCard
          label="Total clientes"
          value={totalClientes}
          color="bg-green-50 text-green-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
          }
        />
        <StatCard
          label="Clientes activos"
          value={clientesActivos}
          color="bg-purple-50 text-purple-600"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-900 mb-3">Accesos rápidos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href="/admin/usuarios" className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition group">
            <span className="text-2xl">👤</span>
            <div>
              <p className="font-medium text-gray-900 group-hover:text-primary-700">Gestionar Usuarios</p>
              <p className="text-xs text-gray-500">Crear y administrar choferes</p>
            </div>
          </a>
          <a href="/admin/clientes" className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition group">
            <span className="text-2xl">📍</span>
            <div>
              <p className="font-medium text-gray-900 group-hover:text-primary-700">Gestionar Clientes</p>
              <p className="text-xs text-gray-500">Ubicar clientes en el mapa</p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
