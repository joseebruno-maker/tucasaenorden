import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/compras")({ component: ComprasPage });

interface Item { id: string; name: string; qty: string | null; category: string | null; bought: boolean }

function ComprasPage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [category, setCategory] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["shopping", household?.id],
    enabled: !!household,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopping_items")
        .select("id,name,qty,category,bought")
        .eq("household_id", household!.id)
        .order("bought", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Item[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shopping_items").insert({
        household_id: household!.id, created_by: user!.id,
        name: name.trim(), qty: qty.trim() || null, category: category.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); setQty(""); setCategory(""); qc.invalidateQueries({ queryKey: ["shopping"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (it: Item) => {
      const { error } = await supabase.from("shopping_items").update({ bought: !it.bought }).eq("id", it.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shopping_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });

  const clearBought = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("shopping_items").delete().eq("household_id", household!.id).eq("bought", true);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopping"] }),
  });

  const onAdd = (e: FormEvent) => { e.preventDefault(); if (name.trim()) add.mutate(); };

  const pending = items.filter((i) => !i.bought);
  const done = items.filter((i) => i.bought);

  // group pending by category
  const groups = pending.reduce<Record<string, Item[]>>((acc, it) => {
    const k = it.category?.trim() || "Sin categoría";
    (acc[k] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lista de compras</h1>
        <p className="text-sm text-muted-foreground">{pending.length} por comprar · {done.length} listas</p>
      </div>

      <Card className="p-4">
        <form onSubmit={onAdd} className="flex flex-wrap gap-2">
          <Input placeholder="Producto" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className="flex-1 min-w-40" />
          <Input placeholder="Cantidad" value={qty} onChange={(e) => setQty(e.target.value)} maxLength={20} className="w-24" />
          <Input placeholder="Categoría" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={30} className="w-32" />
          <Button type="submit" disabled={add.isPending}><Plus className="h-4 w-4 mr-1" />Agregar</Button>
        </form>
      </Card>

      {Object.entries(groups).map(([cat, list]) => (
        <Card key={cat} className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{cat}</h3>
          <ul className="space-y-1">
            {list.map((it) => (
              <li key={it.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/50">
                <Checkbox checked={it.bought} onCheckedChange={() => toggle.mutate(it)} />
                <span className="flex-1">{it.name}{it.qty && <span className="ml-2 text-sm text-muted-foreground">× {it.qty}</span>}</span>
                <button onClick={() => del.mutate(it.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      {done.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">Compradas</h3>
            <button onClick={() => clearBought.mutate()} className="text-xs text-destructive hover:underline">Vaciar</button>
          </div>
          <ul className="mt-2 space-y-1">
            {done.map((it) => (
              <li key={it.id} className="flex items-center gap-3 rounded-md px-2 py-2 opacity-60">
                <Checkbox checked onCheckedChange={() => toggle.mutate(it)} />
                <span className="flex-1 line-through">{it.name}</span>
                <button onClick={() => del.mutate(it.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {items.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">La lista está vacía. Agregá tu primer producto arriba.</p>
      )}
    </div>
  );
}
