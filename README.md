# Service Desk

Service Desk is a monorepo project for a ticketing and support workflow system. The repository currently contains:

- a Fastify API under [apps/api](apps/api)
- shared validation schemas and utilities under [packages/shared](packages/shared)
- Docker-based infrastructure for PostgreSQL, Redis, Elasticsearch, and MinIO

## Project structure

- [apps/api](apps/api) — API server, auth flows, routes, and tests
- [packages/shared](packages/shared) — shared Zod schemas and reusable types
- [docker-compose.yml](docker-compose.yml) — local infrastructure services
- [SERVICE_DESK_PLAN.md](SERVICE_DESK_PLAN.md) — development plan
- [SPRINTS_CHECKLIST.md](SPRINTS_CHECKLIST.md) — current sprint progress checklist

## Tech stack

- TypeScript
- Fastify
- Zod
- pnpm workspaces
- Docker Compose
- Vitest

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start infrastructure

```bash
docker compose up -d
```

### 3. Configure environment

Copy the example env file and adjust values if needed:

```bash
cp .env.example .env
```

### 4. Run the API

```bash
pnpm dev
```

## API test run

```bash
pnpm test
```

## Current status

The repository already includes:

- auth endpoints for register/login/refresh/logout
- profile endpoints
- company endpoints
- basic RBAC checks
- initial ticket creation and listing flow

## Notes for contributors

- Follow the sprint plan in [SERVICE_DESK_PLAN.md](SERVICE_DESK_PLAN.md).
- Update [SPRINTS_CHECKLIST.md](SPRINTS_CHECKLIST.md) when work progresses.
- Prefer adding real integration tests before claiming a feature is complete.

