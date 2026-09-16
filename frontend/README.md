# FPL Team Manager — Vercel Frontend

Next.js frontend replicating `fpl_team_manager(1).py`:

- Enter your FPL Team ID (+ optional gameweek) → fetches your squad from the official FPL API
- Shows manager info, gameweek stats, squad table, starting XI vs bench
- ML-powered transfer suggestions from the `fpl.predictions` table (Databricks Postgres), with budget tracking (sell prices from FPL transfer history), 3-per-club limits and alternatives

## Setup (local dev)

```bash
cd fpl-frontend
npm install
# create .env.local (never commit):
#   DATABASE_URL=postgresql://user:password@host/databricks_postgres?sslmode=require
npm run dev
```

## Deploy to Vercel

```bash
npm i -g vercel
vercel
vercel env add DATABASE_URL
vercel --prod
```

## Env vars

| Name | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection URL for Databricks Postgres |

> Note: include `sslmode=require` in the URL. The older `DATABASE_PASSWORD` OAuth JWT from `.env` expires every ~1h and is NOT used here.

## API routes

| Route | Purpose |
|---|---|
| `GET /api/bootstrap?gw=` | FPL bootstrap-static, resolves gameweek |
| `GET /api/manager?teamId=` | Manager/team info |
| `GET /api/picks?teamId=&gw=` | Squad picks + transfer history |
| `GET /api/data` | `fpl.players` + `fpl.predictions` from Postgres |

Transfer suggestion logic lives in `lib/suggestions.ts` (port of the notebook's algorithm).
