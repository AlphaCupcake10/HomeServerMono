# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

HomeServerMono — a monorepo for a home server. The `backend/` is a Node.js + Express + TypeScript API (auth + Minecraft server management) backed by MongoDB. The Minecraft server itself runs in Docker and its data lives in `modules/minecraft-server/`.

## Repo Layout

```
backend/                 # Express API (see Source Structure)
  config/                # non-secret settings (see Configuration)
    config.yaml          #   committed defaults (local dev)
    config.docker.yaml   #   Docker overlay
    config.local.yaml    #   optional, gitignored, per machine
  docker-compose.yml     # api + mongo + minecraft (itzg/minecraft-server, Fabric)
  Dockerfile
  .env.example           # secrets only; copy to .env (make env does this with random secrets)
modules/minecraft-server/  # Minecraft server data dir, mounted into the containers
scripts/                 # Node helper scripts used by the Makefile
Makefile                 # setup / dev / docker shortcuts (run `make help`)
```

## Tech Stack

- Runtime: Node.js 20+ (LTS)
- Language: TypeScript 5 (strict)
- HTTP: Express 5
- Database: MongoDB + Mongoose
- Configuration: YAML files (`yaml`) + `.env` secrets (dotenv), both Joi-validated
- Validation: Joi (config, env, request)
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
- Helper scripts live in `scripts/`; update the Makefile when adding commands or secrets.

## Commands (run inside backend/)

- `npm run dev` — start dev server (tsx watch)
- `npm run build` — compile TypeScript
- `npm start` — run compiled build
- `npm run test` — run tests (Vitest)
- `npm run lint` — lint (ESLint)

## Source Structure

```
src/
  config/       # config.ts (YAML settings), env.ts (secrets), database connection
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

## Configuration

Two sources, never mixed:

- **Non-secret settings** — `backend/config/*.yaml`, loaded by `src/config/config.ts` into the typed `config` object (`config.server.port`, `config.minecraft.rcon.host`, ...). Merge order: `config.yaml` → `$CONFIG_OVERLAY` (Docker: `config/config.docker.yaml`) → `config.local.yaml` if present (skipped under `NODE_ENV=test`). Objects merge, arrays/values replace. Unknown keys and bad types fail at startup. Relative `minecraft.dataDir` resolves against `backend/`. Env vars do **not** override YAML; the old env names (e.g. `PORT`, `MONGODB_URI`) only trigger a startup warning.
- **Secrets + mode** — `backend/.env` (template `.env.example`), validated in `src/config/env.ts`: `NODE_ENV`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `SUPER_ADMIN_PASSWORD`, `MINECRAFT_RCON_PASSWORD`. In production startup fails if secrets contain `change-me` or JWT secrets are under 32 chars. `make env` creates `.env` and appends secrets added to `.env.example` later.

Docker: compose passes only `NODE_ENV`, `CONFIG_OVERLAY` and the secrets, and bind-mounts `./config` read-only at `/app/config`, so YAML edits need a container restart, not a rebuild. The API also mounts `/var/run/docker.sock` and `modules/minecraft-server` at `/srv/minecraft`.

Adding a setting: non-secret → `Config` interface + Joi schema in `config.ts`, and a value/comment in `config/config.yaml` (plus `config.docker.yaml` only if Docker differs). Secret → `env.ts`, `.env.example`, `docker-compose.yml`, and `SECRET_KEYS` in `scripts/setup-env.js`.

## Conventions

- Strict TypeScript; no implicit any (lint also forbids explicit `any`). Settings are typed via `Config` (`config/config.ts`) and secrets via `Env` (`config/env.ts`).
- Layered architecture: routes -> controllers -> services -> repositories.
- Joi schemas in `validators/`; env schema in `config/`. `validate()` replaces `req.body|params|query` with the validated, unknown-key-stripped value.
- Pino logger; centralized error handler; async handler wrapper; consistent response envelope (`utils/response.ts`).
- Graceful shutdown on SIGTERM/SIGINT (close server + DB connection).
- Security headers, CORS allowlist, rate limiting enabled.

## Minecraft RCON password

`MINECRAFT_RCON_PASSWORD` (in `.env`) must match in three places: the API env, the container's `RCON_PASSWORD` (fixed when the container is created) and `rcon.password` in `server.properties`. The itzg image writes `server.properties` only once (`OVERRIDE_SERVER_PROPERTIES=false`), so `MinecraftService.start()` re-syncs `enable-rcon`/`rcon.password` from env before starting. If the two drift, `docker stop` can't shut the server down gracefully (rcon-cli fails to authenticate) and ends in SIGKILL (exit 137), skipping the world save. To change the password: edit `backend/.env`, `docker rm minecraft-server`, `make minecraft-create`, then start via the API.

## Errors

Responses use the envelope `{ success: false, error: { code, message, details? } }`. Unexpected errors return 500 with `details: { name, message, code? }` (plus a short `stack` outside production) when `server.exposeErrorDetails` is on (default: on outside production; `true` in `config.yaml`). Expected failures are mapped to specific statuses with the cause in `details`: Docker 404 -> 404, already started/stopped -> 409, Docker unreachable -> 502, RCON unreachable -> 503. Use `describeError()` from `utils/errors.ts` when wrapping errors.

## Authentication

- JWT access + refresh tokens; bcrypt password hashing; `protect` guards routes and `requireAdmin` restricts to admins.
- No self-registration. The super admin (role `admin`) is created/synced from `auth.superAdminEmail` (config) / `SUPER_ADMIN_PASSWORD` (env) on every startup (`AuthService.ensureSuperAdmin`); only it can create users (role `user`).
- Refresh tokens are single-use: the SHA-256 of the latest one is stored per user and rotated on refresh/login; logout clears it, and replaying a superseded token revokes the session.

## Testing

- Vitest + Supertest. Tests mock the user repository, Docker and RCON, so no database or Docker is needed (`tests/auth.test.ts`, `tests/minecraft.test.ts`, `tests/health.test.ts`, `tests/config.test.ts`). `tests/setup.ts` sets the secrets as env vars and writes a temporary config overlay (temp Minecraft data dir) referenced by `CONFIG_OVERLAY`. Add tests alongside new features.

## Docs for Future Agents

- Keep this file updated when structure, commands, endpoints, settings or secrets change.
- Update the Tech Stack section when dependencies change.
