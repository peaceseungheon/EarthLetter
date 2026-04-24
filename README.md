# EarthLetter

Nuxt 3 SSR app that maps English-language world news by country and topic (military / economy / politics).

## Setup

```bash
pnpm install
cp .env.example .env      # fill in DATABASE_URL, INGEST_SECRET, SITE_URL
pnpm prisma:migrate        # apply schema
pnpm prisma:seed           # load countries + sources (after backend-dev lands schema)
pnpm dev                   # http://localhost:3000
```

Architecture blueprint: [`_workspace/00_architecture.md`](_workspace/00_architecture.md)  ·  Product spec: [`docs/superpowers/specs/2026-04-22-earthletter-design.md`](docs/superpowers/specs/2026-04-22-earthletter-design.md)
