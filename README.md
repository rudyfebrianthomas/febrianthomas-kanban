# febrianthomas · Kanban

Commission queue tracker, commission request portal, and admin workspace for **febrianthomas**. Built with Vue 3, TypeScript, Tailwind CSS v4, and Supabase.

## Features

- **Public commission queue (`/queue`)**: Displays active and completed kanban boards across workflow stages, with search, commission-type filters (`Emote`, `GIF`, `Animation`, `Illustration`, `Transition`), shareable card detail modals, and owner drag-and-drop or stage navigation.
- **Commission requests (`/commissions`)**: Shows live open and waitlist slot boards with USD/IDR pricing, slot limits, optional reference image uploads (with automatic static-image WebP and animated GIF compression), and a Terms of Service acceptance dialog. New submissions enter the backlog board automatically.
- **Board & card management (`/boards`)**: Authenticated workspace for creating, copying, activating, and deleting boards, managing the backlog, multi-selecting cards, and dragging or bulk-moving cards between boards.
- **Slot management (`/slots`)**: Authenticated workspace for organizing commission offer boards (`active`, `waitlist`, `inactive` status limits enforced both in UI and database), toggling offer availability, resetting request counts, and moving offers across boards.
- **About & Terms (`/about`, `/terms`)**: Bilingual creator profile, toolset showcase, configurable support links, and commission Terms of Service.
- **Bilingual & themed UI**: Instant English / Indonesian switching (`en.json`, `id.json`), persistent light/dark theme toggle, smooth scrolling via Lenis, and accessible dialogs/controls built with Reka UI and `motion-v`.

## Routes

| Route | View | Access | Notes |
| --- | --- | --- | --- |
| `/` | `HomeView.vue` | Public | Landing hero, active board preview, and workflow overview |
| `/queue` | `QueueView.vue` | Public | Active & completed kanban boards (`/board` redirects here) |
| `/commissions` | `CommissionsView.vue` | Public (when open/waitlist) / Owner | Slot boards & request intake (`/commission`, `/request` redirect here) |
| `/about` | `AboutView.vue` | Public | Socials, software/hardware, and support links |
| `/terms` | `TermsView.vue` | Public | Commission Terms of Service (`/tos` redirects here) |
| `/boards` | `BoardsView.vue` | Authenticated | Board, backlog, and card manager (`/manage`, `/setting`, `/settings` redirect here) |
| `/slots` | `SlotsView.vue` | Authenticated | Offer board & slot manager (`/offers`, `/commission-settings` redirect here) |
| `/login` | `LoginView.vue` | Public (guests) | Owner sign-in via Supabase Auth |

## Project Structure

```text
src/
├── assets/          # Global Tailwind v4 setup and shared utility styles
├── components/
│   ├── commission/  # Kanban cards, card/offer-board/request dialogs, SlotsManager
│   ├── layout/      # SiteHeader, SiteFooter
│   ├── terms/       # TermsDialog, TermsSections
│   └── ui/          # BaseDialog, ConfirmDialog, EmptyState, SelectField, ThumbnailBox, toggles, etc.
├── composables/     # useAuth, useBoardDragSelect, useLanguage
├── content/         # en.json and id.json localization strings
├── data/            # Static social links catalog
├── lib/             # Supabase client, image upload/cleanup, board/card/offer/status/stage helpers
├── router/          # Vue Router configuration, auth guards, and page titles
└── views/           # Route-level pages matching each path
supabase/migrations/ # PostgreSQL schema, RLS policies, RPCs, and constraints
```

## Development

Requires **Node.js `^22.18.0` or `>=24.12.0`**.

```sh
npm install
npm run dev
```

### Available Scripts

- `npm run dev` — Start the Vite development server.
- `npm run type-check` — Run `vue-tsc --build`.
- `npm run build` — Run `type-check` and `vite build` in parallel for production output.
- `npm run preview` — Preview the production build locally.

## Supabase Setup & Deployment

1. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your Supabase project settings (use a publishable key only; never expose a secret or service role key in the browser).
2. Apply the SQL migrations in `supabase/migrations/` to provision tables (`kanban_boards`, `kanban_cards`, `commission_offer_boards`, `commission_offers`, `commission_status`, `commission_requests`, `support_buttons`), storage (`kanban-images`), RLS policies, and RPCs (`submit_commission_request`).
3. Create your owner account in Supabase Auth and sign in at `/login`. If Supabase environment variables are omitted locally, the app falls back to built-in demo defaults for offline UI development.
4. Restart the dev server after updating `.env.local`. Production hosting must rewrite all paths to `index.html` for client-side routing (preconfigured in `vercel.json`).
