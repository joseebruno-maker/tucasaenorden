## Resumen

Conectar la app con Google Calendar (sincronización bidireccional por integrante) y enviar resúmenes configurables (diarios/semanales) por email y push del navegador con pendientes, eventos y compras.

Por el alcance, lo dividimos en **3 entregas** para que veas progreso rápido y podamos ajustar entre cada una.

---

## Entrega 1 — Preferencias de notificación + Resumen por email

**Lo que vas a poder hacer al terminar:** cada integrante entra a su perfil y elige si quiere recibir un resumen diario o semanal por email, a qué hora, y qué incluir (pendientes / eventos / compras). El sistema lo envía automáticamente.

### Cambios

1. **Tabla `notification_preferences`** (una por usuario+hogar):
   - `frequency`: `off` | `daily` | `weekly`
   - `send_hour` (0–23, hora local), `weekday` (0–6, solo si semanal)
   - `timezone` (string IANA, ej. `America/Argentina/Buenos_Aires`)
   - `include_tasks`, `include_events`, `include_shopping` (booleanos)
   - `channel_email`, `channel_push` (booleanos)

2. **Pantalla `/perfil` (o sección en `/hogar`)** con un formulario para editar lo de arriba.

3. **Infraestructura de email Lovable** (ya tenés dominio? lo verifico; si no, te paso el botón para configurarlo). Plantilla React Email con: saludo, pendientes próximas/vencidas, eventos próximos, compras pendientes.

4. **Cron pg_cron cada 15 min** que llama a una server route `/api/public/hooks/send-summaries`. La ruta:
   - Busca usuarios cuya hora local actual coincida con `send_hour` (y día con `weekday` si semanal)
   - Evita duplicados con tabla `summary_send_log` (un envío por usuario por día)
   - Encola el email vía la cola de emails de Lovable

---

## Entrega 2 — Push del navegador (PWA)

**Lo que vas a poder hacer:** activar notificaciones push desde el celular/escritorio y recibir el mismo resumen + avisos puntuales (ej. "tarea vence en 1h").

### Cambios

1. Botón "Activar notificaciones" que pide permiso y registra la suscripción Web Push.
2. Tabla `push_subscriptions` (endpoint, keys, user_id).
3. Secret `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (te los genero y guardo).
4. Service worker mínimo para mostrar la notificación.
5. El mismo cron de resúmenes envía push si `channel_push = true`.

---

## Entrega 3 — Google Calendar bidireccional

**Lo que vas a poder hacer:** cada integrante conecta su cuenta de Google una vez. Los eventos del hogar se crean automáticamente en su Google Calendar, y sus eventos de Google aparecen en la app (opcional, filtrable por calendario).

### Lo que necesito de vos primero

Como cada usuario conecta **su propia** cuenta de Google (no la tuya), Lovable no puede usar su conector estándar — hace falta crear credenciales OAuth propias en Google Cloud. Te guío paso a paso cuando arranquemos:

1. Crear proyecto en https://console.cloud.google.com
2. Activar Google Calendar API
3. Configurar pantalla de consentimiento OAuth (modo "Externo")
4. Crear credenciales "OAuth 2.0 Client ID" tipo Web
5. Pegarme **Client ID** y **Client Secret** → los guardo como secrets `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`

### Cambios técnicos

1. Tabla `google_calendar_tokens` (user_id, access_token, refresh_token, expires_at, calendar_id).
2. Rutas server: `/api/google/oauth/start` y `/api/google/oauth/callback` para el flujo OAuth.
3. Server fn `syncEventToGoogle` que crea/actualiza/borra el evento en Google cuando se modifica en la app.
4. Server fn `pullGoogleEvents` (cron cada hora) que importa eventos del calendario seleccionado al hogar.
5. UI en `/perfil`: botón "Conectar Google Calendar", estado de conexión, selector de calendario destino, botón desconectar.

---

## Cómo seguimos

Te propongo arrancar por la **Entrega 1** (es la que más valor da más rápido y no depende de nada externo). Cuando esté andando, seguimos con la 2 y 3.

¿Avanzo con la Entrega 1?