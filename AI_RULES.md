# Active app: Yahia Market Marketing HQ

- React + TypeScript + Tailwind + shadcn/ui. Keep routes in `src/App.tsx`, pages in `src/pages/`, components in `src/components/`.
- Phase 1 is a single-business dashboard foundation, not the legacy MerchantIQ CRM. `src/pages/Index.tsx` is the overview. Marketing pages/components live in their `marketing/` folders.
- Dark by default, emerald accents, light mode support. `src/marketing.css` extends the shared theme and is loaded after `src/globals.css`.
- `src/lib/marketing/types.ts` defines shared entities and future backend service interfaces. `store.tsx` provides explicitly labeled browser-local persistence. Start empty: never seed metrics, content, products, or connected integrations.
- Plan approval creates draft calendar slots and inert queued production records. Content approval is separate and version-specific. Edits/revisions reset approval. No automated generation or publication exists in Phase 1.
- AI workspace saves local briefs only; never fabricate AI replies. WooCommerce, Meta, OpenClaw, OpenRouter, and Telegram are disconnected. Never accept credentials in browser settings or log them.
- Backend persistence, auth, integrations, actual PostgreSQL tables, workers, and deployment are deferred. Future backend tools must authorize operations and enforce approval server-side. External credentials remain server-side.
- Legacy CRM, Supabase client, scraper, and auth files remain in the repository but are not imported by the active dashboard. Do not reconnect them, modify legacy database records, or enable infrastructure operations without a separate request.
