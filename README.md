# Yahia Market — Marketing HQ

A lightweight marketing dashboard foundation for Yahia Market, a Moroccan online supermarket at yahiamarket.com. Phase 1 focuses on planning, reviewing content, and organizing a single-business workspace.

## Tech stack

React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide icons, React Router, and browser-local state. Dark mode is the default, with light mode support. The Vite setup retains Dyad compatibility.

## Local development

The repository uses pnpm and `pnpm-lock.yaml`. Node.js must meet Vite 8's requirements (20.19+ or 22.12+; a supported LTS release is recommended). No API credentials or environment variables are needed for Phase 1.

Package scripts:

| Script | Purpose |
| --- | --- |
| `dev` | Vite development server on port 8080 |
| `typecheck` | TypeScript checking for app and build configuration |
| `build` | Type checking followed by production output in `dist/` |
| `build:dev` | Development-mode bundle |
| `lint` | ESLint source checks |
| `preview` | Preview the production bundle |

## Dashboard features

- Overview with local activity and real local workflow counts.
- Marketing Planner with monthly/quarterly plans and plan approval.
- AI Workspace with local brief history and a collapsible assistant.
- Content Calendar with monthly, weekly, and list views.
- Content Library with caption drafts, search, editing, and version history.
- Production Queue with inert local planning records.
- Approvals with separate, version-specific content decisions.
- Analytics with honest empty states and filter controls.
- Products with a disconnected catalog state.
- System Logs with searchable local activity and correlation IDs.
- Settings for business guidelines, scheduling, and AI preferences.

Routes are defined in `src/App.tsx`. Marketing UI lives in `src/components/marketing/` and `src/pages/marketing/`; the overview is `src/pages/Index.tsx`. Shared entities and local workflow state live in `src/lib/marketing/`. Reusable shadcn components remain in `src/components/ui/`.

## Known limitations

Data is stored in this browser only, without authentication, server persistence, backup, or cross-device synchronization. Clearing browser storage removes local data. AI briefs do not produce AI responses. There is no media generation/upload, job execution, automated publishing, or live analytics. Plan approval creates draft calendar slots; it does not approve content. Content edits reset approval. No integration is connected, and credentials must not be entered into local fields.

## Future integrations

OpenRouter for model access, OpenClaw for controlled agent tools, WooCommerce for a read-only product catalog, Meta for Facebook/Instagram publishing and analytics, Telegram for notifications, and PostgreSQL for persistent application data. Future backend operations must enforce authorization and approval, with external credentials kept server-side.
