import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';

function App() {
  useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Rutas protegidas — solo Admin */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin/*" element={<div className="p-8 text-gray-700">Panel Admin — Etapa 2</div>} />
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
