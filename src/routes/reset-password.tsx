import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Home } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          toast.error("El enlace expiró o no es válido. Solicitá uno nuevo.");
        }
        setVerifying(false);
      });
    } else {
      // Fallback: check for recovery type in hash (legacy flow)
      const hash = new URLSearchParams(window.location.hash.replace("#", ""));
      if (hash.get("type") === "recovery") {
        setVerifying(false);
      } else {
        toast.error("Enlace inválido. Solicitá uno nuevo.");
        setVerifying(false);
      }
    }
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return toast.error("Las contraseñas no coinciden");
    }
    if (password.length < 6) {
      return toast.error("La contraseña debe tener al menos 6 caracteres");
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Contraseña actualizada correctamente");
    navigate({ to: "/login" });
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-background to-secondary/40 px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-semibold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Home className="h-5 w-5" />
          </span>
          Mi Hogar
        </Link>
        <Card className="p-6">
          <h1 className="text-2xl font-bold">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">Creá una contraseña nueva para tu cuenta.</p>

          {verifying ? (
            <div className="mt-6 text-center text-sm text-muted-foreground">Verificando enlace…</div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Guardando…" : "Guardar contraseña"}
              </Button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary underline">Volver al inicio de sesión</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
