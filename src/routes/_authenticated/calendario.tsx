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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendario")({ component: CalPage });

interface Event { id: string; title: string; description: string | null; starts_at: string }

function CalPage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Date>(new Date());
  const [openNew, setOpenNew] = useState(false);

  const { data: events = [] } = useQuery({
    queryKey: ["events", household?.id],
    enabled: !!household,
    queryFn: async () => {
      const { data, error } = await supabase.from("events")
        .select("id,title,description,starts_at")
        .eq("household_id", household!.id)
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data as Event[];
    },
  });

  const dayEvents = events.filter((e) => isSameDay(new Date(e.starts_at), selected));
  const datesWithEvents = events.map((e) => new Date(e.starts_at));

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [when, setWhen] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("events").insert({
      household_id: household!.id, created_by: user!.id,
      title: title.trim(), description: description.trim() || null,
      starts_at: new Date(when).toISOString(),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setTitle(""); setDescription(""); setWhen(""); setOpenNew(false);
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendario</h1>
          <p className="text-sm text-muted-foreground">Eventos y recordatorios del hogar</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Nuevo evento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo evento</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div><Label>Título</Label><Input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label>Descripción</Label><Textarea maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
              <div><Label>Fecha y hora</Label><Input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} /></div>
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
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(e.starts_at), "HH:mm")}</div>
                    {e.description && <div className="mt-1 text-sm text-muted-foreground">{e.description}</div>}
                  </div>
                  <button onClick={() => del.mutate(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
