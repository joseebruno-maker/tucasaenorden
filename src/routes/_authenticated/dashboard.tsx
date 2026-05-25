import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { Card } from "@/components/ui/card";
import {
  ShoppingCart,
  ListChecks,
  Calendar,
  UtensilsCrossed,
  Wrench,
  PiggyBank,
  Map,
  ChefHat,
  ArrowRight,
} from "lucide-react";
import { format, isToday, isTomorrow, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

const MEAL_LABEL: Record<string, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
};

function DashboardPage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const { canManageEconomic, canManageNonEconomic } = useRole();

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");

  const { data } = useQuery({
    queryKey: ["dashboard", household?.id, user?.id, todayStr],
    enabled: !!household && !!user,
    queryFn: async () => {
      const hh = household!.id;
      const [shop, myTasks, events, todayMenu, overdueMaint, monthExpenses, pendingActs] =
        await Promise.all([
          supabase
            .from("shopping_items")
            .select("id", { count: "exact", head: true })
            .eq("household_id", hh)
            .eq("bought", false),
          supabase
            .from("tasks")
            .select("id,title,due_date")
            .eq("household_id", hh)
            .eq("status", "pending")
            .or(`assigned_to.eq.${user!.id},assigned_to.is.null`)
            .order("due_date", { ascending: true, nullsFirst: false })
            .limit(5),
          supabase
            .from("events")
            .select("id,title,starts_at")
            .eq("household_id", hh)
            .gte("starts_at", new Date().toISOString())
            .order("starts_at", { ascending: true })
            .limit(5),
          supabase
            .from("menu_entries")
            .select("id,meal,title")
            .eq("household_id", hh)
            .eq("date", todayStr)
            .order("meal", { ascending: true }),
          supabase
            .from("maintenance_items")
            .select("id", { count: "exact", head: true })
            .eq("household_id", hh)
            .lte("next_due_date", todayStr),
          supabase
            .from("expenses")
            .select("amount")
            .eq("household_id", hh)
            .gte("spent_at", monthStart)
            .lte("spent_at", monthEnd),
          supabase
            .from("activities")
            .select("id,name,type")
            .eq("household_id", hh)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(4),
        ]);

      const totalMonth = (monthExpenses.data ?? []).reduce(
        (s, e) => s + Number(e.amount ?? 0),
        0,
      );

      return {
        shoppingCount: shop.count ?? 0,
        tasks: myTasks.data ?? [],
        events: events.data ?? [],
        todayMenu: todayMenu.data ?? [],
        overdueMaint: overdueMaint.count ?? 0,
        monthExpenses: totalMonth,
        pendingActs: pendingActs.data ?? [],
      };
    },
  });

  const name = user?.user_metadata?.display_name ?? "bienvenido";
  const hour = today.getHours();
  const greet = hour < 12 ? "Buen día" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-accent/30 to-secondary p-6 md:p-8">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <p className="text-sm text-muted-foreground">{format(today, "EEEE d 'de' MMMM", { locale: es })}</p>
          <h1 className="mt-1 text-2xl font-bold md:text-3xl">
            {greet}, {name} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{household?.name}</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard to="/compras" icon={ShoppingCart} label="por comprar" value={data?.shoppingCount ?? 0} tone="primary" />
        <StatCard to="/pendientes" icon={ListChecks} label="tus pendientes" value={data?.tasks.length ?? 0} tone="accent" />
        <StatCard to="/calendario" icon={Calendar} label="próximos eventos" value={data?.events.length ?? 0} tone="secondary" />
        {canManageNonEconomic ? (
          <StatCard
            to="/mantenimientos"
            icon={Wrench}
            label="mantenimientos vencidos"
            value={data?.overdueMaint ?? 0}
            tone={data && data.overdueMaint > 0 ? "destructive" : "muted"}
          />
        ) : (
          <StatCard to="/actividades" icon={Map} label="actividades pendientes" value={data?.pendingActs.length ?? 0} tone="accent" />
        )}
      </div>

      {/* Today's menu + Month expenses */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Menú de hoy</h2>
            </div>
            <Link to="/menu" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Ver semana <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data?.todayMenu.length ? (
            <ul className="mt-3 space-y-2">
              {data.todayMenu.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {MEAL_LABEL[m.meal] ?? m.meal}
                  </span>
                  <span className="truncate text-right">{m.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Sin menú para hoy. <Link to="/menu" className="text-primary underline-offset-2 hover:underline">Planificá la semana</Link>.</p>
          )}
        </Card>

        {canManageEconomic ? (
          <Link to="/gastos" className="block">
            <Card className="p-5 hover:shadow-md transition h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">Gastos del mes</h2>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{format(today, "MMMM", { locale: es })}</span>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold">
                  Bs. {(data?.monthExpenses ?? 0).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Total registrado este mes</p>
              </div>
            </Card>
          </Link>
        ) : (
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Recetario</h2>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Guardá recetas familiares y llevalas al menú.</p>
            <Link to="/recetario" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Abrir recetario <ArrowRight className="h-3 w-3" />
            </Link>
          </Card>
        )}
      </div>

      {/* Tasks + Events */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Tus pendientes</h2>
            </div>
            <Link to="/pendientes" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Ver todo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data?.tasks.length ? (
            <ul className="mt-3 space-y-2">
              {data.tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{t.title}</span>
                  {t.due_date && (
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {format(new Date(t.due_date), "d MMM", { locale: es })}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Nada pendiente 🎉</p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Próximos eventos</h2>
            </div>
            <Link to="/calendario" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Ver todo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data?.events.length ? (
            <ul className="mt-3 space-y-2">
              {data.events.map((e) => {
                const d = new Date(e.starts_at);
                const label = isToday(d)
                  ? `Hoy ${format(d, "HH:mm")}`
                  : isTomorrow(d)
                    ? `Mañana ${format(d, "HH:mm")}`
                    : format(d, "d MMM HH:mm", { locale: es });
                return (
                  <li key={e.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="truncate">{e.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{label}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Sin eventos próximos.</p>
          )}
        </Card>
      </div>

      {/* Pending activities */}
      {data?.pendingActs.length ? (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Map className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Ideas pendientes</h2>
            </div>
            <Link to="/actividades" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              Ver todo <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.pendingActs.map((a) => (
              <div key={a.id} className="rounded-md border px-3 py-2 text-sm">
                <div className="truncate font-medium">{a.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{a.type}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function StatCard({
  to,
  icon: Icon,
  label,
  value,
  tone,
}: {
  to: string;
  icon: typeof ShoppingCart;
  label: string;
  value: number;
  tone: "primary" | "accent" | "secondary" | "muted" | "destructive";
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    muted: "bg-muted text-muted-foreground",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Link to={to}>
      <Card className="p-4 hover:shadow-md transition h-full">
        <div className={`inline-grid h-9 w-9 place-items-center rounded-lg ${toneMap[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="mt-3 text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </Card>
    </Link>
  );
}
