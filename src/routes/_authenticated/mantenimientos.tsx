import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Check, Wrench } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mantenimientos")({ component: MaintenancePage });

interface Item {
  id: string;
  name: string;
  description: string | null;
  frequency_days: number;
  next_due_date: string;
  last_done_at: string | null;
  assigned_to: string | null;
}

interface Member { user_id: string; profile: { display_name: string } | null }

function MaintenancePage() {
  const { household } = useHousehold();
  const { canManageNonEconomic, loading: roleLoading } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["members", household?.id],
    enabled: !!household,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("user_id, profile:profiles(display_name)")
        .eq("household_id", household!.id);
      if (error) throw error;
      return data as unknown as Member[];
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["maintenance", household?.id],
    enabled: !!household && canManageNonEconomic,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_items")
        .select("id,name,description,frequency_days,next_due_date,last_done_at,assigned_to")
        .eq("household_id", household!.id)
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      return data as Item[];
    },
  });

  const markDone = useMutation({
    mutationFn: async (it: Item) => {
      const now = new Date();
      const next = addDays(now, it.frequency_days);
      const { error } = await supabase.from("maintenance_items").update({
        last_done_at: now.toISOString(),
        next_due_date: next.toISOString().slice(0, 10),
      }).eq("id", it.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("¡Hecho!"); qc.invalidateQueries({ queryKey: ["maintenance"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
  });

  const nameFor = (uid: string | null) => {
    if (!uid) return "Cualquiera";
    return members.find((m) => m.user_id === uid)?.profile?.display_name ?? "Integrante";
  };

  if (roleLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!canManageNonEconomic) {
    return (
      <div className="mx-auto max-w-md text-center py-12 space-y-2">
        <Wrench className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Sin acceso</h2>
        <p className="text-sm text-muted-foreground">Esta sección está reservada para admin y miembros.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mantenimientos</h1>
          <p className="text-sm text-muted-foreground">Tareas recurrentes del hogar</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo mantenimiento</DialogTitle></DialogHeader>
            <NewForm members={members} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["maintenance"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Sin mantenimientos cargados. Agregá filtros de aire, service del auto, limpieza profunda, etc.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const dueDate = new Date(it.next_due_date);
            const days = differenceInDays(dueDate, new Date());
            const overdue = days < 0;
            const soon = days >= 0 && days <= 7;
            return (
              <Card key={it.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{it.name}</div>
                    {it.description && <div className="text-sm text-muted-foreground">{it.description}</div>}
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>👤 {nameFor(it.assigned_to)}</span>
                      <span>🔁 cada {it.frequency_days} días</span>
                      <span className={overdue ? "text-destructive font-medium" : soon ? "text-amber-600 font-medium" : ""}>
                        📅 {format(dueDate, "d MMM yyyy", { locale: es })}
                        {overdue && ` · vencido hace ${Math.abs(days)}d`}
                        {soon && !overdue && ` · en ${days}d`}
                      </span>
                      {it.last_done_at && <span>✓ último: {format(new Date(it.last_done_at), "d MMM", { locale: es })}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => markDone.mutate(it)}>
                      <Check className="h-4 w-4 mr-1" />Hecho
                    </Button>
                    <button onClick={() => del.mutate(it.id)} className="px-2 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewForm({ members, onDone }: { members: Member[]; onDone: () => void }) {
  const { household } = useHousehold();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [freq, setFreq] = useState("30");
  const [next, setNext] = useState(new Date().toISOString().slice(0, 10));
  const [assigned, setAssigned] = useState("none");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const days = parseInt(freq, 10);
    if (!days || days < 1) return toast.error("Frecuencia inválida");
    setLoading(true);
    const { error } = await supabase.from("maintenance_items").insert({
      household_id: household!.id,
      created_by: user!.id,
      name: name.trim(),
      description: description.trim() || null,
      frequency_days: days,
      next_due_date: next,
      assigned_to: assigned === "none" ? null : assigned,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Nombre</Label><Input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Filtro de aire" /></div>
      <div><Label>Descripción</Label><Textarea maxLength={300} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Cada cuántos días</Label>
          <Input type="number" min={1} max={3650} value={freq} onChange={(e) => setFreq(e.target.value)} required />
        </div>
        <div>
          <Label>Próxima fecha</Label>
          <Input type="date" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
      </div>
      <div>
        <Label>Asignar a</Label>
        <Select value={assigned} onValueChange={setAssigned}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Cualquiera</SelectItem>
            {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.profile?.display_name ?? "Integrante"}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading || !name.trim()} className="w-full">{loading ? "Guardando…" : "Crear"}</Button>
    </form>
  );
}
