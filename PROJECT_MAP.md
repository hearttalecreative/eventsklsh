# PROJECT_MAP: Kyle Lam Sound Healing Events

This file is the table of contents for technical and operational context in this repository.

## Project Identity

- Repository: `eventsklsh`
- Product: Kyle Lam Sound Healing events and training platform
- Status: Active development/operations

## Architecture Snapshot

- App type: Single-page web app
- Frontend stack: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- Routing entry: `src/App.tsx`
- App bootstrap: `src/main.tsx`
- Data/auth provider: Supabase (`@supabase/supabase-js`)
- Backend integration: Supabase Edge Functions + SQL migrations in `supabase/`

## Key Functional Areas

- Public pages: home/events/trainings and detail pages (`src/pages/`)
- Checkout outcomes: `src/pages/CheckoutSuccess.tsx`, `src/pages/CheckoutCancel.tsx`, `src/pages/TrainingSuccess.tsx`
- Admin access gate: `src/routes/AdminRoute.tsx`
- Admin pages: `src/pages/admin/`
- QR check-in: `src/pages/QRCheckIn.tsx`

## Critical Configuration

- Node scripts/dependencies: `package.json`
- Supabase project/function settings: `supabase/config.toml`
- Supabase web client: `src/integrations/supabase/client.ts`
- Type configuration: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Build/dev tooling: `vite.config.ts`, `tailwind.config.ts`, `postcss.config.js`

## Agent Knowledge Sources

- Mandatory agent rules: `AGENT_GUIDE.md`
- Developer onboarding + run instructions: `README.md`
- Generic templates (reference only):
  - `GENERIC_AGENT_GUIDE.md`
  - `GENERIC_PROJECT_MAP.md`
  - `GENERIC_CONTEXT_SKILL.md`

## Workspace Context

- Parent workspace: `../`
- Parent has shared agent resources under `../.agents/`
