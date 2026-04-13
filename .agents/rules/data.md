---
trigger: always_on
description: Enforce shared AI sync protocol
---

# AI Sync Rule (Always On)

This repository uses a shared context protocol between Antigravity Integrated AI and OpenCode.

## Required files

1. `docs/ai/ANTIGRAVITY_OPENCODE_BRIDGE.md`
2. `docs/ai/AI_SYNC_LEDGER.md`

## Mandatory behavior per session

1. Read `docs/ai/AI_SYNC_LEDGER.md` before coding.
2. Execute technical work.
3. Update `Snapshot Actual` and `Tareas Activas` before handoff.
4. Append one new `Session Log` entry at the top.
5. Refresh `Ultimo Context Delta` and `Ultimo Session Handoff` when work changed.

## Data hygiene

- If unknown, write `UNKNOWN`.
- Never write secrets; use `[REDACTED]`.
- Never delete previous Session Log entries.
