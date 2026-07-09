import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

function deriveSecret(apiKey: string) {
  return createHash("sha256")
    .update(`telegram-webhook:${apiKey}`)
    .digest("base64url");
}

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

async function tg(method: string, body: unknown) {
  const apiKey = process.env.TELEGRAM_API_KEY!;
  const lovableKey = process.env.LOVABLE_API_KEY!;
  return fetch(`${GATEWAY}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function reply(chatId: number, text: string) {
  await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
}

async function downloadVoice(fileId: string): Promise<ArrayBuffer> {
  const apiKey = process.env.TELEGRAM_API_KEY!;
  const lovableKey = process.env.LOVABLE_API_KEY!;
  const info = await tg("getFile", { file_id: fileId }).then((r) => r.json());
  const filePath = info.result.file_path as string;
  const dl = await fetch(`${GATEWAY}/file/${filePath}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": apiKey,
    },
  });
  return dl.arrayBuffer();
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.TELEGRAM_API_KEY;
        if (!apiKey) return new Response("no telegram key", { status: 500 });

        const expected = deriveSecret(apiKey);
        const got =
          request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = await request.json();
        const msg = update.message ?? update.edited_message;
        if (!msg || typeof update.update_id !== "number") {
          return Response.json({ ok: true, ignored: true });
        }

        // Lazy admin import (route file is client-reachable in graph).
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        // Idempotency: skip if already processed.
        const { data: existing } = await supabaseAdmin
          .from("telegram_messages")
          .select("update_id")
          .eq("update_id", update.update_id)
          .maybeSingle();
        if (existing) return Response.json({ ok: true, dup: true });

        const chatId = msg.chat.id as number;
        const tgUserId = msg.from?.id as number | undefined;
        const tgUsername = msg.from?.username as string | undefined;

        let kind: string = "text";
        let text: string = (msg.text ?? msg.caption ?? "").trim();
        let transcript: string | null = null;

        try {
          if (msg.voice || msg.audio) {
            kind = msg.voice ? "voice" : "audio";
            const fileId = (msg.voice ?? msg.audio).file_id as string;
            const { transcribeAudio } = await import(
              "@/lib/telegram-intent.server"
            );
            const bytes = await downloadVoice(fileId);
            transcript = await transcribeAudio(bytes, "audio.ogg");
            text = transcript;
          }

          if (!text) {
            await reply(
              chatId,
              "Mandame un mensaje de texto o audio (nota de voz) 🙂",
            );
            await supabaseAdmin.from("telegram_messages").insert({
              update_id: update.update_id,
              telegram_user_id: tgUserId,
              chat_id: chatId,
              message_kind: kind,
              raw_text: text,
              transcript,
              status: "empty",
              raw_update: update,
            });
            return Response.json({ ok: true });
          }

          // Check if user is linked
          let linkRow: {
            user_id: string;
            household_id: string;
          } | null = null;
          if (tgUserId) {
            const { data } = await supabaseAdmin
              .from("telegram_links")
              .select("user_id, household_id")
              .eq("telegram_user_id", tgUserId)
              .maybeSingle();
            linkRow = data ?? null;
          }

          if (!linkRow) {
            // Try to interpret as link code
            const candidate = text
              .replace(/[^A-Z0-9]/gi, "")
              .toUpperCase();
            if (candidate.length >= 4 && candidate.length <= 10 && tgUserId) {
              const { data: code } = await supabaseAdmin
                .from("telegram_link_codes")
                .select("code, user_id, household_id, expires_at, used_at")
                .eq("code", candidate)
                .maybeSingle();
              if (!code) {
                await reply(
                  chatId,
                  "❌ No encontré ese código. Generá uno nuevo desde tu Perfil en la app.",
                );
              } else if (code.used_at) {
                await reply(chatId, "❌ Ese código ya fue usado.");
              } else if (new Date(code.expires_at) < new Date()) {
                await reply(
                  chatId,
                  "❌ Ese código venció. Generá uno nuevo desde tu Perfil.",
                );
              } else {
                await supabaseAdmin.from("telegram_links").upsert(
                  {
                    telegram_user_id: tgUserId,
                    telegram_chat_id: chatId,
                    telegram_username: tgUsername ?? null,
                    user_id: code.user_id,
                    household_id: code.household_id,
                  },
                  { onConflict: "telegram_user_id" },
                );
                await supabaseAdmin
                  .from("telegram_link_codes")
                  .update({ used_at: new Date().toISOString() })
                  .eq("code", code.code);
                await reply(
                  chatId,
                  "✅ ¡Cuenta vinculada! Ahora podés mandarme mensajes como:\n\n" +
                    "• <i>gasté 4500 en el super</i>\n" +
                    "• <i>comprar leche, pan y yerba</i>\n" +
                    "• <i>recordame llevar el auto el viernes</i>\n" +
                    "• <i>pagué la luz 12000</i>",
                );
              }
            } else {
              await reply(
                chatId,
                "👋 Para usar el bot vinculá tu cuenta:\n" +
                  "1. Entrá a la app y andá a <b>Perfil</b>\n" +
                  "2. Tocá <b>Generar código</b>\n" +
                  "3. Enviame ese código por acá",
              );
            }
            await supabaseAdmin.from("telegram_messages").insert({
              update_id: update.update_id,
              telegram_user_id: tgUserId,
              chat_id: chatId,
              message_kind: kind,
              raw_text: text,
              transcript,
              status: "unlinked",
              raw_update: update,
            });
            return Response.json({ ok: true });
          }

          // Linked path: classify with AI
          const { user_id, household_id } = linkRow;

          const [{ data: cats }, { data: pays }] = await Promise.all([
            supabaseAdmin
              .from("expense_categories")
              .select("id, name")
              .eq("household_id", household_id),
            supabaseAdmin
              .from("payments")
              .select("id, name, expense_category_id, currency")
              .eq("household_id", household_id),
          ]);
          const catList = cats ?? [];
          const payList = pays ?? [];

          const { classifyMessage } = await import(
            "@/lib/telegram-intent.server"
          );
          const intent = await classifyMessage(text, {
            categoryNames: catList.map((c) => c.name),
            paymentNames: payList.map((p) => p.name),
            now: new Date().toISOString(),
          });

          let status = "ok";
          let replyText = "";

          if (intent.kind === "expense") {
            const cat = catList.find(
              (c) =>
                intent.category_name &&
                c.name.toLowerCase() === intent.category_name.toLowerCase(),
            );
            const { error } = await supabaseAdmin.from("expenses").insert({
              household_id,
              category_id: cat?.id ?? null,
              amount: intent.amount,
              currency: "ARS",
              description: intent.description,
              spent_at: new Date().toISOString().slice(0, 10),
              created_by: user_id,
            });
            if (error) throw error;
            replyText = `💸 Gasto registrado: <b>$${intent.amount}</b> — ${intent.description}${cat ? ` (${cat.name})` : ""}`;
          } else if (intent.kind === "shopping") {
            const rows = intent.items.map((it) => ({
              household_id,
              name: it.qty ? `${it.qty} ${it.name}` : it.name,
              qty: it.qty,
              created_by: user_id,
            }));
            const { error } = await supabaseAdmin
              .from("shopping_items")
              .insert(rows);
            if (error) throw error;
            replyText = `🛒 Agregué ${rows.length} ítem${rows.length === 1 ? "" : "s"} a la lista:\n${rows.map((r) => `• ${r.name}`).join("\n")}`;
          } else if (intent.kind === "task") {
            const { error } = await supabaseAdmin.from("tasks").insert({
              household_id,
              title: intent.title,
              due_date: intent.due_at,
              status: "pending",
              created_by: user_id,
            });
            if (error) throw error;
            replyText = `📝 Pendiente creado: <b>${intent.title}</b>${intent.due_at ? ` (${new Date(intent.due_at).toLocaleString("es-AR")})` : ""}`;
          } else if (intent.kind === "payment") {
            const pay = payList.find(
              (p) =>
                p.name.toLowerCase() === intent.payment_name.toLowerCase(),
            ) ??
              payList.find((p) =>
                p.name
                  .toLowerCase()
                  .includes(intent.payment_name.toLowerCase()),
              );
            if (!pay) {
              replyText = `❓ No encontré el pago "${intent.payment_name}". Creá el pago recurrente desde la app primero.`;
              status = "no-payment";
            } else {
              const amount = intent.amount;
              // Insert expense first, then payment_history linked
              let expenseId: string | null = null;
              if (amount != null) {
                const { data: exp, error: expErr } = await supabaseAdmin
                  .from("expenses")
                  .insert({
                    household_id,
                    category_id: pay.expense_category_id,
                    amount,
                    currency: pay.currency,
                    description: pay.name,
                    spent_at: new Date().toISOString().slice(0, 10),
                    created_by: user_id,
                  })
                  .select("id")
                  .single();
                if (expErr) throw expErr;
                expenseId = exp.id;
              }
              const { error: phErr } = await supabaseAdmin
                .from("payment_history")
                .insert({
                  payment_id: pay.id,
                  household_id,
                  paid_by: user_id,
                  amount,
                  currency: pay.currency,
                  expense_id: expenseId,
                });
              if (phErr) throw phErr;
              replyText = `✅ Pago registrado: <b>${pay.name}</b>${amount ? ` ($${amount})` : ""}${expenseId ? " — también quedó como gasto" : ""}`;
            }
          } else if (intent.kind === "help") {
            replyText =
              "Podés mandarme (texto o audio):\n\n" +
              "💸 <i>gasté 4500 en el super</i>\n" +
              "🛒 <i>comprar leche, pan y yerba</i>\n" +
              "📝 <i>recordame llevar el auto el viernes</i>\n" +
              "✅ <i>pagué la luz 12000</i>";
          } else {
            status = "unknown";
            replyText = `🤔 No entendí bien. ${intent.kind === "unknown" ? intent.reason : ""} Probá con algo como "gasté 3000 en X" o "comprar leche".`;
          }

          await reply(chatId, replyText);
          await supabaseAdmin.from("telegram_messages").insert({
            update_id: update.update_id,
            telegram_user_id: tgUserId,
            chat_id: chatId,
            user_id,
            household_id,
            message_kind: kind,
            raw_text: text,
            transcript,
            intent: intent.kind,
            status,
            raw_update: update,
          });
          return Response.json({ ok: true });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error("[telegram webhook]", errMsg);
          try {
            await reply(
              chatId,
              "😖 Ups, algo falló procesando tu mensaje. Intentá de nuevo.",
            );
          } catch {}
          await supabaseAdmin.from("telegram_messages").insert({
            update_id: update.update_id,
            telegram_user_id: tgUserId,
            chat_id: chatId,
            message_kind: kind,
            raw_text: text,
            transcript,
            status: "error",
            error: errMsg.slice(0, 500),
            raw_update: update,
          });
          return Response.json({ ok: true, error: true });
        }
      },
    },
  },
});
