import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  allowedRoles?: ('admin' | 'chofer')[];
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { user, profile, isLoading } = useAuth();

  if (isLoading || (user && allowedRoles && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/no-autorizado" replace />;
  }

  return <Outlet />;
}
