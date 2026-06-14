import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useAuth } from "@/lib/auth";
import { useRole, type HouseholdRole } from "@/lib/role";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, LogOut, RefreshCw, Shield, User as UserIcon, UserMinus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hogar")({ component: HogarPage });

interface Member {
  user_id: string;
  role: string;
  profile: { display_name: string; avatar_color: string } | null;
  household_role: HouseholdRole | null;
}

const ROLE_LABEL: Record<HouseholdRole, string> = {
  admin: "Admin",
  member: "Miembro",
  guest: "Invitado",
};

const ROLE_DESC: Record<HouseholdRole, string> = {
  admin: "Acceso total, incluye pagos",
  member: "Compras, tareas, calendario y mantenimientos",
  guest: "Solo lista de compras y tareas asignadas",
};

function HogarPage() {
  const { household, refetch } = useHousehold();
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: members = [], refetch: refetchMembers, isFetching } = useQuery({
    queryKey: ["members-full", household?.id],
    enabled: !!household,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async () => {
      const [{ data: mems, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase
          .from("household_members")
          .select("user_id, role, profile:profiles(display_name, avatar_color)")
          .eq("household_id", household!.id),
        supabase
          .from("household_roles")
          .select("user_id, role")
          .eq("household_id", household!.id),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as HouseholdRole]));
      return (mems as unknown as Omit<Member, "household_role">[]).map((m) => ({
        ...m,
        household_role: roleMap.get(m.user_id) ?? null,
      })) as Member[];
    },
  });

  useEffect(() => {
    if (!household?.id) return;
    const channel = supabase
      .channel(`hogar-${household.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "household_members", filter: `household_id=eq.${household.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["members-full", household.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "household_roles", filter: `household_id=eq.${household.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["members-full", household.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [household?.id, qc]);

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: HouseholdRole }) => {
      const { error } = await supabase
        .from("household_roles")
        .upsert({ household_id: household!.id, user_id: userId, role }, { onConflict: "household_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rol actualizado"); qc.invalidateQueries({ queryKey: ["members-full"] }); qc.invalidateQueries({ queryKey: ["role"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from("household_roles").delete().eq("household_id", household!.id).eq("user_id", userId);
      const { error } = await supabase.from("household_members").delete().eq("household_id", household!.id).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Integrante removido"); qc.invalidateQueries({ queryKey: ["members-full"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyCode = () => {
    if (!household) return;
    navigator.clipboard.writeText(household.invite_code);
    toast.success("Código copiado");
  };

  const leave = async () => {
    if (!confirm("¿Salir del hogar? Vas a perder el acceso a sus datos.")) return;
    await supabase.from("household_roles").delete().eq("user_id", user!.id).eq("household_id", household!.id);
    const { error } = await supabase.from("household_members").delete().eq("user_id", user!.id).eq("household_id", household!.id);
    if (error) return toast.error(error.message);
    await refetch();
    navigate({ to: "/onboarding" });
  };

  const adminCount = members.filter((m) => m.household_role === "admin").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{household?.name}</h1>
        <p className="text-sm text-muted-foreground">Integrantes y roles</p>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Invitar integrantes</h2>
        <p className="mt-1 text-sm text-muted-foreground">Compartí este código para que se unan al hogar.</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 rounded-md border bg-muted px-4 py-3 text-center text-xl font-mono font-bold tracking-widest">
            {household?.invite_code}
          </code>
          <Button variant="outline" onClick={copyCode}><Copy className="h-4 w-4" /></Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Por defecto los nuevos entran como <strong>Miembro</strong>. Luego podés cambiarlos a <strong>Invitado</strong> (ej: niñera) o <strong>Admin</strong>.
        </p>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Integrantes ({members.length})</h2>
          <Button variant="ghost" size="sm" onClick={() => refetchMembers()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <ul className="mt-3 space-y-2">
          {members.map((m) => {
            const isSelf = m.user_id === user?.id;
            const isLastAdmin = m.household_role === "admin" && adminCount <= 1;
            return (
              <li key={m.user_id} className="flex items-center gap-3 rounded-md border p-3">
                <span
                  className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white"
                  style={{ backgroundColor: m.profile?.avatar_color ?? "#6366f1" }}
                >
                  {(m.profile?.display_name ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {m.profile?.display_name ?? "Integrante"}
                    {isSelf && <span className="ml-2 text-xs text-muted-foreground">(vos)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {m.household_role ? ROLE_DESC[m.household_role] : "Sin rol"}
                  </div>
                </div>
                {isAdmin && !isSelf ? (
                  <div className="flex items-center gap-1">
                    <Select
                      value={m.household_role ?? "member"}
                      onValueChange={(v) => updateRole.mutate({ userId: m.user_id, role: v as HouseholdRole })}
                    >
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Miembro</SelectItem>
                        <SelectItem value="guest">Invitado</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => {
                        if (confirm(`¿Remover a ${m.profile?.display_name ?? "este integrante"} del hogar?`)) {
                          removeMember.mutate(m.user_id);
                        }
                      }}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Remover"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                    {m.household_role === "admin" ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                    {m.household_role ? ROLE_LABEL[m.household_role] : "—"}
                    {isSelf && isLastAdmin && m.household_role === "admin" && (
                      <span className="text-muted-foreground">(único)</span>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {isAdmin && (
          <p className="mt-3 text-xs text-muted-foreground">
            Como admin podés cambiar el rol de cada integrante. Asegurate de dejar siempre al menos un admin.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <Button variant="destructive" onClick={leave}><LogOut className="h-4 w-4 mr-2" />Salir del hogar</Button>
      </Card>
    </div>
  );
}
