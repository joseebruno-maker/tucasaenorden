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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, UtensilsCrossed, ChefHat } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recetario")({
  component: RecetarioPage,
});

type Meal = "breakfast" | "lunch" | "snack" | "dinner";
const MEALS: { key: Meal; label: string }[] = [
  { key: "breakfast", label: "Desayuno" },
  { key: "lunch", label: "Almuerzo" },
  { key: "snack", label: "Merienda" },
  { key: "dinner", label: "Cena" },
];

interface Recipe {
  id: string;
  name: string;
  ingredients: string[];
  steps: string[];
  created_at: string;
}

function RecetarioPage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const { canManageNonEconomic } = useRole();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<Recipe | null | undefined>(undefined);
  const [useFor, setUseFor] = useState<Recipe | null>(null);

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes", household?.id],
    enabled: !!household,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id,name,ingredients,steps,created_at")
        .eq("household_id", household!.id)
        .order("name");
      if (error) throw error;
      return data as Recipe[];
    },
  });

  useEffect(() => {
    if (!household) return;
    const ch = supabase
      .channel(`recipes-${household.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recipes",
          filter: `household_id=eq.${household.id}`,
        },
        () => qc.invalidateQueries({ queryKey: ["recipes", household.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [household, qc]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recipes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Receta borrada"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!household) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6" /> Recetario
          </h1>
          <p className="text-sm text-muted-foreground">Recetas de la familia</p>
        </div>
        {canManageNonEconomic && (
          <Button onClick={() => setEditing(null)} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nueva
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : recipes.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <ChefHat className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Aún no hay recetas. {canManageNonEconomic && "Creá la primera."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipes.map((r) => (
            <div key={r.id} className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">{r.name}</h3>
                {canManageNonEconomic && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setEditing(r)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`¿Borrar "${r.name}"?`)) del.mutate(r.id);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {r.ingredients.length} ingrediente{r.ingredients.length === 1 ? "" : "s"} ·{" "}
                {r.steps.length} paso{r.steps.length === 1 ? "" : "s"}
              </div>
              {r.ingredients.length > 0 && (
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {r.ingredients.slice(0, 4).join(", ")}
                  {r.ingredients.length > 4 && "…"}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditing(r)}
                >
                  Ver
                </Button>
                {canManageNonEconomic && (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => setUseFor(r)}
                  >
                    <UtensilsCrossed className="h-3.5 w-3.5 mr-1" /> Al menú
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={editing !== undefined}
        onOpenChange={(v) => !v && setEditing(undefined)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? editing.name : "Nueva receta"}</DialogTitle>
          </DialogHeader>
          {editing !== undefined && (
            <RecipeForm
              existing={editing}
              readOnly={!canManageNonEconomic}
              onDone={() => {
                setEditing(undefined);
                qc.invalidateQueries({ queryKey: ["recipes", household?.id] });
              }}
              householdId={household.id}
              userId={user!.id}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!useFor} onOpenChange={(v) => !v && setUseFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Llevar al menú</DialogTitle>
          </DialogHeader>
          {useFor && (
            <UseInMenuForm
              recipe={useFor}
              householdId={household.id}
              userId={user!.id}
              onDone={() => setUseFor(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecipeForm({
  existing,
  readOnly,
  onDone,
  householdId,
  userId,
}: {
  existing: Recipe | null;
  readOnly: boolean;
  onDone: () => void;
  householdId: string;
  userId: string;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [ingredientsText, setIngredientsText] = useState(
    existing?.ingredients.join("\n") ?? "",
  );
  const [stepsText, setStepsText] = useState(existing?.steps.join("\n") ?? "");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const ingredients = ingredientsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const steps = stepsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = { name: name.trim(), ingredients, steps };
    const { error } = existing
      ? await supabase.from("recipes").update(payload).eq("id", existing.id)
      : await supabase
          .from("recipes")
          .insert({ ...payload, household_id: householdId, created_by: userId });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Receta actualizada" : "Receta creada");
    onDone();
  };

  if (readOnly) {
    return (
      <div className="space-y-3 text-sm">
        <div>
          <h4 className="font-semibold mb-1">Ingredientes</h4>
          {existing && existing.ingredients.length > 0 ? (
            <ul className="list-disc pl-5 space-y-0.5">
              {existing.ingredients.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">Sin ingredientes</p>
          )}
        </div>
        <div>
          <h4 className="font-semibold mb-1">Pasos</h4>
          {existing && existing.steps.length > 0 ? (
            <ol className="list-decimal pl-5 space-y-1">
              {existing.steps.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">Sin pasos</p>
          )}
        </div>
      </div>
    );
  }

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
        />
      </div>
      <div>
        <Label>Ingredientes (uno por línea)</Label>
        <Textarea
          rows={5}
          value={ingredientsText}
          onChange={(e) => setIngredientsText(e.target.value)}
          placeholder={"2 huevos\n200g harina\nSal a gusto"}
        />
      </div>
      <div>
        <Label>Pasos (uno por línea)</Label>
        <Textarea
          rows={6}
          value={stepsText}
          onChange={(e) => setStepsText(e.target.value)}
          placeholder={"Mezclar los secos\nAgregar los huevos\nHornear 30 min"}
        />
      </div>
      <Button type="submit" disabled={loading || !name.trim()} className="w-full">
        {loading ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

function UseInMenuForm({
  recipe,
  householdId,
  userId,
  onDone,
}: {
  recipe: Recipe;
  householdId: string;
  userId: string;
  onDone: () => void;
}) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [meal, setMeal] = useState<Meal>("lunch");
  const [loading, setLoading] = useState(false);
  const [askIngredients, setAskIngredients] = useState<boolean>(false);

  const assign = async (addIngredients: boolean) => {
    setLoading(true);
    const { error } = await supabase
      .from("menu_entries")
      .upsert(
        {
          household_id: householdId,
          created_by: userId,
          date,
          meal,
          title: recipe.name,
          notes:
            recipe.ingredients.length > 0
              ? recipe.ingredients.join(", ")
              : null,
        },
        { onConflict: "household_id,date,meal" },
      );
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    if (addIngredients && recipe.ingredients.length > 0) {
      const rows = recipe.ingredients.map((name) => ({
        household_id: householdId,
        created_by: userId,
        name,
        category: recipe.name,
      }));
      const { error: shopErr } = await supabase.from("shopping_items").insert(rows);
      if (shopErr) {
        setLoading(false);
        return toast.error(shopErr.message);
      }
    }
    setLoading(false);
    toast.success(
      addIngredients ? "Asignado al menú + ingredientes a compras" : "Asignado al menú",
    );
    onDone();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (recipe.ingredients.length > 0) {
      setAskIngredients(true);
    } else {
      void assign(false);
    }
  };

  if (askIngredients) {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          ¿Agregar los {recipe.ingredients.length} ingredientes a la lista de compras?
        </p>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => void assign(false)}
          >
            No, solo al menú
          </Button>
          <Button disabled={loading} onClick={() => void assign(true)}>
            Sí, agregar
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        <strong>{recipe.name}</strong>
      </p>
      <div>
        <Label>Fecha</Label>
        <Input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div>
        <Label>Momento</Label>
        <Select value={meal} onValueChange={(v) => setMeal(v as Meal)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEALS.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        Asignar
      </Button>
    </form>
  );
}
