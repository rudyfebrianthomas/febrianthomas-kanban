# febrianthomas · Kanban

Commission queue tracker, commission request portal, and owner admin workspace for **febrianthomas**. Runs as a client-side Vue 3 single-page application backed by Supabase (PostgreSQL, Auth, RPCs, and Storage), with built-in demo defaults when Supabase environment variables are omitted locally.

## Features

- **Landing overview (`/`)**: Displays live commission open/waitlist/closed status with available slot counts, six workflow stages, active board summary with recent cards, and creator workflow sections.
- **Public commission queue (`/queue`)**: Shows active and completed kanban boards across six stages (`01 Queue` through `06 Completed`), with text search, commission-type filters (`Emote`, `GIF`, `Animation`, `Illustration`, `Transition`), shareable card detail modals (`?card=` and `?board=`), and owner drag-and-drop or stage step controls.
- **Commission requests (`/commissions`)**: Displays active and waitlisted offer boards with USD/IDR pricing, per-offer request caps (`max_requests`), optional reference image uploads (with automatic static WebP and animated GIF optimization), contact platform selection (`Email`, `Discord`, `Twitter`, `Instagram`), and a Terms of Service acceptance dialog. Submissions enter the Backlog board via the `submit_commission_request` RPC.
- **Board & card management (`/boards`)**: Authenticated owner workspace to create, copy, edit, activate, and delete boards, sort the Backlog board by newest or oldest, multi-select cards, and drag or bulk-move cards across boards.
- **Slot & offer management (`/slots`)**: Authenticated owner workspace to manage commission offer boards (`active`, `waitlist`, `inactive` limits enforced in UI and database), create/copy/edit/delete offers, toggle offer availability, reset request counts, and drag or bulk-move offers across boards.
- **About & Terms (`/about`, `/terms`)**: Bilingual creator profile, toolset/software showcase, owner-toggleable support links (`Streamlabs`, `Saweria`, `Ko-fi`, `Trakteer`), and commission Terms of Service.
- **Bilingual & themed UI**: Persistent English / Indonesian switching (`en.json`, `id.json`), persistent light/dark theme toggle, smooth scrolling via Lenis, background music and click audio controls, and accessible dialogs/selects built with Reka UI and `motion-v`.

## Tech Stack

| Category | Technology | Role |
| --- | --- | --- |
| Framework | Vue 3 (`^3.5.42`) & Vue Router (`^4.6.4`) | Reactive UI components, client-side routing, and route auth guards |
| Language | TypeScript (`~6.0.0`) & `vue-tsc` (`^3.3.11`) | Strict static typing across `.ts` and `.vue` modules |
| Styling | Tailwind CSS v4 (`^4.3.5`) & `@tailwindcss/vite` | Utility-first styling, dark mode variant, and custom font theme tokens |
| UI & Motion | Reka UI (`^2.11.0`), `motion-v` (`^2.12.0`), `@lucide/vue`, `simple-icons` | Accessible dialogs/selects, spring/reduced-motion animations, and icons |
| Backend | `@supabase/supabase-js` (`2.119.0`) | PostgreSQL queries, auth sessions, RPC submissions, and image storage |
| Media & UX | `gifsicle-wasm-browser`, `@vueuse/sound`, `lenis`, Fontsource | Client-side GIF optimization, audio playback, smooth scroll, and bundled fonts |
| Build Tooling | Vite (`^8.2.2`), `@vitejs/plugin-vue`, `npm-run-all2` | Dev server, production bundling, and parallel build/typecheck scripts |

## Routes

| Route | View | Access | Notes |
| --- | --- | --- | --- |
| `/` | `HomeView.vue` | Public | Hero, pipeline overview, and active board preview |
| `/queue` | `QueueView.vue` | Public | Active & completed kanban boards (`/board` redirects here) |
| `/commissions` | `CommissionsView.vue` | Public (when open/waitlist) / Owner | Offer boards & request intake (`/commission`, `/request` redirect here) |
| `/about` | `AboutView.vue` | Public | Socials, tools/software, and configurable support buttons |
| `/terms` | `TermsView.vue` | Public | Commission Terms of Service (`/tos` redirects here) |
| `/boards` | `BoardsView.vue` | Authenticated | Board, backlog, and card manager (`/manage`, `/setting`, `/settings` redirect here) |
| `/slots` | `SlotsView.vue` | Authenticated | Offer board & slot manager (`/offers`, `/commission-settings` redirect here) |
| `/login` | `LoginView.vue` | Public (guests) | Owner sign-in via Supabase Auth |

## Project Structure

```text
src/
├── assets/          # Global Tailwind CSS v4 setup and shared utility styles
├── components/
│   ├── commission/  # Kanban cards, card/board/offer dialogs, progress bar, SlotsManager
│   ├── layout/      # SiteHeader, SiteFooter
│   ├── terms/       # TermsDialog, TermsSections
│   └── ui/          # BaseDialog, ConfirmDialog, BoardFilterBar, BulkSelectionBar, SelectField, etc.
├── composables/     # useAuth, useBoardDragSelect, useLanguage
├── constants/       # Static commission, contact-channel, board ID, and site UI constants
├── content/         # en.json and id.json localization strings
├── data/            # Static social links catalog
├── lib/             # Supabase client, image upload/optimization, card/board/offer/status/stage helpers
├── router/          # Vue Router configuration, auth guards, and page titles
└── views/           # Route-level pages matching each path
supabase/migrations/ # PostgreSQL schema, RLS policies, RPCs, and constraints
```

## Getting Started & Scripts

Requires **Node.js `^22.18.0` or `>=24.12.0`**.

```bash
npm install
npm run dev
```

### Scripts

```bash
npm run dev         # Start the Vite development server
npm run type-check  # Run vue-tsc --build
npm run build-only  # Run Vite production build
npm run build       # Run type-check and build-only in parallel
npm run preview     # Preview the production build locally
```

## Supabase Setup & Deployment

1. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your Supabase project settings (publishable key only; never expose a secret or service role key in the browser).
2. Apply the SQL migrations in `supabase/migrations/` to provision tables (`kanban_boards`, `kanban_cards`, `commission_offer_boards`, `commission_offers`, `commission_status`, `commission_requests`, `support_buttons`), storage (`kanban-images`), RLS policies, and RPCs (`submit_commission_request`).
3. Create your owner account in Supabase Auth and sign in at `/login`. Omitting Supabase environment variables locally falls back to built-in demo defaults.
4. Restart the dev server after updating `.env.local`. Production hosting rewrites all routes to `index.html` for SPA routing via `vercel.json`.
