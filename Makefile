# HomeServerMono - one-stop commands for setting up and running the project.
# Run `make` or `make help` to list targets. First time on a new machine: `make setup`.

BACKEND := backend
# The minecraft service sits behind a compose profile so `up` never starts it; the API starts it
# on demand. --profile makes build/down/logs/ps include it. Always name services when running `up`.
COMPOSE := docker compose -f $(BACKEND)/docker-compose.yml --profile minecraft
NPM     := npm --prefix $(BACKEND)

.DEFAULT_GOAL := help
.PHONY: help setup check env install build dev start test lint format \
        mongo mongo-stop minecraft-create docker-build docker-up docker-down docker-logs docker-ps clean

help: ## Show this help
	@echo "Usage: make <target>"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-14s %s\n", $$1, $$2}'

setup: check env install build ## Full first-time setup (check tools, create .env, install deps, build)
	@echo ""
	@echo "Setup complete. Next: 'make mongo' then 'make dev', or 'make docker-up' for the full stack."

check: ## Verify node/npm/docker are installed
	@node scripts/check-prereqs.js

env: ## Create backend/.env from .env.example with random secrets (never overwrites)
	@node scripts/setup-env.js

install: ## Install backend dependencies (npm ci)
	$(NPM) ci

build: ## Compile TypeScript
	$(NPM) run build

dev: env ## Start the dev server with auto-reload (needs MongoDB: see `make mongo`)
	$(NPM) run dev

start: ## Run the compiled build
	$(NPM) start

test: ## Run tests
	$(NPM) run test

lint: ## Run ESLint
	$(NPM) run lint

format: ## Format the backend with Prettier
	cd $(BACKEND) && npx prettier --write src tests

mongo: env ## Start only MongoDB in Docker (for local `make dev`)
	$(COMPOSE) up -d mongo

mongo-stop: ## Stop the MongoDB container
	$(COMPOSE) stop mongo

minecraft-create: env ## Create the Minecraft container (stopped) so the API can start it
	$(COMPOSE) create minecraft

docker-build: env ## Build the API image
	$(COMPOSE) build api

docker-up: env ## Start API + MongoDB in Docker; Minecraft is created but left stopped
	$(COMPOSE) up -d --build api mongo
	$(COMPOSE) create minecraft

docker-down: ## Stop and remove the stack's containers
	$(COMPOSE) down

docker-logs: ## Follow logs from the Docker stack
	$(COMPOSE) logs -f

docker-ps: ## Show Docker stack status
	$(COMPOSE) ps

clean: ## Remove build output (dist/)
	node -e "require('fs').rmSync('$(BACKEND)/dist',{recursive:true,force:true})"
