import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      // Try to promote to admin if allowlisted (idempotent)
      try {
        await (supabase as any).rpc('promote_to_admin_if_allowlisted');
      } catch (e) {
        console.warn('RPC promote_to_admin_if_allowlisted not available yet');
      }
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) {
        console.error(error);
      }
      setIsAdmin(Boolean(data));
      setLoading(false);
    };
    check();
  }, []);

  if (loading) return <div className="container mx-auto py-10">Loading...</div>;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
};

export default AdminRoute;
