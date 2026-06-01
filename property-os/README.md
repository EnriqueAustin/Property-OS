# PropertyOS

PropertyOS is a Turborepo monorepo with a Next.js web app, a NestJS API, and a small widget package.

## Local Setup

Start from the repository root:

```powershell
cd C:\Users\anton\Documents\PropertyOS\property-os
npm install
docker compose up -d postgres redis
```

The API reads its local environment from [apps/api/.env](/C:/Users/anton/Documents/PropertyOS/property-os/apps/api/.env) and defaults to:

- API: `http://localhost:3001`
- Web: `http://localhost:3000`
- Postgres: `localhost:5432`
- Redis: `localhost:16379`

## Run The Apps

Open two terminals and run:

```powershell
npm run dev --workspace api
npm run dev --workspace web
```

The API runs migrations on startup, so you do not need a manual migration step for a normal local launch.

## Optional Seed Data

If you want demo data, run this after Postgres is up:

```powershell
npm run seed --workspace api
```

Demo login:

- Email: `demo@propertyos.co.za`
- Password: `Demo1234!`

## Useful Commands

```powershell
npm run build
npm run lint
npm run check-types
```

## Workspace Layout

- `apps/api`: NestJS backend
- `apps/web`: Next.js frontend
- `apps/widget`: Vite widget package
- `packages/ui`: shared UI package
- `packages/eslint-config`: shared ESLint config
- `packages/typescript-config`: shared TypeScript config
