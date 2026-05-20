import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";

interface Item { id: string; kind: "task" | "event"; title: string; when: string }

export function NotificationsBell() {
  const { household } = useHousehold();

  const { data: items = [] } = useQuery({
    queryKey: ["notifications", household?.id],
    enabled: !!household,
    queryFn: async (): Promise<Item[]> => {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + 7);
      const [{ data: tasks }, { data: events }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id,title,due_date,status")
          .eq("household_id", household!.id)
          .eq("status", "pending")
          .not("due_date", "is", null)
          .lte("due_date", horizon.toISOString())
          .order("due_date", { ascending: true }),
        supabase
          .from("events")
          .select("id,title,starts_at")
          .eq("household_id", household!.id)
          .gte("starts_at", new Date().toISOString())
          .lte("starts_at", horizon.toISOString())
          .order("starts_at", { ascending: true }),
      ]);
      const merged: Item[] = [
        ...(tasks ?? []).map((t) => ({ id: t.id, kind: "task" as const, title: t.title, when: t.due_date! })),
        ...(events ?? []).map((e) => ({ id: e.id, kind: "event" as const, title: e.title, when: e.starts_at })),
      ].sort((a, b) => a.when.localeCompare(b.when));
      return merged;
    },
  });

  const count = items.length;

  return (
    <Popover>
      <PopoverTrigger className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {count}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Recordatorios</div>
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nada urgente esta semana 🎉</div>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {items.map((it) => {
              const d = new Date(it.when);
              const label = isToday(d)
                ? `Hoy ${format(d, "HH:mm")}`
                : isTomorrow(d)
                  ? `Mañana ${format(d, "HH:mm")}`
                  : format(d, "EEE d MMM HH:mm", { locale: es });
              const overdue = it.kind === "task" && isPast(d) && !isToday(d);
              return (
                <li key={`${it.kind}-${it.id}`} className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      overdue ? "bg-destructive" : it.kind === "task" ? "bg-primary" : "bg-accent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{it.title}</div>
                    <div className={`text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                      {overdue ? "Vencido · " : ""}{label}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
