import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/household";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({ component: OnboardingPage });

function OnboardingPage() {
  const { user } = useAuth();
  const { refetch } = useHousehold();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("households")
      .insert({ name: name.trim(), created_by: user.id })
      .select("id")
      .single();
    if (error || !data) {
      setLoading(false);
      return toast.error(error?.message ?? "No se pudo crear el hogar");
    }
    const { error: e2 } = await supabase
      .from("household_members")
      .insert({ household_id: data.id, user_id: user.id, role: "owner" });
    setLoading(false);
    if (e2) return toast.error(e2.message);
    toast.success("¡Hogar creado!");
    await refetch();
    navigate({ to: "/dashboard" });
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { data: hh, error } = await supabase
      .from("households")
      .select("id")
      .eq("invite_code", code.trim().toUpperCase())
      .maybeSingle();
    if (error || !hh) {
      setLoading(false);
      return toast.error("Código inválido");
    }
    const { error: e2 } = await supabase
      .from("household_members")
      .insert({ household_id: hh.id, user_id: user.id });
    setLoading(false);
    if (e2) return toast.error(e2.message);
    toast.success("¡Te uniste al hogar!");
    await refetch();
    navigate({ to: "/dashboard" });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-background to-secondary/40 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Home className="h-5 w-5" />
          </span>
          Mi Hogar
        </div>
        <Card className="p-6">
          <h1 className="text-xl font-bold">Configurá tu hogar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creá un hogar nuevo o uníte a uno existente con el código de invitación.
          </p>
          <Tabs defaultValue="create" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Crear</TabsTrigger>
              <TabsTrigger value="join">Unirme</TabsTrigger>
            </TabsList>
            <TabsContent value="create">
              <form onSubmit={create} className="space-y-4">
                <div>
                  <Label htmlFor="hh-name">Nombre del hogar</Label>
                  <Input id="hh-name" required maxLength={50} placeholder="Casa de los López"
                    value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading || !name.trim()} className="w-full">
                  {loading ? "Creando…" : "Crear hogar"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="join">
              <form onSubmit={join} className="space-y-4">
                <div>
                  <Label htmlFor="code">Código de invitación</Label>
                  <Input id="code" required maxLength={20} placeholder="ABC12345"
                    value={code} onChange={(e) => setCode(e.target.value)} className="uppercase" />
                </div>
                <Button type="submit" disabled={loading || !code.trim()} className="w-full">
                  {loading ? "Uniendo…" : "Unirme"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          <button onClick={signOut} className="mt-6 flex w-full items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <LogOut className="h-3 w-3" /> Cerrar sesión
          </button>
        </Card>
      </div>
    </div>
  );
}
