# febrianthomas-kanban
febrianthomas kanban

## Development

Requires Node.js ^22.18.0 or >=24.12.0.

```sh
npm install
npm run dev
```

Run `npm run build` to type-check and build for production.

## Supabase authentication

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from your Supabase project. Use a publishable key, never a secret or service role key in the browser. Restart the dev server after changing these values. Sign in with an existing Supabase Auth email and password; create users in your Supabase project first.
