# HomeServerMono

A home-server control panel: a React web UI and a Node.js + Express + TypeScript API backed by MongoDB. The first feature is a Minecraft server managed through Docker; more features can be added and switched on or off at runtime.

## Quick start on a new machine

Prerequisites: Node.js 20+, npm, `make`, and Docker (with the Compose plugin) for MongoDB / Minecraft.

```bash
make setup      # check tools, create backend/.env with random secrets, install deps, build
make mongo      # start MongoDB in Docker
make dev        # API with auto-reload on http://localhost:3000
make web-dev    # web UI on http://localhost:5173 (in a second terminal)
```

Or run everything in Docker, with the web UI on http://localhost:8080:

```bash
make docker-up
```

The Minecraft server container is created but stays off until you start it from the UI (Minecraft → Overview).

## Signing in

Log in as the super admin with `auth.superAdminEmail` from `backend/config/config.yaml` and `SUPER_ADMIN_PASSWORD` from `backend/.env`. Only the super admin can create other users (Users page) and see the Settings page.

## Configuration

- **Runtime settings** (feature on/off switches, detailed errors, log level, rate limits) are edited on the **Settings** page by the super admin and apply immediately. They're stored in MongoDB; every change is recorded in the audit log shown on the same page.
- **Deployment settings** live in [`backend/config/config.yaml`](backend/config/config.yaml) (committed) and need an API restart. For changes on one machine only, copy `config.local.example.yaml` to `config.local.yaml` (gitignored) and list just what you change. In Docker, a restart of the API container is enough; no rebuild needed.
- **Secrets** live in `backend/.env`, which `make setup` generates with random values.

Run `make help` to list all targets.

On Windows, install `make` (e.g. `choco install make`) and run from Git Bash.
