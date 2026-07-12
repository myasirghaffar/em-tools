# EM Tools

Admin / CRM / shop operations for EnergyMart.

Next.js full-stack app with API at `/api/*`, sharing the **same Supabase database** as **em-solar** (storefront).

## Modules

- Dashboard, Leads, Quotes, Sales team, Users
- Products, Product categories, Orders, Customers, Blog & news
- Quote templates, Consultations, Contact messages, Settings

## Setup

```bash
cp .env.example .env.local
# Same DATABASE_URL + JWT_* as em-solar
npm install
npm run dev
```

Default: [http://localhost:3001](http://localhost:3001)

## Note

Standalone `em-solar-backend` is deprecated — both apps embed their own API.
