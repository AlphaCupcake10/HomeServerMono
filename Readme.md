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

`make setup` generates `backend/.env` with random secrets. Log in as the super admin using `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from that file; only the super admin can create other users (`POST /api/auth/register`).

Run `make help` to list all targets.

On Windows, install `make` (e.g. `choco install make`) and run from Git Bash.
