# Antigravity-OpenCode Bridge v2

Objetivo: asegurar continuidad operativa entre la IA integrada de Antigravity y OpenCode con un protocolo simple, trazable y resistente a cambios de sesion.

## Source of Truth

- `docs/ai/ANTIGRAVITY_OPENCODE_BRIDGE.md` (este documento)
- `docs/ai/AI_SYNC_LEDGER.md` (estado vivo + historial)
- `.agents/rules/data.md` (regla always_on para aplicar el protocolo)

## Reglas no negociables

- No inventar datos. Usar `UNKNOWN`.
- No exponer secretos. Usar `[REDACTED]`.
- Actualizar el ledger en cada cierre o switch de IA.
- Session Log es append-only: nunca borrar entradas previas.
- Mantener el formato estable para que cualquier IA lo procese rapido.

## Ciclo de trabajo v2

1. Start
   - Leer `Snapshot Actual`, `Tareas Activas` y ultima entrada del `Session Log`.
   - Confirmar rama y objetivo de sesion.
2. Build
   - Ejecutar cambios tecnicos.
   - Registrar decisiones y validaciones clave.
3. Close
   - Actualizar `Snapshot Actual`.
   - Actualizar `Ultimo Context Delta`.
   - Actualizar `Ultimo Session Handoff`.
   - Insertar una nueva entrada en `Session Log` (arriba).

## Checklist de cierre (obligatorio)

- [ ] Snapshot actualizado (`revision`, `last_updated_utc`, `last_actor`, `next_best_action`)
- [ ] Delta actualizado con solo cambios reales
- [ ] Handoff actualizado en maximo 15 lineas
- [ ] Session Log agregado en formato estandar
- [ ] Sin secretos y sin campos criticos vacios

## Formatos canonicos

### CONTEXT_PACK (baseline)

```txt
<ANTIGRAVITY_CONTEXT_PACK v="2.0">
PROJECT:
- name:
- objective_now:
- environments:
- critical_constraints:

RUNTIME_ENV:
- os/platform:
- languages/runtimes:
- package_managers:
- key_services/dependencies:

REPO_STATE:
- main_repo_path:
- current_branch:
- git_status_summary:
- changed_files_relevant:
- recent_commits_last_10:
- open_prs_related:
- open_issues_related:

ARCHITECTURE_MAP:
- high_level_modules:
- data_flow_summary:
- api_surface:
- infra_dependencies:
- ownership_if_known:

SKILLS_RULES_WORKFLOWS:
- active_skills:
- coding_rules:
- git_workflow:
- release_workflow:
- qa_validation_flow:

DECISIONS_LOG:
- current_adrs_or_decisions:
- deprecated_patterns_to_avoid:

ACTIVE_WORK:
- current_priorities:
- tasks_in_progress:
- blockers:
- risks:

COMMANDS_RUNBOOK:
- setup_commands:
- dev_commands:
- test_commands:
- build_commands:
- deploy_commands:
- observability/debug_commands:

KNOWN_PITFALLS:
- non_obvious_conventions:
- common_failures_and_fixes:
- do_not_touch_areas_if_any:

HANDOFF_TO_OPENCODE:
- what_to_do_first:
- what_to_verify_first:
- expected_output_style:
- success_criteria_for_next_session:

MISSING_INFO:
- list_of_unknowns_to_clarify:
</ANTIGRAVITY_CONTEXT_PACK>
```

### CONTEXT_DELTA (cada switch)

```txt
<ANTIGRAVITY_CONTEXT_DELTA v="2.0">
META:
- based_on_pack_version:
- based_on_revision:
- generated_at:
- session_id:
- actor:
- branch:

CHANGES:
- repo_state_changes:
- new_or_closed_prs:
- new_or_closed_issues:
- architecture_changes:
- rules_or_workflow_changes:
- decision_log_changes:
- active_work_changes:
- validation_changes:
- risk_changes:

NEXT_ACTIONS_FOR_OPENCODE:
- immediate_steps:
- validations_needed:
- expected_artifacts:
</ANTIGRAVITY_CONTEXT_DELTA>
```

### SESSION_HANDOFF (max 15 lineas)

```txt
<SESSION_HANDOFF v="2.0">
- done:
- in_progress:
- blocked_by:
- decisions_taken:
- files_touched:
- tests_status:
- next_best_step:
</SESSION_HANDOFF>
```

## Regla de regeneracion

Regenerar baseline cuando pase una de estas condiciones:

- 5 o mas deltas acumulados
- cambio arquitectonico mayor
- cambio de workflow de release
- dificultad para retomar en menos de 2 minutos
