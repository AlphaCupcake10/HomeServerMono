# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

HomeServerMono — a monorepo for a home server:

- `backend/` — Node.js + Express + TypeScript API backed by MongoDB: auth (single super admin who creates users), runtime settings with feature flags, an audit log, and Minecraft server management.
- `frontend/` — React + TypeScript web UI (Vite, Tailwind, shadcn/ui) with a sidebar driven by a central routes file. Minecraft is one feature among future ones.
- The Minecraft server runs in Docker; its data lives in `modules/minecraft-server/`.

## Repo Layout

```
backend/                 # Express API (see Backend Source Structure)
  config/                # non-secret settings (see Configuration)
    config.yaml          #   committed defaults (local dev)
    config.docker.yaml   #   Docker overlay
    config.local.yaml    #   optional, gitignored, per machine
  docker-compose.yml     # web + api + mongo + minecraft (itzg/minecraft-server, Fabric)
  Dockerfile
  .env.example           # secrets only; copy to .env (make env does this with random secrets)
frontend/                # React web UI (see Frontend)
  Dockerfile, nginx.conf # static build served by nginx, /api proxied to the api service
modules/minecraft-server/  # Minecraft server data dir, mounted into the containers
scripts/                 # Node helper scripts used by the Makefile
Makefile                 # setup / dev / docker shortcuts (run `make help`)
```

## Tech Stack

Backend:
- Runtime: Node.js 20+ (LTS); Language: TypeScript 5 (strict); HTTP: Express 5
- Database: MongoDB + Mongoose
- Configuration: YAML files (`yaml`) + `.env` secrets (dotenv), both Joi-validated; runtime settings in MongoDB
- Validation: Joi (config, env, request); Logging: Pino
- Auth: JWT (jsonwebtoken + bcryptjs), refresh token in an httpOnly cookie (cookie-parser)
- Security: helmet, cors, express-rate-limit, compression, hpp
- Minecraft control: dockerode (container start/stop/logs/status), rcon (commands)
- API docs: swagger-jsdoc + swagger-ui-express
- Testing: Vitest + Supertest; Tooling: ESLint (flat config, typescript-eslint), Prettier, tsx, tsc

Frontend:
- React 19, TypeScript (strict), Vite
- Tailwind CSS v4, shadcn/ui (Radix, `radix-nova` style), lucide-react icons, next-themes, sonner toasts
- React Router v7 (data router), TanStack Query v5
- Tooling: oxlint, Prettier. No frontend tests (by decision).

Containers: Docker + Docker Compose (nginx for the web UI).

## Setup (run from repo root)

- `make setup` — check prerequisites, create `backend/.env` (random secrets), install deps (backend + frontend), build both
- `make help` — list all targets
- Local dev: `make mongo` + `make dev` (API on :3000) + `make web-dev` (UI on http://localhost:5173, proxies `/api`)
- `make docker-up` / `make docker-down` — web UI (http://localhost:8080), API (only on `127.0.0.1:3000`) and MongoDB in Docker. The Minecraft container is created but **left stopped** (compose profile `minecraft`, `restart: "no"`); the API starts it via `POST /api/minecraft/start`. `make minecraft-create` creates it on its own. Always name services when running `docker compose up`.
- `make lint`, `make build`, `make format` cover both apps; `make test` runs the backend tests.
- Helper scripts live in `scripts/`; update the Makefile when adding commands or secrets.

## Commands

Backend (inside `backend/`): `npm run dev` (tsx watch), `npm run build`, `npm start`, `npm run test`, `npm run lint`.

Frontend (inside `frontend/`): `npm run dev`, `npm run build` (type-check + Vite build), `npm run lint` (oxlint), `npm run format`.

## Backend Source Structure

```
src/
  config/       # config.ts (YAML settings), env.ts (secrets), runtimeSettings.ts (live DB settings), database.ts
  docs/         # Swagger/OpenAPI setup
  middlewares/  # error handling, auth (protect, requireAdmin), requireFeature, validation, rate limit, logging
  routes/       # route definitions (swagger JSDoc lives here); index.ts mounts them
  controllers/  # request handlers (record audit entries here)
  services/     # AuthService, MinecraftService, SettingsService, AuditService
  repositories/ # data access (UserRepository, SessionRepository, SettingsRepository, AuditRepository)
  models/       # Mongoose models (User, Session, Setting, AuditLog)
  utils/        # logger, errors, response envelope, tokens + refresh cookie, docker + rcon clients
  validators/   # Joi schemas (settings.validator.ts also defines FEATURE_KEYS and the RuntimeSettings type)
  types/        # ambient/type declarations
  app.ts        # Express app assembly
  server.ts     # server start & graceful shutdown
  index.ts      # entry point (DB connect, SettingsService.init, super admin sync, signal handlers)
tests/          # tests
```

## API Surface

- `GET /health` — liveness (outside `/api`)
- `/api/auth` — `POST login | refresh` (public, stricter rate limit), `POST logout` (auth), `POST register` (**super admin only**; creates a regular user, returns no tokens)
- `GET /api/config` (any signed-in user) — client-safe runtime config: `{ features: { minecraft: { enabled } } }`
- `/api/admin` (**super admin only**) — `GET|PUT settings` (runtime settings; PUT is a partial update, unknown keys → 422), `GET audit?limit=` (latest audit entries)
- `/api/minecraft` (auth + feature flag; 403 `FEATURE_DISABLED` while off) — `GET status`, `POST start | stop | commands`, `GET logs`, `GET|PUT properties`
  - `GET status` returns `state: "missing"` (not 404) when the container doesn't exist.
  - `GET properties` hides `rcon.password`; `PUT properties` rejects `rcon.password|rcon.port|enable-rcon` and values containing line breaks. Changes apply after a server restart.
- `/api/docs` — Swagger UI
- `/api` routes are rate limited (limits are runtime settings).

## Configuration

Three sources, never mixed:

- **Deployment settings (YAML, restart to apply)** — `backend/config/*.yaml`, loaded by `src/config/config.ts` into the typed `config` object (`config.server.port`, `config.minecraft.rcon.host`, ...). Merge order: `config.yaml` → `$CONFIG_OVERLAY` (Docker: `config/config.docker.yaml`) → `config.local.yaml` if present (skipped under `NODE_ENV=test`). Objects merge, arrays/values replace. Unknown keys and bad types fail at startup. Relative `minecraft.dataDir` resolves against `backend/`. Env vars do **not** override YAML; old env names only trigger a startup warning.
- **Runtime settings (MongoDB, applied immediately)** — feature flags, `exposeErrorDetails`, `logLevel`, rate-limit maxima. Edited by the super admin on the frontend Settings page (`PUT /api/admin/settings`). `SettingsService` stores one document (`settings` collection, `_id: "runtime"`), overlays it on `runtimeDefaults` from YAML (so new settings get defaults without a migration), and writes the live values into `config/runtimeSettings.ts`, which the logger, error helpers, rate limiter and `requireFeature` read. `runtimeDefaults` in YAML only seeds values the DB doesn't have.
- **Secrets + mode** — `backend/.env` (template `.env.example`), validated in `src/config/env.ts`: `NODE_ENV`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `SUPER_ADMIN_PASSWORD`, `MINECRAFT_RCON_PASSWORD`. In production startup fails if secrets contain `change-me` or JWT secrets are under 32 chars. `make env` creates `.env` and appends secrets added to `.env.example` later.

Docker: compose passes only `NODE_ENV`, `CONFIG_OVERLAY` and the secrets, and bind-mounts `./config` read-only at `/app/config`, so YAML edits need a container restart, not a rebuild. The API also mounts `/var/run/docker.sock` and `modules/minecraft-server` at `/srv/minecraft`. Behind nginx the Docker overlay sets `server.trustProxy: 1`; nginx overwrites `X-Forwarded-For` so clients can't spoof it.

Adding a setting:
- Deployment → `Config` interface + Joi schema in `config.ts`, value/comment in `config/config.yaml` (plus `config.docker.yaml` only if Docker differs).
- Runtime → `RuntimeSettings` + both schemas in `validators/settings.validator.ts`, a default under `runtimeDefaults` in `config.yaml`, any side effect in `SettingsService.apply`, the frontend type in `frontend/src/api/types.ts`, and a control on `SettingsPage.tsx`.
- Secret → `env.ts`, `.env.example`, `docker-compose.yml`, and `SECRET_KEYS` in `scripts/setup-env.js`.

## Feature flags

A feature is switchable end to end:
1. Backend: add its key to `FEATURE_KEYS` (`validators/settings.validator.ts`), a default under `runtimeDefaults.features` in `config.yaml`, a name in `middlewares/requireFeature.ts`, and mount its router with `requireFeature("<key>")` in `routes/index.ts`.
2. Frontend: add the key to `FeatureKey` (`src/api/types.ts`) and `FEATURES` (`src/config/features.ts`), and set `feature: "<key>"` on its entry in `src/routes.tsx`. Disabled features vanish from the sidebar, their routes render Not Found, and the Settings page shows a switch for them automatically.

Disabling a feature blocks its API; it doesn't stop anything already running (e.g. the Minecraft container).

## Audit log

`AuditService.record(actor, action, details, target)` writes to the `auditlogs` collection (180-day TTL). It's best effort: failures are logged, never fail the request, and writes are skipped while MongoDB is disconnected. Record from controllers (they have `req.user`). Current actions: `settings.update` (dotted-path `changes` with from/to), `minecraft.start|stop|command|properties.update`, `user.create`. Shown on the Settings page via `GET /api/admin/audit`.

## Frontend

- `src/routes.tsx` is the **single source of truth for pages**: each `AppRoute` (path, title, icon, lazy `page`, optional `roles`, `feature`, `children`, `hideInNav`) drives both the router (`src/router.tsx`) and the sidebar (`navItemsFor` in `src/navigation.ts`). Add a page = add an entry. Entries with `children` become collapsible sidebar groups; the group path redirects to the first child.
- Guards: `RequireAuth` (redirects to `/login?next=…`), `RouteGuard` (route `roles` → Forbidden page, `feature` → Not Found), both evaluated at render time.
- Auth: `AuthProvider` (React context) + `useAuth()`. The access token lives only in memory (`sessionStore` in `src/api/client.ts`); the refresh token is an httpOnly cookie (path `/api/auth`). On load the session is restored via `POST /api/auth/refresh`. The `api()` wrapper refreshes once on 401; refreshes are single-flight and serialised across tabs (Web Locks): tabs share one cookie and therefore one session, and the backend revokes a session when a superseded refresh token is replayed.
- Data: TanStack Query hooks per feature in `src/features/<feature>/api.ts`. `useAppConfig()` polls `/api/config` (and refetches on focus); the Settings page invalidates it after saving.
- Errors: `ApiError` carries the backend's `code` and `details`; `ErrorAlert` renders them (validation messages as a list, other details as JSON).
- Layout (`src/layout/`): desktop sidebar collapses to an icon rail (state in localStorage), groups open as flyouts when collapsed; on mobile the sidebar is a `Sheet` opened from the top bar.
- `src/components/ui/` is generated by the shadcn CLI (`npx shadcn@latest add <name>`); don't hand-format it (it's in `.prettierignore`).
- Dev server proxies `/api` to `localhost:3000`; in Docker nginx does the same, so the app is always same-origin.

## Conventions

- Strict TypeScript; no implicit any (backend lint also forbids explicit `any`). Settings are typed via `Config` (`config/config.ts`), runtime settings via `RuntimeSettings`, secrets via `Env` (`config/env.ts`).
- Backend layering: routes -> controllers -> services -> repositories.
- Joi schemas in `validators/`; env schema in `config/`. `validate()` replaces `req.body|params|query` with the validated, unknown-key-stripped value (a missing body validates as `{}`).
- Pino logger; centralized error handler; async handler wrapper; consistent response envelope (`utils/response.ts`). `ApiError` takes an optional machine-readable `code` (default `API_ERROR`).
- Graceful shutdown on SIGTERM/SIGINT (close server + DB connection).
- Security headers, CORS allowlist, rate limiting enabled.

## Minecraft RCON password

`MINECRAFT_RCON_PASSWORD` (in `.env`) must match in three places: the API env, the container's `RCON_PASSWORD` (fixed when the container is created) and `rcon.password` in `server.properties`. The itzg image writes `server.properties` only once (`OVERRIDE_SERVER_PROPERTIES=false`), so `MinecraftService.start()` re-syncs `enable-rcon`/`rcon.password` from env before starting. If the two drift, `docker stop` can't shut the server down gracefully (rcon-cli fails to authenticate) and ends in SIGKILL (exit 137), skipping the world save. To change the password: edit `backend/.env`, `docker rm minecraft-server`, `make minecraft-create`, then start via the API.

## Errors

Responses use the envelope `{ success: false, error: { code, message, details? } }`. Unexpected errors return 500 with `details: { name, message, code? }` (plus a short `stack` outside production) when the `exposeErrorDetails` runtime setting is on. Expected failures are mapped to specific statuses with the cause in `details`: Docker 404 -> 404, already started/stopped -> 409, Docker unreachable -> 502, RCON unreachable -> 503, disabled feature -> 403 `FEATURE_DISABLED`. Use `describeError()` from `utils/errors.ts` when wrapping errors.

## Authentication

- JWT access + refresh tokens; bcrypt password hashing; `protect` guards routes and `requireAdmin` restricts to the super admin.
- No self-registration. The super admin (role `admin`, the only admin) is created/synced from `auth.superAdminEmail` (config) / `SUPER_ADMIN_PASSWORD` (env) on every startup (`AuthService.ensureSuperAdmin`); only it can create users (role `user`) and edit runtime settings.
- The refresh token is only ever sent as an httpOnly, `SameSite=Strict` cookie scoped to `/api/auth` (`Secure` when `auth.refreshCookieSecure` is on); response bodies never contain it. `/refresh` also accepts it in the body for non-browser clients.
- Sessions are per device: each login creates a document in the `sessions` collection (`models/Session.ts`, TTL on `expiresAt`) and the refresh token carries its id as `sid`. Signing in elsewhere never signs other devices out.
- Refresh tokens are single-use within their session: only the SHA-256 of the latest is stored and it rotates on every refresh. Replaying a superseded token revokes that one session (other devices are unaffected). Logout ends the current device's session (identified by the refresh cookie) and clears the cookie. A changed `SUPER_ADMIN_PASSWORD` revokes all of the super admin's sessions on the next start. Refresh tokens without a `sid` (issued before per-device sessions) are rejected, forcing a fresh login.

## Testing

- Backend: Vitest + Supertest. Tests mock the repositories, Docker and RCON, so no database or Docker is needed (`tests/auth.test.ts`, `tests/minecraft.test.ts`, `tests/settings.test.ts`, `tests/health.test.ts`, `tests/config.test.ts`). `tests/setup.ts` sets the secrets as env vars and writes a temporary config overlay referenced by `CONFIG_OVERLAY`. Tests that change runtime settings reset them with `runtimeSettings.set(...)`. Add tests alongside new features.
- Frontend: no automated tests; verify with `npm run build` + `npm run lint` and by running the app.

## Docs for Future Agents

- Keep this file updated when structure, commands, endpoints, settings, feature flags or secrets change.
- Update the Tech Stack section when dependencies change.
