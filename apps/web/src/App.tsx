import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './store/auth.store';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import UsersPage from './pages/admin/users/UsersPage';
import CustomersPage from './pages/admin/customers/CustomersPage';

function NoAutorizado() {
  const { signOut } = useAuthStore();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-600">
      <p className="text-lg">No tienes permisos para acceder a esta sección.</p>
      <button
        onClick={signOut}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
      >
        Cerrar sesión
      </button>
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

      {/* Rutas protegidas — solo Admin */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin/dashboard" element={<DashboardPage />} />
          <Route path="/admin/usuarios" element={<UsersPage />} />
          <Route path="/admin/clientes" element={<CustomersPage />} />
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
