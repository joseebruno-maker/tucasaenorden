# Bot de Telegram → registrar todo por chat

## Qué vas a poder hacer al terminar

Abrís el bot en Telegram y le mandás mensajes libres (texto o audio) como:

- *"gasté 4500 en el super"* → se registra un gasto
- *"comprar leche, pan y yerba"* → se agregan a la lista de compras
- *"recordame llevar el auto al mecánico el viernes"* → se crea un pendiente
- *"pagué la luz 12000"* → se marca el pago Y se registra el gasto
- Audio (nota de voz) con lo mismo → se transcribe y procesa igual

El bot responde por Telegram confirmando qué registró (con montos, categorías, etc.) y si algo quedó ambiguo, te pregunta.

---

## Cómo se vincula tu cuenta

En **Perfil** aparece una sección "Conectar Telegram":

1. Tocás "Generar código" → se muestra algo como `VINCULAR 4F7A2K`
2. Abrís el bot (te paso el link cuando esté creado) y le mandás ese código
3. El bot te confirma "Cuenta vinculada al hogar X" ✅
4. Desde ahí, todo lo que le mandes se registra a tu nombre en tu hogar

Cada integrante del hogar hace el mismo proceso con su código.

---

## Entrega en 2 fases

### Fase A — Bot con texto (la más rápida)

1. Conector de Telegram (te lo pido cuando arranquemos; vos creás el bot con **BotFather** en Telegram y el conector se encarga del token).
2. Tablas nuevas:
   - `telegram_links` → `telegram_user_id` ↔ `user_id` + `household_id`
   - `telegram_link_codes` → códigos temporales de vinculación (expiran en 15 min)
   - `telegram_messages` → log de mensajes recibidos (idempotencia + auditoría)
3. Endpoint webhook público en `src/routes/api/public/telegram/webhook.ts` con validación de firma.
4. **Router de intents con IA** (Lovable AI Gateway, modelo `google/gemini-2.5-flash`): toma el mensaje y devuelve JSON con:
   - `intent`: `expense` | `shopping` | `task` | `payment` | `link` | `unknown`
   - Campos según intent (monto, categoría, ítems, fecha, etc.)
5. Handlers que insertan en las tablas existentes (`expenses`, `shopping_items`, `tasks`, `payment_history`) reutilizando las mismas reglas que ya usa la app (ej. al pagar crea gasto).
6. UI en `/perfil`: sección "Telegram" con botón para generar código + estado de vinculación + botón desvincular.

### Fase B — Audio (notas de voz)

1. Cuando llega un mensaje tipo `voice` o `audio`, se descarga el archivo vía la API de Telegram.
2. Se transcribe con `openai/gpt-4o-mini-transcribe` (Lovable AI, sin API key extra).
3. La transcripción pasa por el mismo router de intents de la Fase A.

---

## Detalles técnicos (por si te interesa)

**Stack:** todo en TanStack Start (server route público + `createServerFn` internas). Nada de edge functions nuevas.

**Seguridad:**
- Webhook valida `X-Telegram-Bot-Api-Secret-Token` (secret derivado del `TELEGRAM_API_KEY` con SHA-256).
- Solo se procesan mensajes de `telegram_user_id` vinculados; los demás reciben "vinculá tu cuenta primero".
- Los códigos de vinculación son de 6 caracteres, un solo uso, y expiran a los 15 min.

**Costo IA:** Gemini Flash + Whisper mini son baratos; con uso normal (10-30 mensajes/día por persona) es despreciable.

**Lo que NO incluye esta entrega:**
- Comandos de consulta ("¿cuánto gasté este mes?") — se puede agregar después
- Confirmación tipo "¿seguro?" antes de registrar — por ahora registra directo, se pueden editar/borrar en la app
- Reportes / resúmenes por Telegram (eso queda cubierto por la Entrega 1 del plan de notificaciones si querés después)

---

## Antes de arrancar necesito de vos

1. **Crear el bot en Telegram**: abrí `@BotFather` en Telegram, mandale `/newbot`, elegí nombre y username, y te da un **token**. Después conectás el conector Telegram en Lovable pegando ese token.
2. Confirmarme que arranquemos.

¿Avanzamos con la Fase A?
