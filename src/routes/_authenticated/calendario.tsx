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
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Repeat } from "lucide-react";
import { format, isSameDay, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendario")({ component: CalPage });

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  recurrence_group_id: string | null;
  recurrence_end_date: string | null;
}

const WEEKDAYS = [
  { idx: 1, label: "L" },
  { idx: 2, label: "M" },
  { idx: 3, label: "X" },
  { idx: 4, label: "J" },
  { idx: 5, label: "V" },
  { idx: 6, label: "S" },
  { idx: 0, label: "D" },
];

function CalPage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Date>(new Date());
  const [openNew, setOpenNew] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["events", household?.id],
    enabled: !!household,
    queryFn: async () => {
      const { data, error } = await supabase.from("events")
        .select("id,title,description,starts_at,recurrence_group_id,recurrence_end_date")
        .eq("household_id", household!.id)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data as EventRow[];
    },
  });

  const dayEvents = events.filter((e) => isSameDay(new Date(e.starts_at), selected));
  const datesWithEvents = events.map((e) => new Date(e.starts_at));

  const delOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const delChain = useMutation({
    mutationFn: async (groupId: string) => {
      const { error } = await supabase.from("events").delete().eq("recurrence_group_id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serie eliminada");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleWeekday = (idx: number) => {
    setWeekdays((prev) => prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx]);
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setWhen("");
    setIsRecurring(false); setWeekdays([]); setEndDate("");
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!when) return;
    setLoading(true);
    try {
      const start = new Date(when);
      if (!isRecurring) {
        const { error } = await supabase.from("events").insert({
          household_id: household!.id, created_by: user!.id,
          title: title.trim(), description: description.trim() || null,
          starts_at: start.toISOString(),
        });
        if (error) throw error;
      } else {
        if (weekdays.length === 0) { toast.error("Elegí al menos un día de la semana"); setLoading(false); return; }
        if (!endDate) { toast.error("Definí una fecha límite"); setLoading(false); return; }
        const end = new Date(endDate + "T23:59:59");
        if (end < start) { toast.error("La fecha límite debe ser posterior al inicio"); setLoading(false); return; }

        const groupId = crypto.randomUUID();
        const rows: Array<{
          household_id: string; created_by: string; title: string;
          description: string | null; starts_at: string;
          recurrence_group_id: string; recurrence_end_date: string;
        }> = [];
        const hours = start.getHours();
        const minutes = start.getMinutes();
        let cursor = new Date(start);
        cursor.setHours(0, 0, 0, 0);
        const limit = new Date(end);
        let safety = 0;
        while (cursor <= limit && safety < 400) {
          if (weekdays.includes(cursor.getDay())) {
            const occ = new Date(cursor);
            occ.setHours(hours, minutes, 0, 0);
            if (occ >= start) {
              rows.push({
                household_id: household!.id, created_by: user!.id,
                title: title.trim(), description: description.trim() || null,
                starts_at: occ.toISOString(),
                recurrence_group_id: groupId,
                recurrence_end_date: endDate,
              });
            }
          }
          cursor = addDays(cursor, 1);
          safety++;
        }
        if (rows.length === 0) { toast.error("Ningún día coincide en el rango"); setLoading(false); return; }
        const { error } = await supabase.from("events").insert(rows);
        if (error) throw error;
        toast.success(`Se crearon ${rows.length} ocurrencias`);
      }
      resetForm();
      setOpenNew(false);
      qc.invalidateQueries({ queryKey: ["events"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendario</h1>
          <p className="text-sm text-muted-foreground">Eventos y recordatorios del hogar</p>
        </div>
        <Dialog open={openNew} onOpenChange={(v) => { setOpenNew(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Nuevo evento</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nuevo evento</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div><Label>Título</Label><Input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>Descripción</Label><Textarea maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
              <div><Label>{isRecurring ? "Inicio (fecha y hora)" : "Fecha y hora"}</Label><Input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></div>

              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Repetir semanalmente</Label>
                  <p className="text-xs text-muted-foreground">Ej: clases de pintura los lunes y miércoles</p>
                </div>
                <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
              </div>

              {isRecurring && (
                <div className="space-y-3 rounded-md border p-3">
                  <div>
                    <Label className="text-sm">Días de la semana</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {WEEKDAYS.map((w) => {
                        const active = weekdays.includes(w.idx);
                        return (
                          <button
                            type="button"
                            key={w.idx}
                            onClick={() => toggleWeekday(w.idx)}
                            className={`h-9 w-9 rounded-full border text-sm font-medium transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">Fecha límite</Label>
                    <Input type="date" required={isRecurring} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    <p className="mt-1 text-xs text-muted-foreground">Se generarán los eventos en el horario indicado hasta esta fecha.</p>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={loading || !title.trim() || !when} className="w-full">{loading ? "Guardando…" : "Crear"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-[auto,1fr]">
        <Card className="p-3">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => d && setSelected(d)}
            locale={es}
            modifiers={{ hasEvent: datesWithEvents }}
            modifiersClassNames={{ hasEvent: "font-bold text-primary" }}
            className="pointer-events-auto"
          />
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">{format(selected, "EEEE d 'de' MMMM", { locale: es })}</h2>
          {dayEvents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sin eventos este día.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {dayEvents.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {e.title}
                      {e.recurrence_group_id && <Repeat className="h-3.5 w-3.5 text-muted-foreground" />}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(e.starts_at), "HH:mm")}
                      {e.recurrence_end_date && ` · hasta ${format(new Date(e.recurrence_end_date), "d MMM yyyy", { locale: es })}`}
                    </div>
                    {e.description && <div className="mt-1 text-sm text-muted-foreground">{e.description}</div>}
                  </div>
                  <button onClick={() => setDeleteTarget(e)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar evento</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.recurrence_group_id
                ? "Este evento forma parte de una serie. ¿Qué querés eliminar?"
                : "¿Eliminar este evento?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {deleteTarget?.recurrence_group_id && (
              <Button
                variant="destructive"
                onClick={() => delChain.mutate(deleteTarget!.recurrence_group_id!)}
                disabled={delChain.isPending}
              >
                Toda la serie
              </Button>
            )}
            <AlertDialogAction onClick={() => deleteTarget && delOne.mutate(deleteTarget.id)} disabled={delOne.isPending}>
              {deleteTarget?.recurrence_group_id ? "Solo este" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
