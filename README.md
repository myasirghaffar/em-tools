# EM Tools

Next.js full-stack admin/tools app for EnergyMart — CRM, quotes, sales team, and inbox modules.

Uses the **same Supabase Postgres database** as `em-solar-backend`. Does **not** include the public website or shop (products, categories, orders, customers, blogs).

## Modules

- Dashboard
- Leads & Quotes
- Sales team
- Users
- Quote templates
- Consultations
- Contact messages
- Settings / Profile

## Stack

- **Frontend:** Next.js App Router, React 19, Tailwind CSS 4
- **Backend:** Hono API mounted at `/api/*` (same process)
- **DB:** Drizzle ORM + Postgres (`DATABASE_URL`)

## Setup

```bash
cd em-tools
cp .env.example .env.local
# Fill DATABASE_URL, JWT_* with the same values as em-solar-backend/.env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with an existing **admin** user.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server (UI + API) |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run lint` | ESLint |

## API

All routes are under `/api`:

- `/api/auth/*` — login, refresh, logout, …
- `/api/users/*` — profile / user admin
- `/api/admin/*` — quote templates, consultations, contact messages, sales team, users, bootstrap
- `/api/leads/*` — leads & quote data
- `/api/health` — liveness
- `/api/health/db` — database ping

## Notes

- Auth uses JWT access + refresh tokens (localStorage key `em-tools-auth`).
- Shop tables may still exist in the shared DB; this app simply does not expose them.
- Keep `em-solar` (storefront) and `em-solar-backend` for the public site; use `em-tools` for internal ops.
