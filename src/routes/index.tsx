import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Home, ShoppingCart, ListChecks, Calendar, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/40 to-accent/30">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Home className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Mi Hogar</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Iniciar sesión
          </Link>
          <Link
            to="/signup"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Crear cuenta
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <section className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Administrá tu hogar <span className="text-primary">en equipo</span>.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Compras, pendientes y calendario compartido. Cada integrante de la casa con su cuenta,
              todo sincronizado en un mismo lugar.
            </p>
            <div className="mt-8 flex gap-3">
              <Link
                to="/signup"
                className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
              >
                Empezar gratis
              </Link>
              <Link
                to="/login"
                className="rounded-md border border-input bg-background px-6 py-3 text-sm font-medium"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: ShoppingCart, title: "Lista de compras", desc: "Compartida y en tiempo real." },
              { icon: ListChecks, title: "Pendientes", desc: "Asigná tareas a cada integrante." },
              { icon: Calendar, title: "Calendario", desc: "Eventos y recordatorios del hogar." },
              { icon: Users, title: "Integrantes", desc: "Invitá a tu familia con un código." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-5 shadow-sm">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
