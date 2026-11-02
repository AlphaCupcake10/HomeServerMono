# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

HomeServerMono — a monorepo for a home server. The `backend/` is a Node.js + Express + TypeScript API (auth + Minecraft server management) backed by MongoDB. The Minecraft server itself runs in Docker and its data lives in `modules/minecraft-server/`.

## Repo Layout

```
backend/                 # Express API (see Source Structure)
  docker-compose.yml     # api + mongo + minecraft (itzg/minecraft-server, Fabric)
  Dockerfile
  .env.example           # copy to .env (make env does this with random secrets)
modules/minecraft-server/  # Minecraft server data dir, mounted into the containers
scripts/                 # Node helper scripts used by the Makefile
Makefile                 # setup / dev / docker shortcuts (run `make help`)
```

## Tech Stack

- Runtime: Node.js 20+ (LTS)
- Language: TypeScript 5 (strict)
- HTTP: Express 5
- Database: MongoDB + Mongoose
- Validation: Joi (env + request)
- Logging: Pino
- Auth: JWT (jsonwebtoken + bcryptjs)
- Security: helmet, cors, express-rate-limit, compression, hpp
- Minecraft control: dockerode (container start/stop/logs), rcon (commands)
- API docs: swagger-jsdoc + swagger-ui-express
- Containers: Docker + Docker Compose
- Testing: Vitest + Supertest
- Tooling: ESLint (flat config, typescript-eslint), Prettier, tsx, tsc

## Setup (run from repo root)

- `make setup` — check prerequisites, create `backend/.env` (random secrets), install deps, build
- `make help` — list all targets
- `make mongo` + `make dev` — local development (API on the host, Mongo in Docker)
- `make docker-up` / `make docker-down` — API + MongoDB in Docker. The Minecraft container is created but **left stopped** (compose profile `minecraft`, `restart: "no"`); the API starts it via `POST /api/minecraft/start`. `make minecraft-create` creates it on its own. Always name services when running `docker compose up`.
- Helper scripts live in `scripts/`; update the Makefile when adding commands or env vars.

## Commands (run inside backend/)

- `npm run dev` — start dev server (tsx watch)
- `npm run build` — compile TypeScript
- `npm start` — run compiled build
- `npm run test` — run tests (Vitest)
- `npm run lint` — lint (ESLint)

## Source Structure

```
src/
  config/       # environment config (Joi-validated) & database connection
  docs/         # Swagger/OpenAPI setup
  middlewares/  # error handling, auth (protect), validation, rate limit, logging
  routes/       # route definitions (swagger JSDoc lives here)
  controllers/  # request handlers
  services/     # business logic (AuthService, MinecraftService)
  repositories/ # data access
  models/       # Mongoose models
  utils/        # logger, errors, response envelope, tokens, docker + rcon clients
  validators/   # Joi schemas
  types/        # ambient/type declarations
  app.ts        # Express app assembly
  server.ts     # server start & graceful shutdown
  index.ts      # entry point (DB connect, signal handlers)
tests/          # tests
```

## API Surface

- `GET /health` — liveness (outside `/api`)
- `/api/auth` — `POST login | refresh` (public, stricter rate limit), `POST logout` (auth), `POST register` (**super admin only**; creates a regular user, returns no tokens)
- `/api/minecraft` (all require auth) — `POST start | stop | commands`, `GET logs`, `GET|PUT properties`
  - `GET properties` hides `rcon.password`; `PUT properties` rejects `rcon.password|rcon.port|enable-rcon` and values containing line breaks. Changes apply after a server restart.
- `/api/docs` — Swagger UI
- `/api` routes are rate limited.

## Environment

Validated in `src/config/env.ts`; template in `backend/.env.example`. Beyond the usual (PORT, MONGODB_URI, JWT/refresh secrets and expiries, CORS_ORIGINS, TRUST_PROXY, rate limits), `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` are required, and the Minecraft feature requires `MINECRAFT_CONTAINER_NAME`, `MINECRAFT_DATA_DIR`, `MINECRAFT_RCON_PASSWORD` (plus `MINECRAFT_RCON_HOST`/`PORT`). In Docker the API mounts `/var/run/docker.sock` and `modules/minecraft-server` at `/srv/minecraft`. In production (`NODE_ENV=production`) startup fails if secrets contain `change-me` or JWT secrets are under 32 chars. `make env` appends newly added variables to an existing `.env`. When adding env vars, update `env.ts`, `.env.example`, `docker-compose.yml` and `scripts/setup-env.js` (if it is a secret).

## Conventions

- Strict TypeScript; no implicit any (lint also forbids explicit `any`). `env` is typed via the `Env` interface in `config/env.ts`.
- Layered architecture: routes -> controllers -> services -> repositories.
- Joi schemas in `validators/`; env schema in `config/`. `validate()` replaces `req.body|params|query` with the validated, unknown-key-stripped value.
- Pino logger; centralized error handler; async handler wrapper; consistent response envelope (`utils/response.ts`).
- Graceful shutdown on SIGTERM/SIGINT (close server + DB connection).
- Security headers, CORS allowlist, rate limiting enabled.

## Errors

Responses use the envelope `{ success: false, error: { code, message, details? } }`. Unexpected errors return 500 with `details: { name, message, code? }` (plus a short `stack` outside production) when `EXPOSE_ERROR_DETAILS` is on (default: on outside production, `true` in `.env.example`/compose). Expected failures are mapped to specific statuses with the cause in `details`: Docker 404 -> 404, already started/stopped -> 409, Docker unreachable -> 502, RCON unreachable -> 503. Use `describeError()` from `utils/errors.ts` when wrapping errors.

## Authentication

- JWT access + refresh tokens; bcrypt password hashing; `protect` guards routes and `requireAdmin` restricts to admins.
- No self-registration. The super admin (role `admin`) is created/synced from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` on every startup (`AuthService.ensureSuperAdmin`); only it can create users (role `user`).
- Refresh tokens are single-use: the SHA-256 of the latest one is stored per user and rotated on refresh/login; logout clears it, and replaying a superseded token revokes the session.

## Testing

- Vitest + Supertest. Tests mock the user repository, Docker and RCON, so no database or Docker is needed (`tests/auth.test.ts`, `tests/minecraft.test.ts`, `tests/health.test.ts`). Add tests alongside new features.

## Docs for Future Agents

- Keep this file updated when structure, commands, endpoints or env vars change.
- Update the Tech Stack section when dependencies change.
