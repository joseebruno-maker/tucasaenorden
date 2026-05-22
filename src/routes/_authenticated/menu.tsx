import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ShoppingCart, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/menu")({ component: MenuPage });

type Meal = "breakfast" | "lunch" | "snack" | "dinner";
const MEALS: { key: Meal; label: string; emoji: string }[] = [
  { key: "breakfast", label: "Desayuno", emoji: "🥐" },
  { key: "lunch", label: "Almuerzo", emoji: "🍽️" },
  { key: "snack", label: "Merienda", emoji: "🍪" },
  { key: "dinner", label: "Cena", emoji: "🌙" },
];

interface Entry {
  id: string;
  date: string;
  meal: Meal;
  title: string;
  notes: string | null;
}

function MenuPage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const { canManageNonEconomic, loading: roleLoading } = useRole();
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [editing, setEditing] = useState<{ date: string; meal: Meal; existing?: Entry } | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const startStr = format(weekStart, "yyyy-MM-dd");
  const endStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: entries = [] } = useQuery({
    queryKey: ["menu", household?.id, startStr],
    enabled: !!household && canManageNonEconomic,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_entries")
        .select("id,date,meal,title,notes")
        .eq("household_id", household!.id)
        .gte("date", startStr)
        .lte("date", endStr);
      if (error) throw error;
      return data as Entry[];
    },
  });

  useEffect(() => {
    if (!household) return;
    const ch = supabase
      .channel(`menu-${household.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_entries", filter: `household_id=eq.${household.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["menu", household.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [household, qc]);

  const findEntry = (date: string, meal: Meal) => entries.find((e) => e.date === date && e.meal === meal);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["menu", household?.id] }),
  });

  const toShopping = useMutation({
    mutationFn: async (e: Entry) => {
      const { error } = await supabase.from("shopping_items").insert({
        household_id: household!.id,
        created_by: user!.id,
        name: e.title,
        category: "Menú",
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Agregado a Compras"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (roleLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!canManageNonEconomic) {
    return (
      <div className="mx-auto max-w-md text-center py-12 space-y-2">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Sección protegida</h2>
        <p className="text-sm text-muted-foreground">Los invitados no pueden ver el menú semanal.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Menú semanal</h1>
          <p className="text-sm text-muted-foreground">
            Semana del {format(weekStart, "d MMM", { locale: es })} al {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" onClick={() => setWeekStart((d) => addDays(d, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>Hoy</Button>
          <Button size="icon" variant="outline" onClick={() => setWeekStart((d) => addDays(d, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {days.map((d) => {
          const ds = format(d, "yyyy-MM-dd");
          return (
            <div key={ds} className="rounded-xl border bg-card">
              <div className="border-b px-3 py-2 text-sm font-semibold capitalize">
                {format(d, "EEEE d", { locale: es })}
              </div>
              <div className="divide-y">
                {MEALS.map((m) => {
                  const e = findEntry(ds, m.key);
                  return (
                    <div key={m.key} className="flex items-start gap-2 p-3">
                      <span className="text-lg">{m.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-muted-foreground">{m.label}</div>
                        {e ? (
                          <>
                            <div className="font-medium">{e.title}</div>
                            {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                          </>
                        ) : (
                          <button
                            onClick={() => setEditing({ date: ds, meal: m.key })}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            + Agregar
                          </button>
                        )}
                      </div>
                      {e && (
                        <div className="flex flex-col gap-1">
                          <button onClick={() => setEditing({ date: ds, meal: m.key, existing: e })} className="text-xs text-primary">Editar</button>
                          <button onClick={() => toShopping.mutate(e)} className="text-muted-foreground" title="A compras"><ShoppingCart className="h-4 w-4" /></button>
                          <button onClick={() => del.mutate(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-24 border-b p-2 text-left text-xs font-medium text-muted-foreground"></th>
              {days.map((d) => (
                <th key={d.toISOString()} className="border-b p-2 text-left text-xs font-medium capitalize">
                  {format(d, "EEE d", { locale: es })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEALS.map((m) => (
              <tr key={m.key}>
                <td className="border-b p-2 align-top text-xs font-medium text-muted-foreground">
                  {m.emoji} {m.label}
                </td>
                {days.map((d) => {
                  const ds = format(d, "yyyy-MM-dd");
                  const e = findEntry(ds, m.key);
                  return (
                    <td key={ds} className="border-b p-1 align-top">
                      {e ? (
                        <div className="group rounded-md border bg-background p-2">
                          <div className="text-xs font-medium">{e.title}</div>
                          {e.notes && <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{e.notes}</div>}
                          <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button onClick={() => setEditing({ date: ds, meal: m.key, existing: e })} className="text-[11px] text-primary">Editar</button>
                            <button onClick={() => toShopping.mutate(e)} className="text-[11px] text-muted-foreground hover:text-foreground">A compras</button>
                            <button onClick={() => del.mutate(e.id)} className="text-[11px] text-muted-foreground hover:text-destructive">Borrar</button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditing({ date: ds, meal: m.key })}
                          className="flex h-full min-h-[60px] w-full items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-accent"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.existing ? "Editar" : "Agregar"} — {editing && MEALS.find((m) => m.key === editing.meal)?.label}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <EntryForm
              date={editing.date}
              meal={editing.meal}
              existing={editing.existing}
              onDone={() => {
                setEditing(null);
                qc.invalidateQueries({ queryKey: ["menu", household?.id] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EntryForm({ date, meal, existing, onDone }: { date: string; meal: Meal; existing?: Entry; onDone: () => void }) {
  const { household } = useHousehold();
  const { user } = useAuth();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (existing) {
      const { error } = await supabase
        .from("menu_entries")
        .update({ title: title.trim(), notes: notes.trim() || null })
        .eq("id", existing.id);
      setLoading(false);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("menu_entries").upsert({
        household_id: household!.id,
        created_by: user!.id,
        date,
        meal,
        title: title.trim(),
        notes: notes.trim() || null,
      }, { onConflict: "household_id,date,meal" });
      setLoading(false);
      if (error) return toast.error(error.message);
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Plato</Label><Input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Milanesas con puré…" autoFocus /></div>
      <div><Label>Notas</Label><Textarea rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ingredientes, quién cocina…" /></div>
      <Button type="submit" disabled={loading || !title.trim()} className="w-full">{loading ? "Guardando…" : "Guardar"}</Button>
    </form>
  );
}
