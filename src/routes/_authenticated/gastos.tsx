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
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Wallet, Plus, Pencil, Trash2, Lock, ChevronLeft, ChevronRight, Tag, Users,
  Search, Download, Repeat, AlertTriangle, BarChart3, History,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/gastos")({
  component: GastosPage,
});

type Permission = "none" | "view" | "edit";

interface Category {
  id: string;
  name: string;
  color: string;
  monthly_budget: number | null;
}

interface Expense {
  id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  spent_at: string;
  created_by: string;
  recurring_id: string | null;
}

interface Recurring {
  id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  day_of_month: number;
  active: boolean;
}

interface MemberRow {
  user_id: string;
  display_name: string;
  permission: Permission;
}

const CURRENCY = "Bs.";
const ALERT_PCT = 80;
const fmt = (n: number) =>
  `${CURRENCY} ${n.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
    label: start.toLocaleDateString("es", { month: "long", year: "numeric" }),
  };
}

function GastosPage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const qc = useQueryClient();

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [editingExp, setEditingExp] = useState<Expense | null | undefined>(undefined);
  const [editingCat, setEditingCat] = useState<Category | null | undefined>(undefined);
  const [editingRec, setEditingRec] = useState<Recurring | null | undefined>(undefined);
  const [historyTarget, setHistoryTarget] = useState<
    { type: "expense" | "category"; id: string; label: string } | null
  >(null);

  // filters
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");

  const { data: myPerm = "none" as Permission, isLoading: loadingPerm } = useQuery({
    queryKey: ["expense-perm", household?.id, user?.id],
    enabled: !!household && !!user,
    queryFn: async () => {
      if (isAdmin) return "edit" as Permission;
      const { data, error } = await supabase
        .from("expense_permissions")
        .select("permission")
        .eq("household_id", household!.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.permission as Permission) ?? "none";
    },
  });

  const canView = myPerm === "view" || myPerm === "edit" || isAdmin;
  const canEdit = myPerm === "edit" || isAdmin;

  const bounds = useMemo(() => monthBounds(month), [month]);

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories", household?.id],
    enabled: !!household && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id,name,color,monthly_budget")
        .eq("household_id", household!.id)
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", household?.id, month],
    enabled: !!household && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id,category_id,amount,description,spent_at,created_by,recurring_id")
        .eq("household_id", household!.id)
        .gte("spent_at", bounds.start)
        .lte("spent_at", bounds.end)
        .order("spent_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, amount: Number(e.amount) })) as Expense[];
    },
  });

  // Last 6 months for chart
  const { data: trend = [] } = useQuery({
    queryKey: ["expenses-trend", household?.id, month],
    enabled: !!household && canView,
    queryFn: async () => {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(y, m - 6, 1);
      const startStr = format(start, "yyyy-MM-dd");
      const end = new Date(y, m, 0);
      const endStr = format(end, "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("expenses")
        .select("amount,spent_at")
        .eq("household_id", household!.id)
        .gte("spent_at", startStr)
        .lte("spent_at", endStr);
      if (error) throw error;
      const map = new Map<string, number>();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(y, m - 1 - i, 1);
        map.set(format(d, "yyyy-MM"), 0);
      }
      for (const e of data ?? []) {
        const ym = (e.spent_at as string).slice(0, 7);
        map.set(ym, (map.get(ym) ?? 0) + Number(e.amount));
      }
      return Array.from(map.entries()).map(([ym, total]) => {
        const [yy, mm] = ym.split("-").map(Number);
        return {
          ym,
          label: new Date(yy, mm - 1, 1).toLocaleDateString("es", { month: "short" }),
          total,
        };
      });
    },
  });

  const { data: recurring = [] } = useQuery({
    queryKey: ["recurring-expenses", household?.id],
    enabled: !!household && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_expenses")
        .select("id,category_id,amount,description,day_of_month,active")
        .eq("household_id", household!.id)
        .order("day_of_month");
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, amount: Number(r.amount) })) as Recurring[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["household-members-min", household?.id],
    enabled: !!household && canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("user_id, profile:profiles(display_name)")
        .eq("household_id", household!.id);
      if (error) throw error;
      return (data ?? []).map((m) => ({
        user_id: m.user_id,
        name:
          (m.profile as { display_name?: string } | null)?.display_name ?? "Integrante",
      }));
    },
  });

  const memberName = (uid: string) =>
    members.find((m) => m.user_id === uid)?.name ?? "—";

  // Materialize recurring expenses for current month on load (if user can edit).
  const isCurrentMonth = month === format(new Date(), "yyyy-MM");
  useEffect(() => {
    if (!household || !canEdit || !isCurrentMonth || recurring.length === 0) return;
    (async () => {
      const { data, error } = await supabase.rpc("ensure_recurring_expenses", {
        _household_id: household.id,
        _ym: month,
      });
      if (!error && (data ?? 0) > 0) {
        qc.invalidateQueries({ queryKey: ["expenses", household.id, month] });
      }
    })();
  }, [household, canEdit, month, isCurrentMonth, recurring.length, qc]);

  useEffect(() => {
    if (!household || !canView) return;
    const ch = supabase
      .channel(`gastos-${household.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: `household_id=eq.${household.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["expenses", household.id] });
          qc.invalidateQueries({ queryKey: ["expenses-trend", household.id] });
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "expense_categories", filter: `household_id=eq.${household.id}` },
        () => qc.invalidateQueries({ queryKey: ["expense-categories", household.id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "recurring_expenses", filter: `household_id=eq.${household.id}` },
        () => qc.invalidateQueries({ queryKey: ["recurring-expenses", household.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [household, canView, qc]);

  const delExp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Gasto borrado"),
    onError: (e: Error) => toast.error(e.message),
  });

  const delCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Categoría borrada"),
    onError: (e: Error) => toast.error(e.message),
  });

  const delRec = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => toast.success("Gasto recurrente eliminado"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!household) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (loadingPerm) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  if (!canView) {
    return (
      <div className="mx-auto max-w-md text-center rounded-xl border bg-card p-8 mt-8">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
        <h2 className="font-semibold mb-1">Sin acceso</h2>
        <p className="text-sm text-muted-foreground">
          No tenés permiso para ver los gastos. Pedile al admin del hogar que te dé acceso.
        </p>
      </div>
    );
  }

  const catTotals = new Map<string | null, number>();
  let total = 0;
  for (const e of expenses) {
    catTotals.set(e.category_id, (catTotals.get(e.category_id) ?? 0) + e.amount);
    total += e.amount;
  }
  const totalBudget = categories.reduce((s, c) => s + (Number(c.monthly_budget) || 0), 0);

  // Filtered expenses for "gastos" tab
  const filteredExpenses = expenses.filter((e) => {
    if (filterCat !== "all") {
      if (filterCat === "none" ? e.category_id !== null : e.category_id !== filterCat) return false;
    }
    if (filterUser !== "all" && e.created_by !== filterUser) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const cat = categories.find((c) => c.id === e.category_id);
      const blob = `${e.description ?? ""} ${cat?.name ?? ""}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
  const filteredTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0);

  // Pie data
  const pieData = categories
    .map((c) => ({ name: c.name, value: catTotals.get(c.id) ?? 0, color: c.color }))
    .filter((d) => d.value > 0);
  const noCat = catTotals.get(null) ?? 0;
  if (noCat > 0) pieData.push({ name: "Sin categoría", value: noCat, color: "#94a3b8" });

  // Alerts
  const alerts = categories
    .map((c) => {
      const spent = catTotals.get(c.id) ?? 0;
      const budget = Number(c.monthly_budget) || 0;
      if (budget <= 0) return null;
      const pct = (spent / budget) * 100;
      if (pct < ALERT_PCT) return null;
      return { c, spent, budget, pct, over: spent > budget };
    })
    .filter((x): x is { c: Category; spent: number; budget: number; pct: number; over: boolean } => !!x);

  const prevMonth = () => {
    const [y, m] = month.split("-").map(Number);
    setMonth(format(new Date(y, m - 2, 1), "yyyy-MM"));
  };
  const nextMonth = () => {
    const [y, m] = month.split("-").map(Number);
    setMonth(format(new Date(y, m, 1), "yyyy-MM"));
  };

  const exportCsv = () => {
    const rows = [["Fecha", "Categoría", "Descripción", "Monto", "Registrado por"]];
    for (const e of filteredExpenses) {
      const cat = categories.find((c) => c.id === e.category_id);
      rows.push([
        e.spent_at,
        cat?.name ?? "Sin categoría",
        (e.description ?? "").replace(/"/g, '""'),
        e.amount.toFixed(2),
        memberName(e.created_by),
      ]);
    }
    const csv = rows
      .map((r) => r.map((v) => `"${String(v)}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gastos-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Gastos
          </h1>
          <p className="text-sm text-muted-foreground">Presupuesto y control de gastos</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setEditingExp(null)}>
            <Plus className="h-4 w-4 mr-1" /> Gasto
          </Button>
        )}
      </div>

      <Tabs defaultValue="resumen">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="resumen" className="flex-1">Resumen</TabsTrigger>
          <TabsTrigger value="gastos" className="flex-1">Gastos</TabsTrigger>
          <TabsTrigger value="recurrentes" className="flex-1">
            <Repeat className="h-3.5 w-3.5 mr-1" />Recurrentes
          </TabsTrigger>
          <TabsTrigger value="categorias" className="flex-1">Categorías</TabsTrigger>
          <TabsTrigger value="historial" className="flex-1">
            <History className="h-3.5 w-3.5 mr-1" />Historial
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="permisos" className="flex-1">
              <Users className="h-3.5 w-3.5 mr-1" />Permisos
            </TabsTrigger>
          )}
        </TabsList>

        {/* Month picker */}
        <div className="mt-3 flex items-center justify-between rounded-lg border bg-card p-2">
          <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-sm font-medium capitalize">{bounds.label}</span>
          <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>

        <TabsContent value="resumen" className="space-y-3">
          {/* Total */}
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Total del mes</div>
            <div className="text-2xl font-bold">{fmt(total)}</div>
            {totalBudget > 0 && (
              <div className="mt-2 space-y-1">
                <Progress value={Math.min(100, (total / totalBudget) * 100)} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Presupuesto: {fmt(totalBudget)}</span>
                  <span className={total > totalBudget ? "text-destructive font-medium" : ""}>
                    {totalBudget - total >= 0 ? `Resta ${fmt(totalBudget - total)}` : `Excede ${fmt(total - totalBudget)}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
                <AlertTriangle className="h-4 w-4" /> Alertas de presupuesto
              </div>
              {alerts.map(({ c, spent, budget, pct, over }) => (
                <div key={c.id} className="text-xs flex justify-between">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className={over ? "text-destructive font-medium" : "text-amber-700 dark:text-amber-400"}>
                    {pct.toFixed(0)}% · {fmt(spent)} / {fmt(budget)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          {(pieData.length > 0 || trend.some((t) => t.total > 0)) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pieData.length > 0 && (
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" /> Distribución por categoría
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
              {trend.some((t) => t.total > 0) && (
                <div className="rounded-xl border bg-card p-3">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" /> Últimos 6 meses
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer>
                      <BarChart data={trend}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={50} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Per-category */}
          <div className="space-y-2">
            {categories.length === 0 && (catTotals.get(null) ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin gastos este mes.</p>
            ) : (
              <>
                {categories.map((c) => {
                  const spent = catTotals.get(c.id) ?? 0;
                  const budget = Number(c.monthly_budget) || 0;
                  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                  const over = budget > 0 && spent > budget;
                  const warn = budget > 0 && !over && (spent / budget) * 100 >= ALERT_PCT;
                  return (
                    <div key={c.id} className="rounded-lg border bg-card p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="font-medium truncate">{c.name}</span>
                        </div>
                        <span className={`text-sm font-semibold ${over ? "text-destructive" : warn ? "text-amber-600 dark:text-amber-400" : ""}`}>
                          {fmt(spent)}
                        </span>
                      </div>
                      {budget > 0 ? (
                        <>
                          <Progress value={pct} />
                          <div className="mt-1 text-xs text-muted-foreground flex justify-between">
                            <span>Presupuesto: {fmt(budget)}</span>
                            <span>{((spent / budget) * 100).toFixed(0)}%</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">Sin presupuesto</div>
                      )}
                    </div>
                  );
                })}
                {(catTotals.get(null) ?? 0) > 0 && (
                  <div className="rounded-lg border bg-card p-3 flex justify-between">
                    <span className="text-muted-foreground">Sin categoría</span>
                    <span className="font-semibold">{fmt(catTotals.get(null)!)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="gastos" className="space-y-2">
          {/* Filters */}
          <div className="rounded-lg border bg-card p-2 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por descripción o categoría…"
                className="pl-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger><SelectValue placeholder="Categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger><SelectValue placeholder="Persona" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las personas</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {filteredExpenses.length} de {expenses.length} · <span className="font-medium text-foreground">{fmt(filteredTotal)}</span>
              </span>
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={filteredExpenses.length === 0}>
                <Download className="h-3.5 w-3.5 mr-1" /> CSV
              </Button>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin gastos.</p>
          ) : (
            filteredExpenses.map((e) => {
              const cat = categories.find((c) => c.id === e.category_id);
              return (
                <div key={e.id} className="rounded-lg border bg-card p-3 flex items-start gap-3">
                  <span className="h-3 w-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: cat?.color ?? "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium truncate flex items-center gap-1">
                        {e.description || cat?.name || "Gasto"}
                        {e.recurring_id && <Repeat className="h-3 w-3 text-muted-foreground" />}
                      </span>
                      <span className="font-semibold shrink-0">{fmt(e.amount)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {cat?.name ?? "Sin categoría"} · {format(new Date(e.spent_at + "T00:00"), "dd/MM/yyyy")} · {memberName(e.created_by)}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setHistoryTarget({ type: "expense", id: e.id, label: e.description || cat?.name || "Gasto" })}
                      className="text-muted-foreground hover:text-foreground"
                      title="Historial"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    {canEdit && (
                      <>
                        <button onClick={() => setEditingExp(e)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => { if (confirm("¿Borrar gasto?")) delExp.mutate(e.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="recurrentes" className="space-y-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditingRec(null)} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Nuevo gasto recurrente
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Se generan automáticamente cada mes (alquiler, servicios, suscripciones…).
          </p>
          {recurring.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin gastos recurrentes.</p>
          ) : (
            recurring.map((r) => {
              const cat = categories.find((c) => c.id === r.category_id);
              return (
                <div key={r.id} className={`rounded-lg border bg-card p-3 flex items-start gap-3 ${!r.active ? "opacity-60" : ""}`}>
                  <span className="h-3 w-3 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: cat?.color ?? "#94a3b8" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium truncate">{r.description || cat?.name || "Recurrente"}</span>
                      <span className="font-semibold shrink-0">{fmt(r.amount)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {cat?.name ?? "Sin categoría"} · día {r.day_of_month} {!r.active && "· pausado"}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditingRec(r)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm("¿Eliminar el gasto recurrente? Los ya registrados se mantienen.")) delRec.mutate(r.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="categorias" className="space-y-2">
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditingCat(null)} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Nueva categoría
            </Button>
          )}
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin categorías.</p>
          ) : (
            categories.map((c) => (
              <div key={c.id} className="rounded-lg border bg-card p-3 flex items-center gap-3">
                <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.monthly_budget ? `Presupuesto: ${fmt(Number(c.monthly_budget))}` : "Sin presupuesto"}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setHistoryTarget({ type: "category", id: c.id, label: c.name })}
                    className="text-muted-foreground hover:text-foreground"
                    title="Historial"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  {canEdit && (
                    <>
                      <button onClick={() => setEditingCat(c)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`¿Borrar "${c.name}"? Los gastos quedarán sin categoría.`)) delCat.mutate(c.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="historial">
          <HistoryPanel
            householdId={household.id}
            monthStart={bounds.start}
            monthEnd={bounds.end}
            monthLabel={bounds.label}
            categories={categories}
            memberName={memberName}
          />
        </TabsContent>



        {isAdmin && (
          <TabsContent value="permisos">
            <PermissionsPanel householdId={household.id} myUserId={user!.id} />
          </TabsContent>
        )}
      </Tabs>

      {/* Expense form */}
      <Dialog open={editingExp !== undefined} onOpenChange={(v) => !v && setEditingExp(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExp ? "Editar gasto" : "Nuevo gasto"}</DialogTitle>
          </DialogHeader>
          {editingExp !== undefined && (
            <ExpenseForm
              existing={editingExp}
              categories={categories}
              householdId={household.id}
              userId={user!.id}
              onDone={() => setEditingExp(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Category form */}
      <Dialog open={editingCat !== undefined} onOpenChange={(v) => !v && setEditingCat(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          {editingCat !== undefined && (
            <CategoryForm
              existing={editingCat}
              householdId={household.id}
              userId={user!.id}
              onDone={() => setEditingCat(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Recurring form */}
      <Dialog open={editingRec !== undefined} onOpenChange={(v) => !v && setEditingRec(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRec ? "Editar gasto recurrente" : "Nuevo gasto recurrente"}</DialogTitle>
          </DialogHeader>
          {editingRec !== undefined && (
            <RecurringForm
              existing={editingRec}
              categories={categories}
              householdId={household.id}
              userId={user!.id}
              onDone={() => setEditingRec(undefined)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyTarget} onOpenChange={(v) => !v && setHistoryTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historial · {historyTarget?.label}</DialogTitle>
          </DialogHeader>
          {historyTarget && (
            <HistoryView
              entityType={historyTarget.type}
              entityId={historyTarget.id}
              categories={categories}
              memberName={memberName}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AuditEntry {
  id: string;
  action: "insert" | "update" | "delete";
  changes: Record<string, unknown>;
  user_id: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  amount: "Monto",
  currency: "Moneda",
  description: "Descripción",
  spent_at: "Fecha",
  category_id: "Categoría",
  name: "Nombre",
  color: "Color",
  monthly_budget: "Presupuesto",
};

function HistoryView({
  entityType, entityId, categories, memberName,
}: {
  entityType: "expense" | "category";
  entityId: string;
  categories: Category[];
  memberName: (uid: string) => string;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["audit-log", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("id,action,changes,user_id,created_at")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AuditEntry[];
    },
  });

  const fmtVal = (field: string, v: unknown): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (field === "category_id") {
      return categories.find((c) => c.id === v)?.name ?? "Sin categoría";
    }
    if (field === "amount" || field === "monthly_budget") {
      const n = Number(v);
      return isFinite(n) ? fmt(n) : String(v);
    }
    if (field === "spent_at" && typeof v === "string") {
      return format(new Date(v + "T00:00"), "dd/MM/yyyy");
    }
    return String(v);
  };

  const actionLabel = (a: AuditEntry["action"]) =>
    a === "insert" ? "Creado" : a === "update" ? "Editado" : "Eliminado";

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>;

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
      {data.map((entry) => (
        <div key={entry.id} className="rounded-lg border bg-card p-3 text-sm">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <span className="font-medium">{actionLabel(entry.action)}</span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm")}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            por {entry.user_id ? memberName(entry.user_id) : "—"}
          </div>
          {entry.action === "update" ? (
            <ul className="space-y-1">
              {Object.entries(entry.changes).map(([field, val]) => {
                const v = val as { old?: unknown; new?: unknown };
                return (
                  <li key={field} className="text-xs">
                    <span className="font-medium">{FIELD_LABELS[field] ?? field}:</span>{" "}
                    <span className="line-through text-muted-foreground">{fmtVal(field, v.old)}</span>
                    {" → "}
                    <span className="text-foreground">{fmtVal(field, v.new)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="space-y-0.5">
              {Object.entries(entry.changes).map(([field, val]) => (
                <li key={field} className="text-xs">
                  <span className="font-medium">{FIELD_LABELS[field] ?? field}:</span>{" "}
                  <span>{fmtVal(field, val)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function ExpenseForm({
  existing, categories, householdId, userId, onDone,
}: {
  existing: Expense | null;
  categories: Category[];
  householdId: string;
  userId: string;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [categoryId, setCategoryId] = useState<string>(existing?.category_id ?? "none");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [spentAt, setSpentAt] = useState(existing?.spent_at ?? format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount.replace(",", "."));
    if (!(n > 0)) return toast.error("Monto inválido");
    setLoading(true);
    const payload = {
      amount: n,
      category_id: categoryId === "none" ? null : categoryId,
      description: description.trim() || null,
      spent_at: spentAt,
      currency: CURRENCY,
    };
    const { error } = existing
      ? await supabase.from("expenses").update(payload).eq("id", existing.id)
      : await supabase.from("expenses").insert({ ...payload, household_id: householdId, created_by: userId });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Gasto actualizado" : "Gasto registrado");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Monto ({CURRENCY})</Label>
        <Input required type="number" step="0.01" min="0" inputMode="decimal" autoFocus
          value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <Label>Categoría</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin categoría</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Fecha</Label>
        <Input type="date" required value={spentAt} onChange={(e) => setSpentAt(e.target.value)} />
      </div>
      <div>
        <Label>Descripción</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

const COLORS = ["#6366f1", "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899", "#64748b"];

function CategoryForm({
  existing, householdId, userId, onDone,
}: {
  existing: Category | null;
  householdId: string;
  userId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState(existing?.color ?? COLORS[0]);
  const [budget, setBudget] = useState(existing?.monthly_budget ? String(existing.monthly_budget) : "");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      name: name.trim(),
      color,
      monthly_budget: budget ? Number(budget.replace(",", ".")) : null,
    };
    const { error } = existing
      ? await supabase.from("expense_categories").update(payload).eq("id", existing.id)
      : await supabase.from("expense_categories").insert({ ...payload, household_id: householdId, created_by: userId });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Categoría actualizada" : "Categoría creada");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Nombre</Label>
        <Input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoFocus
          placeholder="Mercado, transporte, ocio…" />
      </div>
      <div>
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
              style={{ backgroundColor: c }} aria-label={c} />
          ))}
        </div>
      </div>
      <div>
        <Label>Presupuesto mensual ({CURRENCY}) — opcional</Label>
        <Input type="number" step="0.01" min="0" inputMode="decimal"
          value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0.00" />
      </div>
      <Button type="submit" disabled={loading || !name.trim()} className="w-full">
        {loading ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

function RecurringForm({
  existing, categories, householdId, userId, onDone,
}: {
  existing: Recurring | null;
  categories: Category[];
  householdId: string;
  userId: string;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [categoryId, setCategoryId] = useState<string>(existing?.category_id ?? "none");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [day, setDay] = useState(String(existing?.day_of_month ?? 1));
  const [active, setActive] = useState(existing?.active ?? true);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(amount.replace(",", "."));
    const d = Number(day);
    if (!(n > 0)) return toast.error("Monto inválido");
    if (!(d >= 1 && d <= 28)) return toast.error("Día debe ser entre 1 y 28");
    setLoading(true);
    const payload = {
      amount: n,
      category_id: categoryId === "none" ? null : categoryId,
      description: description.trim() || null,
      day_of_month: d,
      active,
      currency: CURRENCY,
    };
    const { error } = existing
      ? await supabase.from("recurring_expenses").update(payload).eq("id", existing.id)
      : await supabase.from("recurring_expenses").insert({ ...payload, household_id: householdId, created_by: userId });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(existing ? "Recurrente actualizado" : "Recurrente creado");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Monto ({CURRENCY})</Label>
        <Input required type="number" step="0.01" min="0" inputMode="decimal" autoFocus
          value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <Label>Categoría</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin categoría</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Día del mes (1–28)</Label>
        <Input type="number" min="1" max="28" required value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      <div>
        <Label>Descripción</Label>
        <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Alquiler, Netflix, internet…" />
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <div className="font-medium text-sm">Activo</div>
          <div className="text-xs text-muted-foreground">Generar automáticamente cada mes</div>
        </div>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

function PermissionsPanel({ householdId, myUserId }: { householdId: string; myUserId: string }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["expense-perms-panel", householdId],
    queryFn: async () => {
      const [{ data: mems, error: e1 }, { data: perms, error: e2 }] = await Promise.all([
        supabase
          .from("household_members")
          .select("user_id, profile:profiles(display_name)")
          .eq("household_id", householdId),
        supabase
          .from("expense_permissions")
          .select("user_id, permission")
          .eq("household_id", householdId),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const permMap = new Map((perms ?? []).map((p) => [p.user_id, p.permission as Permission]));
      return (mems ?? []).map((m) => ({
        user_id: m.user_id,
        display_name:
          (m.profile as { display_name?: string } | null)?.display_name ?? "Integrante",
        permission: permMap.get(m.user_id) ?? "none",
      })) as MemberRow[];
    },
  });

  const setPerm = useMutation({
    mutationFn: async ({ userId, permission }: { userId: string; permission: Permission }) => {
      const { error } = await supabase
        .from("expense_permissions")
        .upsert({ household_id: householdId, user_id: userId, permission }, { onConflict: "household_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Permiso actualizado");
      qc.invalidateQueries({ queryKey: ["expense-perms-panel", householdId] });
      qc.invalidateQueries({ queryKey: ["expense-perm", householdId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Tag className="h-3 w-3" /> Los admins siempre tienen acceso total.
      </p>
      {rows.map((r) => {
        const isMe = r.user_id === myUserId;
        return (
          <div key={r.user_id} className="rounded-lg border bg-card p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {r.display_name} {isMe && <span className="text-xs text-muted-foreground">(vos)</span>}
              </div>
            </div>
            <Select
              value={r.permission}
              onValueChange={(v) => setPerm.mutate({ userId: r.user_id, permission: v as Permission })}
              disabled={isMe}
            >
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin acceso</SelectItem>
                <SelectItem value="view">Solo ver</SelectItem>
                <SelectItem value="edit">Ver y editar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
