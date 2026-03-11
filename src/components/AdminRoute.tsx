import { Navigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading, user } = useAdmin();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default AdminRoute;
