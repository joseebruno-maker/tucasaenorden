## Resumen

App web para administrar el hogar de forma colaborativa. Cada integrante inicia sesión con su cuenta y comparte un mismo "hogar". Arrancamos simple con **lista de compras, pendientes y calendario/recordatorios**, dejando preparada la base para sumar luego mantenimientos y pagos.

## Módulos en esta primera entrega

1. **Autenticación**
   - Login con email/contraseña (autoconfirmado, sin verificación por email para acelerar pruebas).
   - Cada usuario crea o se une a un "hogar" mediante un código de invitación.

2. **Hogar e integrantes**
   - Un hogar agrupa a varios usuarios.
   - Pantalla de integrantes con sus nombres y avatar (iniciales).
   - Código para invitar nuevos miembros.

3. **Lista de compras compartida**
   - Agregar ítem (nombre, cantidad, categoría opcional).
   - Marcar como comprado / borrar.
   - Vista agrupada por categoría, contador de pendientes.

4. **Pendientes (tareas)**
   - Crear tarea con título, descripción, fecha límite y asignar a un integrante (o "todos").
   - Estados: pendiente / hecho.
   - Filtros: míos, de otros, todos, vencidos.

5. **Calendario y recordatorios**
   - Vista mensual con eventos del hogar (cumpleaños, citas, recordatorios).
   - Crear evento con fecha, hora, descripción y asignados.
   - Centro de notificaciones dentro de la app: badge con próximos vencimientos (tareas + eventos del día/semana).

6. **Dashboard (home)**
   - Resumen: mis pendientes de hoy, próximos eventos, ítems urgentes de compras.

## Estructura de rutas

```text
/                    → landing / redirige a /dashboard si hay sesión
/login               → email + contraseña
/signup              → registro + crear hogar o ingresar código
/_authenticated
  /dashboard         → resumen del hogar
  /compras           → lista de compras
  /pendientes        → tareas
  /calendario        → vista mensual + lista
  /hogar             → integrantes, código de invitación, perfil
```

## Detalles técnicos

- **Stack:** TanStack Start + Tailwind + shadcn/ui (ya configurado).
- **Backend:** Lovable Cloud (se activa en este paso) para auth, base de datos y RLS.
- **Tablas principales:**
  - `households` (id, name, invite_code)
  - `household_members` (household_id, user_id, role, display_name)
  - `profiles` (id, display_name, avatar_color)
  - `shopping_items` (household_id, name, qty, category, bought, created_by)
  - `tasks` (household_id, title, description, due_date, assigned_to, status, created_by)
  - `events` (household_id, title, description, starts_at, ends_at, created_by)
  - `event_assignees` (event_id, user_id)
- **Seguridad:** RLS estricta — cada usuario solo ve datos de los hogares a los que pertenece (función `is_household_member(uid, hid)` con SECURITY DEFINER para evitar recursión).
- **Notificaciones:** se calculan en cliente desde `tasks` y `events` próximos; campana en el header con popover.
- **Calendario:** componente shadcn `Calendar` + lista de eventos del día seleccionado.
- **Realtime (opcional, fácil de sumar después):** suscripción Supabase a cambios en las tablas para que los integrantes vean updates en vivo.

## Lo que queda para entregas futuras (acordado: "empezar simple")

- Mantenimientos recurrentes (filtros de aire, service del auto, etc.).
- Pagos: alquiler y servicios, con recordatorios de vencimiento y estado pagado/pendiente.
- Notificaciones push del navegador o email.
- Gastos compartidos / quién debe a quién.

¿Avanzo con esta primera versión?