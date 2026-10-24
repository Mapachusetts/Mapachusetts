# Mapachusetts

A full-stack site to search politicians and view each one's career history on
their own page.

- **Framework:** Next.js (App Router) — frontend + API in one project
- **Database:** Supabase (Postgres) with full-text + trigram search
- **Hosting:** Vercel (app) + Supabase (database)

## Routes

- `/` — search page (by name, office, state, party)
- `/politicians/[slug]` — one page per politician, with a career-history timeline
- `/about` — about page

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database table

In the Supabase dashboard, open **SQL Editor → New query**, paste the contents
of [`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the
`politicians` table, search indexes, Row Level Security (public read), and a few
sample records.

### 3. Environment variables

Values live in `.env` (gitignored). Three variables are required:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role secret key>
```

- The URL and anon key are safe to expose to the browser.
- The `service_role` key is a secret and is only used server-side. Never commit
  it or ship it to the browser.

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, import the repo.
3. Add the three environment variables above in the Vercel project settings.
4. Deploy.

## Adding politicians

Use the Supabase dashboard (Table Editor → `politicians`) to add rows, or write
an import script. `career_history` is a JSON array of
`{ "period": "...", "role": "...", "notes": "..." }` objects.
