# febrianthomas · Kanban

Commission queue tracker, request intake portal, and owner admin workspace for febrianthomas. Built as a client-side Vue 3 single-page application backed by Supabase (PostgreSQL, Auth, RPCs, and Storage), with built-in demo defaults when Supabase environment variables are not configured locally.

## Features

- **Home (`/`)**: Displays derived commission status (`open`, `waitlist`, `closed`) with live open/total slot counts, the six-stage workflow, and an active board preview.
- **Public Queue (`/queue`, alias `/board`)**: Interactive kanban board across six stages (`01` through `06`) with keyword search, commission-type filtering (`Emote`, `GIF`, `Animation`, `Illustration`, `Transition`), shareable card/board query modals (`?card=`, `?board=`), and owner stage-step or drag-and-drop updates.
- **Commission Requests (`/commissions`, aliases `/commission`, `/request`)**: Displays `active` and `waitlist` offer boards with USD/IDR pricing, per-offer request limits (`max_requests`), contact channel selection (`Email`, `Discord`, `Twitter`, `Instagram`), Terms of Service agreement modal, and optional reference image uploads (up to `5 MB`, auto-optimized to WebP up to `1600x1600` or lossy GIF via `gifsicle-wasm-browser`). Submissions call the `submit_commission_request` RPC.
- **Owner Boards (`/boards`, aliases `/manage`, `/setting`, `/settings`)**: Auth-protected board and backlog manager supporting board CRUD, activation, backlog chronological sorting, drag-select, and bulk card moves across boards.
- **Owner Slots (`/slots`, aliases `/offers`, `/commission-settings`)**: Auth-protected offer-board manager enforcing active/waitlist/inactive board constraints, offer CRUD, open/closed toggles, request-count resets, and bulk offer moves.
- **About, Terms & Auth (`/about`, `/terms`, `/tos`, `/login`)**: Bilingual EN/ID creator profile with software/hardware icons and owner-toggleable support links (`Streamlabs`, `Saweria`, `Ko-fi`, `Trakteer`), Terms of Service, and Supabase email/password sign-in.
- **UI, Audio & Accessibility**: Persistent English/Indonesian switching, persistent dark/light theme toggle, Lenis smooth scrolling, background music (`/mp3/bg.mp3`) and click audio (`/mp3/click.wav`) controls, and Reka UI dialogs with `motion-v` reduced-motion support.

## Tech Stack

| Category | Technology | Role |
| --- | --- | --- |
| Framework | Vue 3 (`^3.5.42`), Vue Router (`^4.6.4`) | Reactive UI, SPA routing, and authenticated route guards |
| Language | TypeScript (`~6.0.0`), `vue-tsc` (`^3.3.11`) | Strict static typing across `.ts` and `.vue` files |
| Styling | Tailwind CSS v4 (`^4.3.5`), `@tailwindcss/vite` | Utility styling, dark variant, and bundled Fontsource fonts |
| UI & Motion | Reka UI (`^2.11.0`), `motion-v` (`^2.12.0`), `@lucide/vue`, `simple-icons` | Accessible primitives, spring animations, and UI/social icons |
| Backend | `@supabase/supabase-js` (`2.119.0`) | PostgreSQL data, Supabase Auth, Storage (`kanban-images`), and RPCs |
| Media & UX | `gifsicle-wasm-browser`, `@vueuse/sound`, `lenis`, Fontsource | GIF optimization, sound effects, smooth scrolling, and typography |
| Tooling | Vite (`^8.2.2`), `@vitejs/plugin-vue`, `npm-run-all2` | Dev server, production build, and parallel type-check/build scripts |

## Getting Started

Requires **Node.js `^22.18.0` or `>=24.12.0`**.

```bash
# Install dependencies
npm install

# Optional: configure Supabase environment variables
cp .env.example .env.local

# Start the development server
npm run dev
```

Environment variables defined in `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

When omitted locally, the app falls back to built-in demo state. Restart the dev server after editing `.env.local`.

## Scripts

```bash
npm run dev         # Start Vite dev server
npm run build       # Run type-check and build-only in parallel
npm run preview     # Preview production build locally
npm run build-only  # Build production bundle into dist/
npm run type-check  # Run vue-tsc --build
```

## Supabase & Deployment

- **Migrations**: Apply the SQL files in `supabase/migrations/` in order to create `kanban_boards`, `kanban_cards`, `commission_offer_boards`, `commission_offers`, `commission_status`, `commission_requests`, `support_buttons`, RLS policies, storage bucket rules, and the `submit_commission_request` RPC.
- **Auth**: Create an owner user in Supabase Auth to access `/boards`, `/slots`, and inline queue controls via `/login`.
- **Hosting**: `vercel.json` rewrites all incoming paths to `/index.html` for client-side history routing.

## Project Structure

```text
├── LICENSE
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vercel.json
├── vite.config.ts
├── public/
│   ├── favicon.ico
│   ├── images/
│   │   └── icons/           # WebP hardware and software icons
│   └── mp3/                 # Background music and UI click audio
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── assets/
│   │   └── main.css
│   ├── components/
│   │   ├── commission/      # Board/card/offer dialogs, cards, progress bar, SlotsManager
│   │   ├── layout/          # SiteHeader, SiteFooter
│   │   ├── terms/           # TermsDialog, TermsSections
│   │   └── ui/              # BaseDialog, ConfirmDialog, BoardFilterBar, BulkSelectionBar, etc.
│   ├── composables/         # useAuth, useBoardDragSelect, useLanguage
│   ├── constants/           # commission.ts, site.ts
│   ├── content/             # en.json, id.json
│   ├── data/                # socials.ts
│   ├── lib/                 # supabase.ts, kanbanImage.ts, board/card/offer/status/stage helpers
│   ├── router/              # index.ts
│   └── views/               # Home, Queue, Commissions, About, Terms, Boards, Slots, Login
└── supabase/
    └── migrations/          # SQL schema, constraints, RLS policies, and RPC migrations
```

## License

Licensed under the [MIT License](LICENSE).
