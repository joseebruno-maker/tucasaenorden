// Server-only intent classifier using Lovable AI Gateway (chat completions).
// Kept in a .server.ts file so it stays out of any client bundle.

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export type Intent =
  | {
      kind: "expense";
      amount: number;
      description: string;
      category_name: string | null;
    }
  | {
      kind: "shopping";
      items: Array<{ name: string; qty: string | null }>;
    }
  | {
      kind: "task";
      title: string;
      due_at: string | null; // ISO
    }
  | {
      kind: "payment";
      payment_name: string;
      amount: number | null;
    }
  | { kind: "help" }
  | { kind: "unknown"; reason: string };

interface Ctx {
  categoryNames: string[];
  paymentNames: string[];
  now: string; // ISO
}

export async function classifyMessage(text: string, ctx: Ctx): Promise<Intent> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const system = `Sos un asistente que interpreta mensajes cortos en español rioplatense para una app de hogar.
Devolvés SIEMPRE un JSON válido con un campo "kind" y los datos correspondientes. Nada más.

Fecha/hora actual (ISO): ${ctx.now}
Categorías de gastos existentes: ${ctx.categoryNames.length ? ctx.categoryNames.join(", ") : "(ninguna)"}
Pagos recurrentes existentes: ${ctx.paymentNames.length ? ctx.paymentNames.join(", ") : "(ninguno)"}

Clasificá el mensaje en UNO de estos "kind":
- "expense": el usuario registró un gasto. Ej "gasté 4500 en el super", "3000 nafta". JSON: {"kind":"expense","amount":number,"description":string,"category_name":string|null}. Si "category_name" no coincide EXACTAMENTE con una de la lista, poné null. amount es el número, sin símbolos.
- "shopping": el usuario quiere agregar cosas a la lista de compras. Ej "comprar leche y pan", "agregar yerba a la lista". JSON: {"kind":"shopping","items":[{"name":string,"qty":string|null}, ...]}
- "task": el usuario quiere un recordatorio o pendiente. Ej "recordame llevar el auto el viernes", "tarea: llamar al plomero". JSON: {"kind":"task","title":string,"due_at":string|null}. due_at en ISO 8601 si hay fecha/hora inferible, sino null.
- "payment": el usuario pagó una cuenta/servicio. Ej "pagué la luz", "pagué gas 12000". JSON: {"kind":"payment","payment_name":string,"amount":number|null}. Elegí "payment_name" que mejor coincida con la lista de pagos existentes; sino usá lo que dijo el usuario.
- "help": el usuario pide ayuda o dice hola. Ej "hola", "/help", "qué podés hacer". JSON: {"kind":"help"}
- "unknown": no queda claro. JSON: {"kind":"unknown","reason":string breve en español}

RESPONDÉ SOLO CON EL OBJETO JSON. Nada de markdown, nada de texto adicional.`;

  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`AI ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(content) as Intent;
  } catch {
    return { kind: "unknown", reason: "no-json" };
  }
}

export async function transcribeAudio(
  audioBytes: ArrayBuffer,
  filename: string,
): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const form = new FormData();
  form.append(
    "file",
    new Blob([audioBytes], { type: "audio/ogg" }),
    filename,
  );
  form.append("model", "openai/gpt-4o-mini-transcribe");

  const resp = await fetch(
    "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { "Lovable-API-Key": apiKey },
      body: form,
    },
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`STT ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = await resp.json();
  return String(data.text ?? "").trim();
}
