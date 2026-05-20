import { createFileRoute, Outlet, redirect, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/household";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const { household, loading: hhLoading } = useHousehold();

  if (loading || hhLoading) return <div className="grid min-h-screen place-items-center text-muted-foreground text-sm">Cargando…</div>;
  if (!user) return <Navigate to="/login" />;
  if (!household) return <Navigate to="/onboarding" />;

  return <AppShell><Outlet /></AppShell>;
}
