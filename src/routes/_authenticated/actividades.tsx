import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useAuth } from "@/lib/auth";
import { useRole } from "@/lib/role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, MapPin, CheckCircle2, Circle, Map, Compass } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/actividades")({
  component: ActividadesPage,
});

type ActivityType = "restaurante" | "actividad" | "salida" | "viaje" | "otro";
type ActivityStatus = "pending" | "done";

const TYPES: { key: ActivityType; label: string }[] = [
  { key: "restaurante", label: "Restaurante" },
  { key: "actividad", label: "Actividad" },
  { key: "salida", label: "Salida" },
  { key: "viaje", label: "Viaje" },
  { key: "otro", label: "Otro" },
];

const STATUS_LABELS: Record<ActivityStatus, string> = {
  pending: "Pendiente",
  done: "Hecho",
};

interface Activity {
  id: string;
  name: string;
  type: ActivityType;
  location: string | null;
  notes: string | null;
  status: ActivityStatus;
  created_at: string;
}

function ActividadesPage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const { canManageNonEconomic, isGuest } = useRole();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<Activity | null | undefined>(undefined);
  const [filterType, setFilterType] = useState<ActivityType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<ActivityStatus | "all">("all");

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activities", household?.id],
    enabled: !!household,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activities")
        .select("id,name,type,location,notes,status,created_at")
        .eq("household_id", household!.id)
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Activity[];
    },
  });

  useEffect(() => {
    if (!household) return;
    const ch = supabase
      .channel(`activities-${household.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activities",
          filter: `household_id=eq.${household.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["activities", household.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [household, qc]);

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ActivityStatus }) => {
      const { error } = await supabase
        .from("activities")
        .update({ status: status === "pending" ? "done" : "pending" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["activities", household?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Actividad borrada"),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = activities.filter((a) => {
    if (filterType !== "all" && a.type !== filterType) return false;
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    return true;
  });

  if (isGuest) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-8 text-center">
        <Compass className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Los invitados no pueden ver actividades. Solicitá acceso de integrante.
        </p>
      </div>
    );
  }

  if (!household) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const doneCount = activities.filter((a) => a.status === "done").length;
  const pendingCount = activities.filter((a) => a.status === "pending").length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Map className="h-6 w-6" /> Actividades y Restaurantes
          </h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount} pendiente{pendingCount === 1 ? "" : "s"} · {doneCount} hecho{doneCount === 1 ? "" : "s"}
          </p>
        </div>
        {canManageNonEconomic && (
          <Button onClick={() => setEditing(null)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filterType} onValueChange={(v) => setFilterType(v as ActivityType | "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as ActivityStatus | "all")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="done">Hecho</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Map className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {activities.length === 1 ? "Aún no hay actividades. " : ""}
            {canManageNonEconomic && "Creá la primera."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((a) => (
            <div
              key={a.id}
              className={cn(
                "rounded-xl border bg-card p-4 space-y-2",
                a.status === "done" && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className={cn("font-semibold leading-tight", a.status === "done" && "line-through")}>
                    {a.name}
                  </h3>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {TYPES.find((t) => t.key === a.type)?.label}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {canManageNonEconomic && (
                    <>
                      <button
                        onClick={() => setEditing(a)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Borrar "${a.name}"?`)) del.mutate(a.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {a.location && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{a.location}</span>
                </div>
              )}

              {a.notes && (
                <p className="text-xs text-muted-foreground line-clamp-2">{a.notes}</p>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={() => toggleStatus.mutate({ id: a.id, status: a.status })}
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium transition-colors",
                    a.status === "done" ? "text-green-600" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {a.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                  {STATUS_LABELS[a.status]}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={editing !== undefined}
        onOpenChange={(v) => !v && setEditing(undefined)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? editing.name : "Nueva actividad"}</DialogTitle>
          </DialogHeader>
          {editing !== undefined && (
            <ActivityForm
              existing={editing}
              onDone={() => {
                setEditing(undefined);
                qc.invalidateQueries({ queryKey: ["activities", household?.id] });
              }}
              householdId={household.id}
              userId={user!.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActivityForm({
  existing,
  onDone,
  householdId,
  userId,
}: {
  existing: Activity | null;
  onDone: () => void;
  householdId: string;
  userId: string;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState<ActivityType>(existing?.type ?? "otro");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [status, setStatus] = useState<ActivityStatus>(existing?.status ?? "pending");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      name: name.trim(),
      type,
      location: location.trim() || null,
      notes: notes.trim() || null,
      status,
    };
    const { error } = existing
      ? await supabase.from("activities").update(payload).eq("id", existing.id)
      : await supabase
          .from("activities")
          .insert({ ...payload, household_id: householdId, created_by: userId });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Actividad actualizada" : "Actividad creada");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Nombre</Label>
        <Input
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="Ej: Restaurante El Patio, Parque de diversiones"
        />
      </div>
      <div>
        <Label>Tipo</Label>
        <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Ubicación</Label>
        <Input
          maxLength={200}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Dirección o zona"
        />
      </div>
      <div>
        <Label>Notas</Label>
        <Textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Horarios, precios, recomendaciones…"
        />
      </div>
      {existing && (
        <div>
          <Label>Estado</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ActivityStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="done">Hecho</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      <Button type="submit" disabled={loading || !name.trim()} className="w-full">
        {loading ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
