import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2 } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pendientes")({ component: TasksPage });

interface Task { id: string; title: string; description: string | null; due_date: string | null; assigned_to: string | null; status: string }
interface Member { user_id: string; profile: { display_name: string } | null }

function TasksPage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "mine" | "overdue" | "done">("all");
  const [openNew, setOpenNew] = useState(false);

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

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", household?.id],
    enabled: !!household,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("id,title,description,due_date,assigned_to,status")
        .eq("household_id", household!.id)
        .order("status", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as Task[];
    },
  });

  const nameFor = (uid: string | null) => {
    if (!uid) return "Todos";
    return members.find((m) => m.user_id === uid)?.profile?.display_name ?? "Alguien";
  };

  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const { error } = await supabase.from("tasks")
        .update({ status: t.status === "done" ? "pending" : "done" }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const filtered = tasks.filter((t) => {
    if (filter === "done") return t.status === "done";
    if (t.status === "done") return false;
    if (filter === "mine") return t.assigned_to === user?.id;
    if (filter === "overdue") return t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date));
    return true;
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pendientes</h1>
          <p className="text-sm text-muted-foreground">Tareas del hogar</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Nueva</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nueva tarea</DialogTitle></DialogHeader>
            <NewTaskForm members={members} onDone={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["tasks"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="mine">Míos</TabsTrigger>
          <TabsTrigger value="overdue">Vencidos</TabsTrigger>
          <TabsTrigger value="done">Hechos</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nada por aquí.</p>
        ) : filtered.map((t) => {
          const overdue = t.due_date && isPast(new Date(t.due_date)) && t.status === "pending" && !isToday(new Date(t.due_date));
          return (
            <Card key={t.id} className="p-4">
              <div className="flex items-start gap-3">
                <Checkbox className="mt-1" checked={t.status === "done"} onCheckedChange={() => toggle.mutate(t)} />
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</div>
                  {t.description && <div className="text-sm text-muted-foreground">{t.description}</div>}
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>👤 {nameFor(t.assigned_to)}</span>
                    {t.due_date && <span className={overdue ? "text-destructive font-medium" : ""}>📅 {format(new Date(t.due_date), "d MMM HH:mm", { locale: es })}{overdue && " · vencido"}</span>}
                  </div>
                </div>
                <button onClick={() => del.mutate(t.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function NewTaskForm({ members, onDone }: { members: Member[]; onDone: () => void }) {
  const { household } = useHousehold();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assigned, setAssigned] = useState<string>("none");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("tasks").insert({
      household_id: household!.id, created_by: user!.id,
      title: title.trim(), description: description.trim() || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      assigned_to: assigned === "none" ? null : assigned,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Título</Label><Input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><Label>Descripción</Label><Textarea maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Fecha límite</Label><Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        <div>
          <Label>Asignar a</Label>
          <Select value={assigned} onValueChange={setAssigned}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Todos</SelectItem>
              {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.profile?.display_name ?? "Integrante"}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={loading || !title.trim()} className="w-full">{loading ? "Guardando…" : "Crear tarea"}</Button>
    </form>
  );
}
