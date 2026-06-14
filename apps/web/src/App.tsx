import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import AdminLayout from './pages/admin/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import UsersPage from './pages/admin/users/UsersPage';
import CustomersPage from './pages/admin/customers/CustomersPage';

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
        element={
          <div className="min-h-screen flex items-center justify-center text-gray-600">
            No tienes permisos para acceder a esta sección.
          </div>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
