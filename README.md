# EM Tools

**CRM / ops admin** for EnergyMart (leads, quotes, sales team, inboxes).

Shop catalog admin (products, orders, blogs) lives in **[`../em-solar`](../em-solar)** `/admin`.

Same Supabase database as em-solar; each app embeds its own `/api`.

## Ports

- Dev: http://localhost:3000

## Modules

Dashboard · Leads · Quotes · Sales team · Users · Quote templates · Consultations · Contact messages · Settings

## Setup

```bash
cp .env.example .env.local
# Same DATABASE_URL + JWT_* as em-solar
npm install
npm run dev
```

Sign in with an **admin** account at http://localhost:3000/login.
