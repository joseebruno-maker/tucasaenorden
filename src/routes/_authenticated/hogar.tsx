import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHousehold } from "@/lib/household";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/hogar")({ component: HogarPage });

interface Member { user_id: string; role: string; profile: { display_name: string; avatar_color: string } | null }

function HogarPage() {
  const { household, refetch } = useHousehold();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: members = [] } = useQuery({
    queryKey: ["members-full", household?.id],
    enabled: !!household,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("household_members")
        .select("user_id, role, profile:profiles(display_name, avatar_color)")
        .eq("household_id", household!.id);
      if (error) throw error;
      return data as unknown as Member[];
    },
  });

  const copyCode = () => {
    if (!household) return;
    navigator.clipboard.writeText(household.invite_code);
    toast.success("Código copiado");
  };

  const leave = async () => {
    if (!confirm("¿Salir del hogar? Vas a perder el acceso a sus datos.")) return;
    const { error } = await supabase.from("household_members").delete().eq("user_id", user!.id).eq("household_id", household!.id);
    if (error) return toast.error(error.message);
    await refetch();
    navigate({ to: "/onboarding" });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{household?.name}</h1>
        <p className="text-sm text-muted-foreground">Integrantes y configuración</p>
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
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Integrantes ({members.length})</h2>
        <ul className="mt-3 space-y-2">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-3 rounded-md border p-3">
              <span
                className="grid h-10 w-10 place-items-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: m.profile?.avatar_color ?? "#6366f1" }}
              >
                {(m.profile?.display_name ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="flex-1">
                <div className="font-medium">{m.profile?.display_name ?? "Integrante"}{m.user_id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(vos)</span>}</div>
                <div className="text-xs text-muted-foreground capitalize">{m.role}</div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <Button variant="destructive" onClick={leave}><LogOut className="h-4 w-4 mr-2" />Salir del hogar</Button>
      </Card>
    </div>
  );
}
