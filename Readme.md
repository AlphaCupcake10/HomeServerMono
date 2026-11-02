# HomeServerMono

Node.js + Express + TypeScript backend with MongoDB, plus a Minecraft server module managed through Docker.

## Quick start on a new machine

Prerequisites: Node.js 20+, npm, `make`, and Docker (with the Compose plugin) for MongoDB / Minecraft.

```bash
make setup      # check tools, create backend/.env with random secrets, install deps, build
make mongo      # start MongoDB in Docker
make dev        # run the API with auto-reload on http://localhost:3000
```

Or run the API and MongoDB in Docker (the Minecraft server is created but stays off until you call `POST /api/minecraft/start`):

```bash
make docker-up
```

## Configuration

- **Settings** live in [`backend/config/config.yaml`](backend/config/config.yaml) (committed). For changes on one machine only, copy `config.local.example.yaml` to `config.local.yaml` (gitignored) and list just what you change. In Docker, edits apply after restarting the API container; no rebuild needed.
- **Secrets** live in `backend/.env`, which `make setup` generates with random values.

Log in as the super admin with `auth.superAdminEmail` from the config and `SUPER_ADMIN_PASSWORD` from `.env`. Only the super admin can create other users (`POST /api/auth/register`).

Run `make help` to list all targets.

On Windows, install `make` (e.g. `choco install make`) and run from Git Bash.
