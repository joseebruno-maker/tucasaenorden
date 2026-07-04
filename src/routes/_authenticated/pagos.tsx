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
import { Plus, Trash2, Check, Lock, History, Pencil } from "lucide-react";
import { format, differenceInDays, addMonths } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pagos")({ component: PaymentsPage });

type Recurrence = "monthly" | "bimonthly" | "quarterly" | "yearly" | "one_time";
type Category = "rent" | "service" | "other";

interface Payment {
  id: string;
  name: string;
  category: Category;
  amount: number | null;
  currency: string;
  recurrence: Recurrence;
  next_due_date: string;
  notes: string | null;
  expense_category_id: string | null;
}

interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
}

interface HistoryRow {
  id: string;
  payment_id: string;
  paid_at: string;
  paid_by: string;
  amount: number | null;
  currency: string;
}

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  monthly: "Mensual",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  yearly: "Anual",
  one_time: "Único",
};

const CATEGORY_LABEL: Record<Category, string> = {
  rent: "Alquiler",
  service: "Servicio",
  other: "Otro",
};

function advanceDate(d: Date, rec: Recurrence): Date {
  switch (rec) {
    case "monthly": return addMonths(d, 1);
    case "bimonthly": return addMonths(d, 2);
    case "quarterly": return addMonths(d, 3);
    case "yearly": return addMonths(d, 12);
    case "one_time": return d;
  }
}

function PaymentsPage() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const { canManageEconomic, loading: roleLoading } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [historyOpenFor, setHistoryOpenFor] = useState<Payment | null>(null);
  const [payOpenFor, setPayOpenFor] = useState<Payment | null>(null);
  const [editOpenFor, setEditOpenFor] = useState<Payment | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", household?.id],
    enabled: !!household && canManageEconomic,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id,name,category,amount,currency,recurrence,next_due_date,notes,expense_category_id")
        .eq("household_id", household!.id)
        .order("next_due_date", { ascending: true });
      if (error) throw error;
      return data as Payment[];
    },
  });

  const { data: expenseCategories = [] } = useQuery({
    queryKey: ["expense-categories", household?.id],
    enabled: !!household && canManageEconomic,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expense_categories")
        .select("id,name,color")
        .eq("household_id", household!.id)
        .order("name");
      if (error) throw error;
      return data as ExpenseCategory[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members-all", household?.id],
    enabled: !!household && canManageEconomic,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("user_id, profile:profiles(display_name)")
        .eq("household_id", household!.id);
      if (error) throw error;
      return data as unknown as { user_id: string; profile: { display_name: string } | null }[];
    },
  });

  const markPaid = useMutation({
    mutationFn: async ({ p, amount }: { p: Payment; amount: number | null }) => {
      const paidAt = new Date();
      // 1. Create the expense (if there's an amount) so it shows in Gastos
      let expenseId: string | null = null;
      if (amount != null) {
        const { data: exp, error: expErr } = await supabase
          .from("expenses")
          .insert({
            household_id: household!.id,
            category_id: p.expense_category_id,
            amount,
            currency: p.currency,
            description: p.name,
            spent_at: paidAt.toISOString().slice(0, 10),
            created_by: user!.id,
          })
          .select("id")
          .single();
        if (expErr) throw expErr;
        expenseId = exp.id;
      }
      // 2. Create the payment history row linked to that expense
      const { error: histErr } = await supabase.from("payment_history").insert({
        payment_id: p.id,
        household_id: household!.id,
        paid_by: user!.id,
        amount,
        currency: p.currency,
        expense_id: expenseId,
      });
      if (histErr) throw histErr;
      // 3. Advance the payment and update its default amount
      const updates: { next_due_date?: string; amount?: number | null } = {};
      if (amount != null && amount !== p.amount) updates.amount = amount;
      if (p.recurrence !== "one_time") {
        const next = advanceDate(new Date(p.next_due_date), p.recurrence);
        updates.next_due_date = next.toISOString().slice(0, 10);
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from("payments").update(updates).eq("id", p.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Pago registrado y agregado a Gastos");
      setPayOpenFor(null);
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["payment-history"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openPayDialog = (p: Payment) => {
    setPayAmount(p.amount != null ? String(p.amount) : "");
    setPayOpenFor(p);
  };

  const confirmPay = (e: FormEvent) => {
    e.preventDefault();
    if (!payOpenFor) return;
    const parsed = payAmount.trim() === "" ? null : parseFloat(payAmount);
    if (parsed != null && (isNaN(parsed) || parsed < 0)) {
      toast.error("Monto inválido");
      return;
    }
    markPaid.mutate({ p: payOpenFor, amount: parsed });
  };

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });

  if (roleLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!canManageEconomic) {
    return (
      <div className="mx-auto max-w-md text-center py-12 space-y-2">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Sección protegida</h2>
        <p className="text-sm text-muted-foreground">
          Solo el admin del hogar puede ver y gestionar los pagos. Pedile al admin que te dé acceso si lo necesitás.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pagos</h1>
          <p className="text-sm text-muted-foreground">Alquiler, servicios y otros</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo pago</DialogTitle></DialogHeader>
            <NewForm expenseCategories={expenseCategories} onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["payments"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {payments.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Sin pagos cargados. Agregá tu alquiler, luz, gas, internet, etc.
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => {
            const due = new Date(p.next_due_date);
            const days = differenceInDays(due, new Date());
            const overdue = days < 0;
            const soon = days >= 0 && days <= 7;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{CATEGORY_LABEL[p.category]}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {p.amount != null && <span className="font-semibold text-foreground">{p.currency} {p.amount.toLocaleString()}</span>}
                      <span>🔁 {RECURRENCE_LABEL[p.recurrence]}</span>
                      <span className={overdue ? "text-destructive font-medium" : soon ? "text-amber-600 font-medium" : ""}>
                        📅 {format(due, "d MMM yyyy", { locale: es })}
                        {overdue && ` · vencido hace ${Math.abs(days)}d`}
                        {soon && !overdue && ` · en ${days}d`}
                      </span>
                    </div>
                    {p.notes && <div className="mt-1 text-xs text-muted-foreground">{p.notes}</div>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => openPayDialog(p)}>
                      <Check className="h-4 w-4 mr-1" />Pagado
                    </Button>
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => setEditOpenFor(p)} className="px-2 text-muted-foreground hover:text-foreground" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setHistoryOpenFor(p)} className="px-2 text-muted-foreground hover:text-foreground" title="Historial">
                        <History className="h-4 w-4" />
                      </button>
                      <button onClick={() => del.mutate(p.id)} className="px-2 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!historyOpenFor} onOpenChange={(v) => !v && setHistoryOpenFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Historial — {historyOpenFor?.name}</DialogTitle></DialogHeader>
          {historyOpenFor && <HistoryList paymentId={historyOpenFor.id} members={members} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!payOpenFor} onOpenChange={(v) => !v && setPayOpenFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pago — {payOpenFor?.name}</DialogTitle></DialogHeader>
          <form onSubmit={confirmPay} className="space-y-3">
            <div>
              <Label>Monto pagado ({payOpenFor?.currency})</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                autoFocus
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder={payOpenFor?.amount != null ? String(payOpenFor.amount) : "0.00"}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {payOpenFor?.amount != null
                  ? `Sugerido del último registro: ${payOpenFor.currency} ${payOpenFor.amount.toLocaleString()}. Ajustalo si cambió.`
                  : "Dejá vacío si no aplica monto."}
              </p>
            </div>
            <Button type="submit" disabled={markPaid.isPending} className="w-full">
              {markPaid.isPending ? "Guardando…" : "Confirmar pago"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editOpenFor} onOpenChange={(v) => !v && setEditOpenFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar pago</DialogTitle></DialogHeader>
          {editOpenFor && (
            <EditForm
              payment={editOpenFor}
              expenseCategories={expenseCategories}
              onDone={() => {
                setEditOpenFor(null);
                qc.invalidateQueries({ queryKey: ["payments"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryList({ paymentId, members }: { paymentId: string; members: { user_id: string; profile: { display_name: string } | null }[] }) {
  const { data: history = [] } = useQuery({
    queryKey: ["payment-history", paymentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_history")
        .select("id,payment_id,paid_at,paid_by,amount,currency")
        .eq("payment_id", paymentId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data as HistoryRow[];
    },
  });

  const nameFor = (uid: string) => members.find((m) => m.user_id === uid)?.profile?.display_name ?? "Integrante";

  if (history.length === 0) return <p className="text-sm text-muted-foreground">Sin pagos registrados aún.</p>;

  return (
    <ul className="max-h-80 space-y-2 overflow-y-auto">
      {history.map((h) => (
        <li key={h.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
          <div>
            <div className="font-medium">{format(new Date(h.paid_at), "d MMM yyyy", { locale: es })}</div>
            <div className="text-xs text-muted-foreground">por {nameFor(h.paid_by)}</div>
          </div>
          {h.amount != null && <span className="font-semibold">{h.currency} {h.amount.toLocaleString()}</span>}
        </li>
      ))}
    </ul>
  );
}

function NewForm({ onDone, expenseCategories }: { onDone: () => void; expenseCategories: ExpenseCategory[] }) {
  const { household } = useHousehold();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("service");
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>("__none__");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("Bs.");
  const [recurrence, setRecurrence] = useState<Recurrence>("monthly");
  const [next, setNext] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from("payments").insert({
      household_id: household!.id,
      created_by: user!.id,
      name: name.trim(),
      category,
      amount: amount ? parseFloat(amount) : null,
      currency: currency.trim() || "Bs.",
      recurrence,
      next_due_date: next,
      notes: notes.trim() || null,
      expense_category_id: expenseCategoryId === "__none__" ? null : expenseCategoryId,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Nombre</Label><Input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alquiler, Luz, Internet…" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rent">Alquiler</SelectItem>
              <SelectItem value="service">Servicio</SelectItem>
              <SelectItem value="other">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Recurrencia</Label>
          <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensual</SelectItem>
              <SelectItem value="bimonthly">Bimestral</SelectItem>
              <SelectItem value="quarterly">Trimestral</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
              <SelectItem value="one_time">Único</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Categoría de Gastos</Label>
        <Select value={expenseCategoryId} onValueChange={setExpenseCategoryId}>
          <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin categoría</SelectItem>
            {expenseCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">
          Al marcar como pagado se registra automáticamente en Gastos con esta categoría.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Label>Monto</Label><Input type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
        <div><Label>Moneda</Label><Input maxLength={5} value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
      </div>
      <div><Label>Próximo vencimiento</Label><Input type="date" required value={next} onChange={(e) => setNext(e.target.value)} /></div>
      <div><Label>Notas</Label><Textarea rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <Button type="submit" disabled={loading || !name.trim()} className="w-full">{loading ? "Guardando…" : "Crear pago"}</Button>
    </form>
  );
}

function EditForm({ payment, expenseCategories, onDone }: { payment: Payment; expenseCategories: ExpenseCategory[]; onDone: () => void }) {
  const [name, setName] = useState(payment.name);
  const [category, setCategory] = useState<Category>(payment.category);
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>(payment.expense_category_id ?? "__none__");
  const [amount, setAmount] = useState(payment.amount != null ? String(payment.amount) : "");
  const [currency, setCurrency] = useState(payment.currency);
  const [recurrence, setRecurrence] = useState<Recurrence>(payment.recurrence);
  const [next, setNext] = useState(payment.next_due_date);
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase
      .from("payments")
      .update({
        name: name.trim(),
        category,
        amount: amount ? parseFloat(amount) : null,
        currency: currency.trim() || "Bs.",
        recurrence,
        next_due_date: next,
        notes: notes.trim() || null,
        expense_category_id: expenseCategoryId === "__none__" ? null : expenseCategoryId,
      })
      .eq("id", payment.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Pago actualizado");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div><Label>Nombre</Label><Input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Tipo</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rent">Alquiler</SelectItem>
              <SelectItem value="service">Servicio</SelectItem>
              <SelectItem value="other">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Recurrencia</Label>
          <Select value={recurrence} onValueChange={(v) => setRecurrence(v as Recurrence)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensual</SelectItem>
              <SelectItem value="bimonthly">Bimestral</SelectItem>
              <SelectItem value="quarterly">Trimestral</SelectItem>
              <SelectItem value="yearly">Anual</SelectItem>
              <SelectItem value="one_time">Único</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Categoría de Gastos</Label>
        <Select value={expenseCategoryId} onValueChange={setExpenseCategoryId}>
          <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sin categoría</SelectItem>
            {expenseCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><Label>Monto</Label><Input type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
        <div><Label>Moneda</Label><Input maxLength={5} value={currency} onChange={(e) => setCurrency(e.target.value)} /></div>
      </div>
      <div><Label>Próximo vencimiento</Label><Input type="date" required value={next} onChange={(e) => setNext(e.target.value)} /></div>
      <div><Label>Notas</Label><Textarea rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <Button type="submit" disabled={loading || !name.trim()} className="w-full">{loading ? "Guardando…" : "Guardar cambios"}</Button>
    </form>
  );
}
