import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * 路由守卫：未登录跳转 /login
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="app-wrapper">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <div className="text-sm text-text-secondary">加载中...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
