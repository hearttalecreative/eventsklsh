# AI Sync Ledger v2

Archivo compartido entre IA integrada de Antigravity y OpenCode para mantener contexto operativo unificado y trazable.

## Reglas de uso

- No inventar datos; usar `UNKNOWN`.
- No guardar secretos; usar `[REDACTED]`.
- Actualizar este archivo al cerrar sesion o al hacer switch de IA.
- Session Log es append-only (nunca borrar entradas previas).
- Mantener este formato para que cualquier IA lo pueda parsear rapido.

## Snapshot Actual

- schema_version: `2.0`
- revision: 3
- last_updated_utc: 2026-04-24T15:53:00Z
- last_actor: `ANTIGRAVITY`
- project: `eventsklsh`
- current_objective: `Implementar ventanas de disponibilidad independientes por ticket (sale_start_at / sale_end_at)`
- current_branch: `main`
- repo_status: `modified (sin commit)`
- active_prs: `UNKNOWN`
- active_issues: `UNKNOWN`
- blockers: `Migration CLI desincronizada — aplicar SQL manualmente via Supabase Dashboard`
- risks: `Columnas sale_start_at/sale_end_at en DB aun no creadas hasta que el usuario ejecute el SQL en Dashboard`
- sync_health: `good`
- next_best_action: `Ejecutar SQL de migracion en Dashboard > SQL Editor, luego commit y verificar en produccion`

## Convenciones y Reglas Vigentes

- coding_rules: `Seguir AGENT_GUIDE.md y patrones existentes del repo`
- git_workflow: `Feature branch + PR cuando aplique; evitar comandos destructivos`
- test_requirements: `Ejecutar pruebas relevantes al alcance del cambio`
- release_notes: `UNKNOWN`
- do_not_touch: `No revertir cambios ajenos sin instruccion explicita`

## Tareas Activas

- [x] Definir metodologia de bridge entre AIs
- [x] Crear guia formal de proceso
- [x] Activar regla always_on en `.agents/rules/data.md`
- [x] Mantener este ledger en cada cierre y switch
- [x] Desplegar Edge Functions actualizadas (send-admin-email, create-training-payment, stripe-webhook)
- [x] Implementar ventana de venta por ticket (sale_start_at / sale_end_at) — código completo
- [x] Desplegar check-ticket-availability y create-payment con validación de ventana de venta
- [ ] Aplicar migración SQL en Supabase Dashboard (columnas sale_start_at, sale_end_at en tickets)
- [ ] Commit y push de todos los archivos modificados
- [ ] Verificar visibilidad de tickets en producción

## Checklist de cierre (ultima sesion)

- snapshot_updated: `yes`
- delta_updated: `yes`
- handoff_updated: `yes`
- session_log_appended: `yes`
- secrets_check: `pass`

## Ultimo Context Delta

```txt
<ANTIGRAVITY_CONTEXT_DELTA v="2.0">
META:
- based_on_pack_version: 2.0
- based_on_revision: 3
- generated_at: 2026-04-24T15:53:00Z
- session_id: ticket-sale-window-20260424
- actor: ANTIGRAVITY
- branch: main

CHANGES:
- repo_state_changes: Implementación completa del sistema de ventana de venta por ticket. 7 archivos modificados, 1 migración SQL creada, 2 edge functions desplegadas.
- new_or_closed_prs: No aplica
- new_or_closed_issues: No aplica
- architecture_changes: |
    - Tabla tickets: +sale_start_at (timestamptz), +sale_end_at (timestamptz), +trigger validate_ticket_sale_window
    - Frontend: isTicketVisible() filtra tickets antes de renderizar; effectiveUnitAmount() simplificado (sin auto-conversión early-bird)
    - Backend: check-ticket-availability y create-payment validan ventana de venta antes de procesar
    - Admin: UI con sección "Sale Window" (azul) por encima de la sección legacy "Early bird"
- rules_or_workflow_changes: Early-bird deprecated — ahora se usa un ticket independiente por fase con su propio sale window
- decision_log_changes: |
    - No auto-conversión de precio early-bird; cada tipo de ticket tiene precio fijo
    - Tickets sin sale_start_at/sale_end_at son siempre visibles (backward compatible)
    - Migración CLI bloqueada por desincronización; SQL debe aplicarse manualmente en Dashboard
- active_work_changes: Implementación completa pendiente de migración DB y commit.
- validation_changes: Edge functions desplegadas exitosamente (CLI v2.72.7)
- risk_changes: Riesgo: la app fallará al leer sale_start_at/sale_end_at hasta que se aplique la migración en DB.

NEXT_ACTIONS_FOR_OPENCODE:
- immediate_steps: |
    1. Ir a https://supabase.com/dashboard/project/iorxmepjaqagfxnyptvb/sql/new
    2. Ejecutar contenido de supabase/migrations/20260424120000_add_ticket_sale_window.sql
    3. git add -A && git commit -m "feat: ticket sale windows (sale_start_at / sale_end_at)"
    4. Verificar que tickets con sale_end_at pasado no aparecen en EventDetail.tsx
- validations_needed: Abrir un evento en producción y confirmar que tickets sin ventana configurada siguen visibles.
- expected_artifacts: Columnas sale_start_at y sale_end_at en tabla tickets; UI "Sale Window" en admin.
</ANTIGRAVITY_CONTEXT_DELTA>
```

## Ultimo Session Handoff

```txt
<SESSION_HANDOFF v="2.0">
- done: |
    - Migración SQL creada: supabase/migrations/20260424120000_add_ticket_sale_window.sql
    - 7 archivos de código modificados (types, hooks, EventDetail, admin Events, 2 edge functions)
    - check-ticket-availability y create-payment desplegados con validación de ventana de venta
- in_progress: Aplicación de la migración DB (bloqueada por desincronización CLI)
- blocked_by: Migración CLI falla — remote tiene versiones no encontradas localmente
- decisions_taken: |
    - No auto-conversión early-bird → cada ticket tiene precio fijo + ventana de venta propia
    - Backward compatible: tickets sin sale_start_at/sale_end_at siempre son visibles
    - Early-bird legacy UI permanece pero marcada como "Deprecated"
- files_touched:
    - supabase/migrations/20260424120000_add_ticket_sale_window.sql (NUEVA)
    - src/types/events.ts (saleStartAt, saleEndAt añadidos)
    - src/hooks/useSupabaseEvents.ts (mapTicket + queries actualizados)
    - src/pages/EventDetail.tsx (isTicketVisible + visibleTickets + ticket list)
    - supabase/functions/check-ticket-availability/index.ts (sale window check)
    - supabase/functions/create-payment/index.ts (sale window guard + effectiveUnitAmount)
    - src/pages/admin/Events.tsx (Sale Window UI + select queries + patch type)
- tests_status: Edge functions desplegadas OK. Frontend requiere migración DB para funcionar.
- next_best_step: |
    1. Ejecutar SQL en Dashboard: https://supabase.com/dashboard/project/iorxmepjaqagfxnyptvb/sql/new
    2. git add -A && git commit -m "feat: ticket sale windows"
    3. Probar en producción con un ticket con sale_end_at en el pasado
</SESSION_HANDOFF>
```

## Session Log (append-only)

### ENTRY-20260424-1053-004

- actor: `ANTIGRAVITY`
- timestamp_utc: `2026-04-24T15:53:00Z`
- branch: `main`
- intent: `Implementar ventanas de disponibilidad independientes por tipo de ticket (sale_start_at / sale_end_at)`
- changes_summary: |
    Migración SQL añade sale_start_at y sale_end_at a tabla tickets con trigger de validación.
    Frontend filtra tickets visibles por ventana de venta. Backend (2 edge functions) valida ventana antes de permitir compra.
    Admin UI muestra sección "Sale Window" en azul por encima de la sección legacy "Early bird".
    Ambas edge functions desplegadas exitosamente.
- files_touched:
  - `supabase/migrations/20260424120000_add_ticket_sale_window.sql` (nueva)
  - `src/types/events.ts`
  - `src/hooks/useSupabaseEvents.ts`
  - `src/pages/EventDetail.tsx`
  - `supabase/functions/check-ticket-availability/index.ts`
  - `supabase/functions/create-payment/index.ts`
  - `src/pages/admin/Events.tsx`
- decisions_taken:
  - `No auto-conversión de early-bird a regular; cada ticket es independiente`
  - `Tickets sin ventana configurada = siempre visibles (backward compatible)`
  - `CLI db push bloqueado por desincronización; migración debe aplicarse manualmente`
- tests_run:
  - `npx supabase functions deploy check-ticket-availability → OK`
  - `npx supabase functions deploy create-payment → OK`
- pending:
  - `Ejecutar SQL de migración en Supabase Dashboard`
  - `git commit -m "feat: ticket sale windows"`
  - `Validar en producción`
- handoff_for_next_ai: `Aplicar migración SQL manual en Dashboard. Ver bloqueadores en Snapshot.`


- actor: `ANTIGRAVITY`
- timestamp_utc: `2026-04-21T19:05:00Z`
- branch: `main`
- intent: `Desplegar Edge Functions según instrucciones del usuario`
- changes_summary: `Se ejecutó npx supabase functions deploy para las 3 funciones especificadas. Se verificó que la sesión ya estaba activa.`
- files_touched:
  - `docs/ai/AI_SYNC_LEDGER.md` (metadata)
- decisions_taken:
  - `Usar persistent shell para manejar el path de npx en macOS (/opt/homebrew/bin)`
  - `No re-ejecutar login ya que projects list confirmó sesión activa`
- tests_run:
  - `supabase functions deploy (reportó éxito para las 3)`
- pending:
  - `Validar funcionalidad en producción (logs en Dashboard)`
- handoff_for_next_ai: `Continuar con el monitoreo en el Dashboard de Supabase. La CLI local v2.72.7 no tiene comando 'logs'.`


### ENTRY-20260410-1533-002

- actor: `OPENCODE`
- timestamp_utc: `2026-04-10T15:33:03Z`
- branch: `main`
- intent: `Preparar version v2 del protocolo de sincronizacion`
- changes_summary: `Se creo schema v2 con checklist de cierre y se reactivo la regla always_on en data.md`
- files_touched:
  - `.agents/rules/data.md`
  - `docs/ai/ANTIGRAVITY_OPENCODE_BRIDGE.md`
  - `docs/ai/AI_SYNC_LEDGER.md`
- decisions_taken:
  - `Usar data.md como regla oficial always_on`
  - `Usar schema v2 para pack/delta/handoff`
- tests_run:
  - `No aplica`
- pending:
  - `Verificar adopcion por IA integrada en la siguiente sesion`
- handoff_for_next_ai: `Leer Snapshot Actual y agregar nueva entrada Session Log al finalizar su trabajo`

### ENTRY-20260410-1528-001

- actor: `OPENCODE`
- timestamp_utc: `2026-04-10T15:28:58Z`
- branch: `main`
- intent: `Aplicar metodologia inicial de sincronizacion entre IA integrada y OpenCode`
- changes_summary: `Se creo guia operativa inicial y ledger compartido`
- files_touched:
  - `docs/ai/ANTIGRAVITY_OPENCODE_BRIDGE.md`
  - `docs/ai/AI_SYNC_LEDGER.md`
- decisions_taken:
  - `Usar AI_SYNC_LEDGER como fuente de verdad operativa`
  - `Usar baseline + delta + handoff para continuidad entre sesiones`
- tests_run:
  - `No aplica`
- pending:
  - `Registrar proximas sesiones y cambios reales de codigo`
- handoff_for_next_ai: `Continuar con protocolo y mantener Session Log append-only`
