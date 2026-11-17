# Yahia Market Marketing HQ

- React + TypeScript + Vite + Tailwind + shadcn/ui. Preserve Dyad compatibility. pnpm is the package manager; keep `pnpm-lock.yaml` synchronized with dependencies.
- Keep routes in `src/App.tsx`; the overview is `src/pages/Index.tsx`. Marketing pages/components live in their `marketing/` folders. Preserve reusable `src/components/ui/` components and their dependencies.
- Dark by default, emerald accents, light mode support. `src/marketing.css` extends the shared theme and is loaded after `src/globals.css`.
- `src/lib/marketing/types.ts` defines shared entities and future service interfaces. `store.tsx` provides explicitly labeled browser-local persistence. Never seed metrics, products, content, or connected integrations.
- Plan approval creates draft calendar slots and inert queued production records. Content approval is separate and version-specific; edits/revisions reset approval. No automated generation or publishing exists in Phase 1.
- AI workspace saves local briefs only; never fabricate AI replies. WooCommerce, Meta, OpenClaw, OpenRouter, and Telegram remain disconnected. Never collect credentials in browser settings or log them.
- Backend persistence, authentication, integrations, actual PostgreSQL tables, workers, and deployment are deferred until separately requested. Future backend tools must authorize operations and enforce approval server-side. External credentials remain server-side.
- Keep cleanup and maintenance separate from feature development. Do not change the dashboard layout, routes, theme, or local storage keys unless requested. Never claim build, lint, runtime, or Git verification without actually executing it.
