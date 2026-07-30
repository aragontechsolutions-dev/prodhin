import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/auth.store';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import UsersPage from './pages/admin/users/UsersPage';
import CustomersPage from './pages/admin/customers/CustomersPage';
import AssignmentsPage from './pages/admin/assignments/AssignmentsPage';
import RoutesPage from './pages/admin/routes/RoutesPage';
import ReportsPage from './pages/admin/reports/ReportsPage';
import EggTypesPage from './pages/admin/eggtypes/EggTypesPage';
import StockPage from './pages/admin/stock/StockPage';
import MapleReturnsPage from './pages/admin/maples/MapleReturnsPage';
import EggReturnsPage from './pages/admin/eggreturns/EggReturnsPage';
import AuditPage from './pages/admin/audit/AuditPage';
import ManualPage from './pages/admin/manual/ManualPage';
import CustomerIntakePage from './pages/public/CustomerIntakePage';

function NoAutorizado() {
  const { signOut } = useAuthStore();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-primary-50 flex flex-col items-center justify-center gap-6 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">Acceso denegado</h1>
        <p className="text-sm text-gray-500">No tienes permisos para acceder a esta sección.</p>
        <button
          onClick={handleSignOut}
          className="w-full bg-primary-500 hover:bg-primary-600 text-gray-900 font-semibold py-2.5 rounded-lg transition"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function App() {
  const { profile } = useAuth();

  if (profile?.must_change_password) {
    return <ChangePasswordPage />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Público: autoservicio de datos del cliente (link de un solo uso) */}
      <Route path="/registro/:token" element={<CustomerIntakePage />} />

      {/* Rutas protegidas — solo Admin */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/usuarios" element={<UsersPage />} />
          <Route path="/admin/clientes" element={<CustomersPage />} />
          <Route path="/admin/asignaciones" element={<AssignmentsPage />} />
          <Route path="/admin/rutas" element={<RoutesPage />} />
          <Route path="/admin/reportes" element={<ReportsPage />} />
          <Route path="/admin/categorias" element={<EggTypesPage />} />
          <Route path="/admin/stock" element={<StockPage />} />
          <Route path="/admin/maples" element={<MapleReturnsPage />} />
          <Route path="/admin/devoluciones" element={<EggReturnsPage />} />
          <Route path="/admin/auditoria" element={<AuditPage />} />
          <Route path="/admin/manual" element={<ManualPage />} />
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>
      </Route>

      {/* Ruta raíz: redirige según rol */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Route>

      <Route
        path="/no-autorizado"
        element={<NoAutorizado />}
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
