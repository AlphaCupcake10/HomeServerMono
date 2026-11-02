# HomeServerMono - one-stop commands for setting up and running the project.
# Run `make` or `make help` to list targets. First time on a new machine: `make setup`.

BACKEND  := backend
FRONTEND := frontend
# The minecraft service sits behind a compose profile so `up` never starts it; the API starts it
# on demand. --profile makes build/down/logs/ps include it. Always name services when running `up`.
COMPOSE := docker compose -f $(BACKEND)/docker-compose.yml --profile minecraft
NPM     := npm --prefix $(BACKEND)
WEB_NPM := npm --prefix $(FRONTEND)

.DEFAULT_GOAL := help
.PHONY: help setup check env install build dev start test lint format \
        web-dev web-build web-lint \
        mongo mongo-stop minecraft-create docker-build docker-up docker-down docker-logs docker-ps clean

help: ## Show this help
	@echo "Usage: make <target>"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-16s %s\n", $$1, $$2}'

setup: check env install build ## Full first-time setup (check tools, create .env, install deps, build)
	@echo ""
	@echo "Setup complete. Next: 'make mongo', 'make dev' and 'make web-dev' (UI on http://localhost:5173),"
	@echo "or 'make docker-up' for everything in Docker (UI on http://localhost:8080)."

check: ## Verify node/npm/docker are installed
	@node scripts/check-prereqs.js

env: ## Create backend/.env from .env.example with random secrets (never overwrites)
	@node scripts/setup-env.js

install: ## Install backend + frontend dependencies (npm ci)
	$(NPM) ci
	$(WEB_NPM) ci

build: ## Build backend + frontend
	$(NPM) run build
	$(WEB_NPM) run build

dev: env ## Start the API with auto-reload (needs MongoDB: see `make mongo`)
	$(NPM) run dev

web-dev: ## Start the web UI dev server on :5173 (proxies /api to the API on :3000)
	$(WEB_NPM) run dev

web-build: ## Build the web UI into frontend/dist
	$(WEB_NPM) run build

web-lint: ## Lint the web UI (oxlint)
	$(WEB_NPM) run lint

start: ## Run the compiled API build
	$(NPM) start

test: ## Run backend tests
	$(NPM) run test

lint: ## Lint backend (ESLint) + frontend (oxlint)
	$(NPM) run lint
	$(WEB_NPM) run lint

format: ## Format backend + frontend with Prettier
	cd $(BACKEND) && npx prettier --write src tests
	$(WEB_NPM) run format

mongo: env ## Start only MongoDB in Docker (for local `make dev`)
	$(COMPOSE) up -d mongo

mongo-stop: ## Stop the MongoDB container
	$(COMPOSE) stop mongo

minecraft-create: env ## Create the Minecraft container (stopped) so the API can start it
	$(COMPOSE) create minecraft

docker-build: env ## Build the API + web images
	$(COMPOSE) build api web

docker-up: env ## Start web UI (:8080) + API + MongoDB in Docker; Minecraft is created but left stopped
	$(COMPOSE) up -d --build api mongo web
	$(COMPOSE) create minecraft

docker-down: ## Stop and remove the stack's containers
	$(COMPOSE) down

docker-logs: ## Follow logs from the Docker stack
	$(COMPOSE) logs -f

docker-ps: ## Show Docker stack status
	$(COMPOSE) ps

clean: ## Remove build output (backend/dist, frontend/dist)
	node -e "for (const d of ['$(BACKEND)/dist','$(FRONTEND)/dist']) require('fs').rmSync(d,{recursive:true,force:true})"
