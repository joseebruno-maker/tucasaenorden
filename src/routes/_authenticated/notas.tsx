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
import { Plus, Pencil, Trash2, StickyNote, ListChecks, X, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notas")({
  component: NotasPage,
});

type NoteKind = "list" | "note";

interface Note {
  id: string;
  title: string;
  kind: NoteKind;
  content: string | null;
  color: string;
  created_at: string;
  updated_at: string;
}

interface NoteItem {
  id: string;
  note_id: string;
  text: string;
  done: boolean;
  position: number;
}

const COLORS = [
  "#fde68a", // amarillo
  "#fecaca", // rosa
  "#bbf7d0", // verde
  "#bfdbfe", // azul
  "#ddd6fe", // violeta
  "#fed7aa", // naranja
];

function NotasPage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const { canManageNonEconomic, isGuest } = useRole();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<Note | null | undefined>(undefined);
  const [openNote, setOpenNote] = useState<Note | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes", household?.id],
    enabled: !!household,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("id,title,kind,content,color,created_at,updated_at")
        .eq("household_id", household!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  useEffect(() => {
    if (!household) return;
    const ch = supabase
      .channel(`notes-${household.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notes", filter: `household_id=eq.${household.id}` },
        () => qc.invalidateQueries({ queryKey: ["notes", household.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "note_items", filter: `household_id=eq.${household.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["note-items"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [household, qc]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Eliminado"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isGuest) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-8 text-center">
        <StickyNote className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Los invitados no pueden ver notas. Solicitá acceso de integrante.
        </p>
      </div>
    );
  }

  if (!household) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <StickyNote className="h-6 w-6" /> Notas y Listas
          </h1>
          <p className="text-sm text-muted-foreground">
            Compras de viaje, regalos, cumpleaños y todo lo que quieran compartir.
          </p>
        </div>
        {canManageNonEconomic && (
          <Button onClick={() => setEditing(null)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : notes.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <StickyNote className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Sin notas todavía. {canManageNonEconomic && "Creá la primera."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => setOpenNote(n)}
              className="text-left rounded-xl border p-4 space-y-2 transition-transform hover:scale-[1.01] hover:shadow-md"
              style={{ backgroundColor: n.color }}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight text-zinc-900 flex items-center gap-1.5">
                  {n.kind === "list" ? (
                    <ListChecks className="h-4 w-4 shrink-0" />
                  ) : (
                    <StickyNote className="h-4 w-4 shrink-0" />
                  )}
                  {n.title}
                </h3>
                {canManageNonEconomic && (
                  <div className="flex gap-1 shrink-0">
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(n);
                      }}
                      className="text-zinc-700 hover:text-zinc-900"
                    >
                      <Pencil className="h-4 w-4" />
                    </span>
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`¿Borrar "${n.title}"?`)) del.mutate(n.id);
                      }}
                      className="text-zinc-700 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </span>
                  </div>
                )}
              </div>
              {n.kind === "note" && n.content && (
                <p className="text-xs text-zinc-800 line-clamp-4 whitespace-pre-wrap">{n.content}</p>
              )}
              {n.kind === "list" && (
                <ListPreview noteId={n.id} householdId={household.id} />
              )}
            </button>
          ))}
        </div>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(v) => !v && setEditing(undefined)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Nueva nota o lista"}</DialogTitle>
          </DialogHeader>
          {editing !== undefined && (
            <NoteForm
              existing={editing}
              householdId={household.id}
              userId={user!.id}
              onDone={() => {
                setEditing(undefined);
                qc.invalidateQueries({ queryKey: ["notes", household.id] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!openNote} onOpenChange={(v) => !v && setOpenNote(null)}>
        <DialogContent className="max-w-lg">
          {openNote && (
            <NoteDetail
              note={openNote}
              householdId={household.id}
              userId={user!.id}
              canEdit={canManageNonEconomic}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ListPreview({ noteId, householdId }: { noteId: string; householdId: string }) {
  const { data: items = [] } = useQuery({
    queryKey: ["note-items", noteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_items")
        .select("id,note_id,text,done,position")
        .eq("note_id", noteId)
        .eq("household_id", householdId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as NoteItem[];
    },
  });
  const done = items.filter((i) => i.done).length;
  return (
    <div className="space-y-1">
      <div className="text-xs text-zinc-700">
        {done}/{items.length} hechos
      </div>
      <ul className="space-y-0.5">
        {items.slice(0, 4).map((i) => (
          <li
            key={i.id}
            className={cn(
              "text-xs text-zinc-800 flex items-center gap-1",
              i.done && "line-through opacity-60",
            )}
          >
            {i.done ? <Check className="h-3 w-3" /> : <span className="h-3 w-3 rounded-sm border border-zinc-600" />}
            <span className="truncate">{i.text}</span>
          </li>
        ))}
        {items.length > 4 && <li className="text-xs text-zinc-700">+{items.length - 4} más…</li>}
      </ul>
    </div>
  );
}

function NoteForm({
  existing,
  householdId,
  userId,
  onDone,
}: {
  existing: Note | null;
  householdId: string;
  userId: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [kind, setKind] = useState<NoteKind>(existing?.kind ?? "note");
  const [content, setContent] = useState(existing?.content ?? "");
  const [color, setColor] = useState(existing?.color ?? COLORS[0]);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      title: title.trim(),
      kind,
      content: kind === "note" ? content.trim() || null : null,
      color,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing
      ? await supabase.from("notes").update(payload).eq("id", existing.id)
      : await supabase.from("notes").insert({ ...payload, household_id: householdId, created_by: userId });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Actualizado" : "Creado");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Título</Label>
        <Input
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          placeholder="Ej: Cumpleaños familia, Regalos navidad"
        />
      </div>
      <div>
        <Label>Tipo</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as NoteKind)} disabled={!!existing}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="note">Nota de texto</SelectItem>
            <SelectItem value="list">Lista con ítems</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {kind === "note" && (
        <div>
          <Label>Contenido</Label>
          <Textarea
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribí acá…"
          />
        </div>
      )}
      <div>
        <Label>Color</Label>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "h-8 w-8 rounded-full border-2 transition-transform",
                color === c ? "border-foreground scale-110" : "border-transparent",
              )}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </div>
      <Button type="submit" disabled={loading || !title.trim()} className="w-full">
        {loading ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

function NoteDetail({
  note,
  householdId,
  userId,
  canEdit,
}: {
  note: Note;
  householdId: string;
  userId: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const [newItem, setNewItem] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["note-items", note.id],
    enabled: note.kind === "list",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_items")
        .select("id,note_id,text,done,position")
        .eq("note_id", note.id)
        .eq("household_id", householdId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as NoteItem[];
    },
  });

  const addItem = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from("note_items").insert({
        note_id: note.id,
        household_id: householdId,
        created_by: userId,
        text: text.trim(),
        position: items.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewItem("");
      qc.invalidateQueries({ queryKey: ["note-items", note.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("note_items").update({ done: !done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["note-items", note.id] }),
  });

  const delItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("note_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["note-items", note.id] }),
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {note.kind === "list" ? <ListChecks className="h-5 w-5" /> : <StickyNote className="h-5 w-5" />}
          {note.title}
        </DialogTitle>
      </DialogHeader>
      {note.kind === "note" ? (
        <div className="rounded-md p-3 text-sm whitespace-pre-wrap text-zinc-900" style={{ backgroundColor: note.color }}>
          {note.content || <span className="text-zinc-600 italic">Sin contenido.</span>}
        </div>
      ) : (
        <div className="space-y-2">
          <ul className="space-y-1 max-h-[50vh] overflow-y-auto">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleItem.mutate({ id: i.id, done: i.done })}
                  disabled={!canEdit}
                  className={cn(
                    "h-5 w-5 rounded border flex items-center justify-center shrink-0",
                    i.done ? "bg-primary border-primary text-primary-foreground" : "border-input",
                  )}
                >
                  {i.done && <Check className="h-3 w-3" />}
                </button>
                <span className={cn("flex-1 text-sm", i.done && "line-through text-muted-foreground")}>
                  {i.text}
                </span>
                {canEdit && (
                  <button
                    onClick={() => delItem.mutate(i.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
            {items.length === 0 && (
              <li className="text-sm text-muted-foreground italic">Sin ítems todavía.</li>
            )}
          </ul>
          {canEdit && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (newItem.trim()) addItem.mutate(newItem);
              }}
              className="flex gap-2 pt-2 border-t"
            >
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Agregar ítem…"
                maxLength={200}
              />
              <Button type="submit" size="sm" disabled={!newItem.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
