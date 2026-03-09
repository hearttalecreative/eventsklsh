# AGENT_GUIDE: Eventsklsh Repository

This guide is mandatory for AI agents working in this repository.

## 1) Context Discovery (Always First)

1. Read `PROJECT_MAP.md` for project identity, architecture map, and key files.
2. Read `README.md` for local setup and high-level product context.
3. Inspect `package.json` and `src/App.tsx` to confirm stack and active routes.
4. Check `supabase/config.toml` and `src/integrations/supabase/client.ts` before touching payments, auth, or data flows.

## 2) Repository Purpose

This codebase powers the Kyle Lam Sound Healing events web app:
- Public event and training discovery
- Event/training detail and checkout flows
- Admin management for events, attendees, coupons, venues, training programs, and system logs

## 3) Technical Boundaries

- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
- Routing: `react-router-dom` routes are centrally defined in `src/App.tsx`
- Data/Auth: Supabase client in `src/integrations/supabase/client.ts`
- Backend integration: Supabase Edge Functions and migrations in `supabase/`

## 4) Working Rules for Agents

- Follow existing patterns in `src/pages`, `src/components`, and `src/routes`.
- Keep route-level changes synchronized in `src/App.tsx`.
- Preserve auth/admin access behavior in `src/routes/AdminRoute.tsx`.
- Do not commit or expose secrets; treat `.env` files as sensitive.
- Prefer minimal, surgical changes over broad refactors unless explicitly requested.

## 5) Agent Tooling in this Repo

- Skills are available in `.agents/skills/`.
- A legacy mirror may exist in `.agent/skills/`; prefer `.agents/skills/`.
- No dedicated `.agents/workflows/` directory is currently present.

## 6) Continuity Checklist

Before finishing a task:
1. Verify changed behavior against relevant route/page.
2. Ensure no unrelated files were modified.
3. Document key assumptions in your handoff response.
