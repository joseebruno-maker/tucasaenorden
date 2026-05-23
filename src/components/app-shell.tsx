import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Home, ShoppingCart, ListChecks, Calendar, Users, LogOut, Menu, Wrench, Wallet, UtensilsCrossed, ChefHat } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "./notifications-bell";
import { useRole } from "@/lib/role";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const { isAdmin, canManageNonEconomic, isGuest } = useRole();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  const NAV = [
    { to: "/dashboard", icon: Home, label: "Inicio", show: true },
    { to: "/compras", icon: ShoppingCart, label: "Compras", show: true },
    { to: "/pendientes", icon: ListChecks, label: "Pendientes", show: true },
    { to: "/calendario", icon: Calendar, label: "Calendario", show: !isGuest },
    { to: "/mantenimientos", icon: Wrench, label: "Mantenimientos", show: canManageNonEconomic },
    { to: "/menu", icon: UtensilsCrossed, label: "Menú semanal", show: canManageNonEconomic },
    { to: "/pagos", icon: Wallet, label: "Pagos", show: isAdmin },
    { to: "/hogar", icon: Users, label: "Hogar", show: true },
  ] as const;

  const NavLinks = () => (
    <>
      {NAV.filter((n) => n.show).map((n) => {
        const active = location.pathname.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            )}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r bg-sidebar p-4 md:flex md:flex-col">
        <Link to="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Home className="h-4 w-4" />
          </span>
          <span className="font-semibold">Mi Hogar</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          <NavLinks />
        </nav>
        <Button variant="ghost" size="sm" onClick={signOut} className="justify-start gap-3">
          <LogOut className="h-4 w-4" /> Salir
        </Button>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar p-4 shadow-xl"
          >
            <div className="mb-6 flex items-center gap-2 px-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Home className="h-4 w-4" />
              </span>
              <span className="font-semibold">Mi Hogar</span>
            </div>
            <nav className="flex flex-1 flex-col gap-1">
              <NavLinks />
            </nav>
            <Button variant="ghost" size="sm" onClick={signOut} className="justify-start gap-3">
              <LogOut className="h-4 w-4" /> Salir
            </Button>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
          <button className="md:hidden" onClick={() => setOpen(true)} aria-label="Menú">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <NotificationsBell />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
