import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { ShoppingCart, ListChecks, Calendar } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const { household } = useHousehold();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["dashboard", household?.id, user?.id],
    enabled: !!household && !!user,
    queryFn: async () => {
      const [shop, myTasks, events] = await Promise.all([
        supabase.from("shopping_items").select("id", { count: "exact", head: true })
          .eq("household_id", household!.id).eq("bought", false),
        supabase.from("tasks").select("id,title,due_date")
          .eq("household_id", household!.id).eq("status", "pending")
          .or(`assigned_to.eq.${user!.id},assigned_to.is.null`)
          .order("due_date", { ascending: true, nullsFirst: false }).limit(5),
        supabase.from("events").select("id,title,starts_at")
          .eq("household_id", household!.id)
          .gte("starts_at", new Date().toISOString())
          .order("starts_at", { ascending: true }).limit(5),
      ]);
      return {
        shoppingCount: shop.count ?? 0,
        tasks: myTasks.data ?? [],
        events: events.data ?? [],
      };
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {user?.user_metadata?.display_name ?? "bienvenido"} 👋</h1>
        <p className="text-sm text-muted-foreground">{household?.name}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link to="/compras"><Card className="p-5 hover:shadow-md transition">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <div className="mt-3 text-2xl font-bold">{data?.shoppingCount ?? 0}</div>
          <div className="text-sm text-muted-foreground">por comprar</div>
        </Card></Link>
        <Link to="/pendientes"><Card className="p-5 hover:shadow-md transition">
          <ListChecks className="h-5 w-5 text-primary" />
          <div className="mt-3 text-2xl font-bold">{data?.tasks.length ?? 0}</div>
          <div className="text-sm text-muted-foreground">tus pendientes</div>
        </Card></Link>
        <Link to="/calendario"><Card className="p-5 hover:shadow-md transition">
          <Calendar className="h-5 w-5 text-primary" />
          <div className="mt-3 text-2xl font-bold">{data?.events.length ?? 0}</div>
          <div className="text-sm text-muted-foreground">próximos eventos</div>
        </Card></Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Tus pendientes</h2>
          {data?.tasks.length ? (
            <ul className="mt-3 space-y-2">
              {data.tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{t.title}</span>
                  {t.due_date && <span className="text-xs text-muted-foreground">{format(new Date(t.due_date), "d MMM", { locale: es })}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted-foreground">Nada pendiente 🎉</p>}
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Próximos eventos</h2>
          {data?.events.length ? (
            <ul className="mt-3 space-y-2">
              {data.events.map((e) => {
                const d = new Date(e.starts_at);
                const label = isToday(d) ? `Hoy ${format(d, "HH:mm")}` : isTomorrow(d) ? `Mañana ${format(d, "HH:mm")}` : format(d, "d MMM HH:mm", { locale: es });
                return (
                  <li key={e.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <span className="truncate">{e.title}</span>
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="mt-3 text-sm text-muted-foreground">Sin eventos próximos.</p>}
        </Card>
      </div>
    </div>
  );
}
