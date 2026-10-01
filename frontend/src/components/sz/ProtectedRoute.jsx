import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Logo } from "@/components/sz/Logo";

export function ProtectedRoute({ children }) {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting || user === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-pulse"><Logo /></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
