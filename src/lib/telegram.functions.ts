import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Alphabet without confusable chars (no 0/O/1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(len = 6) {
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

export const getTelegramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { householdId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: link }, { data: code }] = await Promise.all([
      supabase
        .from("telegram_links")
        .select("id, telegram_username, telegram_user_id, created_at")
        .eq("user_id", userId)
        .eq("household_id", data.householdId)
        .maybeSingle(),
      supabase
        .from("telegram_link_codes")
        .select("code, expires_at")
        .eq("user_id", userId)
        .eq("household_id", data.householdId)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    return { link: link ?? null, activeCode: code ?? null };
  });

export const createTelegramCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { householdId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Invalidate previous active codes
    await supabase
      .from("telegram_link_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("household_id", data.householdId)
      .is("used_at", null);

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode(6);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const { error } = await supabase.from("telegram_link_codes").insert({
        code,
        user_id: userId,
        household_id: data.householdId,
        expires_at: expiresAt,
      });
      if (!error) return { code, expiresAt };
      if (!error.message.toLowerCase().includes("duplicate")) throw error;
    }
    throw new Error("No se pudo generar código, intentá de nuevo");
  });

export const unlinkTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { linkId: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("telegram_links")
      .delete()
      .eq("id", data.linkId)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
