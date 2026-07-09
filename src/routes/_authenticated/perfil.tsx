import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useHousehold } from "@/lib/household";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bell, Mail, Send, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  getTelegramStatus,
  createTelegramCode,
  unlinkTelegram,
} from "@/lib/telegram.functions";

const BOT_USERNAME = "Mi_hogarbot";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
});

type Frequency = "off" | "daily" | "weekly";

interface Prefs {
  frequency: Frequency;
  send_hour: number;
  weekday: number;
  timezone: string;
  include_tasks: boolean;
  include_events: boolean;
  include_shopping: boolean;
  channel_email: boolean;
  channel_push: boolean;
}

const DEFAULT_PREFS: Prefs = {
  frequency: "off",
  send_hour: 8,
  weekday: 1,
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "America/Argentina/Buenos_Aires",
  include_tasks: true,
  include_events: true,
  include_shopping: true,
  channel_email: true,
  channel_push: false,
};

const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function PerfilPage() {
  const { user } = useAuth();
  const { household } = useHousehold();
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-prefs", user?.id, household?.id],
    enabled: !!user && !!household,
    queryFn: async (): Promise<Prefs | null> => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select(
          "frequency,send_hour,weekday,timezone,include_tasks,include_events,include_shopping,channel_email,channel_push",
        )
        .eq("user_id", user!.id)
        .eq("household_id", household!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as Prefs | null) ?? null;
    },
  });

  useEffect(() => {
    if (data) setPrefs({ ...DEFAULT_PREFS, ...data });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert(
          {
            user_id: user!.id,
            household_id: household!.id,
            ...prefs,
          },
          { onConflict: "user_id,household_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Preferencias guardadas");
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-sm text-muted-foreground">
          Configurá cómo y cuándo recibir resúmenes y avisos
        </p>
      </div>

      <Card className="p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Resumen automático</h2>
        </div>

        <div className="space-y-2">
          <Label>Frecuencia</Label>
          <Select
            value={prefs.frequency}
            onValueChange={(v) =>
              setPrefs((p) => ({ ...p, frequency: v as Frequency }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Desactivado</SelectItem>
              <SelectItem value="daily">Diario</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {prefs.frequency !== "off" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Hora de envío</Label>
                <Select
                  value={String(prefs.send_hour)}
                  onValueChange={(v) =>
                    setPrefs((p) => ({ ...p, send_hour: Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>
                        {String(h).padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {prefs.frequency === "weekly" && (
                <div className="space-y-2">
                  <Label>Día</Label>
                  <Select
                    value={String(prefs.weekday)}
                    onValueChange={(v) =>
                      setPrefs((p) => ({ ...p, weekday: Number(v) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              Zona horaria: <span className="font-medium">{prefs.timezone}</span>
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="text-sm font-medium">Qué incluir</div>
              <Toggle
                label="Pendientes próximos y vencidos"
                checked={prefs.include_tasks}
                onChange={(v) => setPrefs((p) => ({ ...p, include_tasks: v }))}
              />
              <Toggle
                label="Eventos del calendario"
                checked={prefs.include_events}
                onChange={(v) => setPrefs((p) => ({ ...p, include_events: v }))}
              />
              <Toggle
                label="Lista de compras pendiente"
                checked={prefs.include_shopping}
                onChange={(v) =>
                  setPrefs((p) => ({ ...p, include_shopping: v }))
                }
              />
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="text-sm font-medium">Canales</div>
              <Toggle
                label="Email"
                icon={<Mail className="h-3.5 w-3.5" />}
                checked={prefs.channel_email}
                onChange={(v) => setPrefs((p) => ({ ...p, channel_email: v }))}
              />
              <Toggle
                label="Notificaciones push (próximamente)"
                disabled
                checked={prefs.channel_push}
                onChange={(v) => setPrefs((p) => ({ ...p, channel_push: v }))}
              />
            </div>
          </>
        )}

        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || isLoading}
          className="w-full"
        >
          {save.isPending ? "Guardando…" : "Guardar preferencias"}
        </Button>
      </Card>

      <TelegramCard />
    </div>
  );
}

function TelegramCard() {
  const { household } = useHousehold();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const getStatus = useServerFn(getTelegramStatus);
  const createCode = useServerFn(createTelegramCode);
  const unlink = useServerFn(unlinkTelegram);

  const { data, isLoading } = useQuery({
    queryKey: ["telegram-status", household?.id],
    enabled: !!household,
    queryFn: () => getStatus({ data: { householdId: household!.id } }),
  });

  const genMut = useMutation({
    mutationFn: () => createCode({ data: { householdId: household!.id } }),
    onSuccess: () => {
      toast.success("Código generado");
      qc.invalidateQueries({ queryKey: ["telegram-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unlinkMut = useMutation({
    mutationFn: (id: string) => unlink({ data: { linkId: id } }),
    onSuccess: () => {
      toast.success("Cuenta desvinculada");
      qc.invalidateQueries({ queryKey: ["telegram-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeCode = data?.activeCode?.code;
  const link = data?.link;

  const copyCode = async () => {
    if (!activeCode) return;
    await navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Bot de Telegram</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Registrá gastos, compras, pendientes y pagos mandándole mensajes
        (texto o audio) al bot.
      </p>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : link ? (
        <div className="space-y-3">
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="font-medium">Cuenta vinculada</span>
            </div>
            {link.telegram_username && (
              <div className="mt-1 text-muted-foreground">
                @{link.telegram_username}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <a
                href={`https://t.me/${BOT_USERNAME}`}
                target="_blank"
                rel="noreferrer"
              >
                Abrir bot
              </a>
            </Button>
            <Button
              variant="destructive"
              onClick={() => unlinkMut.mutate(link.id)}
              disabled={unlinkMut.isPending}
            >
              Desvincular
            </Button>
          </div>
        </div>
      ) : activeCode ? (
        <div className="space-y-3">
          <div className="rounded-md border-2 border-dashed p-4 text-center">
            <div className="text-xs text-muted-foreground mb-1">
              Tu código (válido 15 min)
            </div>
            <div className="flex items-center justify-center gap-2">
              <div className="text-3xl font-mono font-bold tracking-widest">
                {activeCode}
              </div>
              <Button size="icon" variant="ghost" onClick={copyCode}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
            <li>
              Abrí{" "}
              <a
                className="text-primary underline"
                href={`https://t.me/${BOT_USERNAME}`}
                target="_blank"
                rel="noreferrer"
              >
                @{BOT_USERNAME}
              </a>
            </li>
            <li>Enviá el código al bot</li>
            <li>Listo, ya podés mandarle mensajes</li>
          </ol>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => genMut.mutate()}
            disabled={genMut.isPending}
          >
            Generar código nuevo
          </Button>
        </div>
      ) : (
        <Button
          className="w-full"
          onClick={() => genMut.mutate()}
          disabled={genMut.isPending || !household}
        >
          {genMut.isPending ? "Generando…" : "Vincular con Telegram"}
        </Button>
      )}
    </Card>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
  icon,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
