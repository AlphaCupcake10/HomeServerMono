# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project Overview

HomeServerMono backend — a backend boilerplate built with Node.js, Express, and TypeScript.

## Tech Stack

- Runtime: Node.js 20+ (LTS)
- Language: TypeScript 5 (strict)
- HTTP: Express 5
- Database: MongoDB + Mongoose
- Validation: Joi (env + request)
- Logging: Pino
- Auth: JWT (jsonwebtoken + bcryptjs)
- Security: helmet, cors, express-rate-limit, compression, hpp
- Testing: Vitest + Supertest
- Tooling: ESLint (flat config, typescript-eslint), Prettier, tsx, tsc

## Commands (run inside backend/)

- `npm run dev` — start dev server (tsx watch)
- `npm run build` — compile TypeScript
- `npm start` — run compiled build
- `npm run test` — run tests (Vitest)
- `npm run lint` — lint (ESLint)

## Source Structure

```
src/
  config/       # environment config & Joi validation
  constants/
  middlewares/  # error handling, auth, validation, etc.
  routes/       # route definitions
  controllers/  # request handlers
  services/     # business logic
  repositories/ # data access
  models/       # Mongoose models
  utils/
  validators/   # Joi schemas
  types/
  app.ts        # Express app assembly
  server.ts     # server bootstrap & graceful shutdown
  index.ts      # entry point
tests/          # tests
```

## Conventions

- Strict TypeScript; no implicit any.
- Layered architecture: routes -> controllers -> services -> repositories.
- Joi schemas in `validators/`; env schema in `config/`.
- Pino logger; centralized error handler; async handler wrapper; consistent response envelope.
- Health endpoints: `GET /health`, `GET /ready`.
- Graceful shutdown on SIGTERM/SIGINT (close server + DB connections).
- Security headers, CORS allowlist, rate limiting enabled.

## Authentication

- JWT access + refresh tokens; bcrypt password hashing.

## Testing

- Vitest + Supertest; unit + integration tests.

## Docs for Future Agents

- Keep this file updated when structure or commands change.
- Update the Tech Stack section when dependencies change.
