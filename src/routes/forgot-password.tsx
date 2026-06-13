import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Home, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Revisá tu correo para restablecer la contraseña");
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
          <h1 className="text-2xl font-bold">Restablecer contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresá tu email y te enviaremos un enlace para crear una nueva contraseña.
          </p>

          {sent ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Si el correo está registrado, recibirás instrucciones en tu bandeja de entrada.
              </p>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/login">
                  <ArrowLeft className="h-4 w-4" />
                  Volver al inicio de sesión
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Enviando…" : "Enviar enlace"}
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
