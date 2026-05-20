import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/household";
import { useLocation, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const { household, loading: hhLoading } = useHousehold();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (hhLoading) return null;

  // Force onboarding if no household yet
  if (!household && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" />;
  }
  if (household && location.pathname === "/onboarding") {
    return <Navigate to="/dashboard" />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
