# Home Server — web UI

React 19 + TypeScript + Vite, Tailwind CSS v4, shadcn/ui (Radix), React Router v7 and TanStack Query.

```bash
npm run dev      # http://localhost:5173, proxies /api to the API on :3000
npm run build    # type-check + production build into dist/
npm run lint     # oxlint
npm run format   # Prettier (src/components/ui is shadcn-generated and left as is)
```

From the repo root, `make web-dev` / `make web-build` do the same. In Docker (`make docker-up`) the
`web` service serves the build with nginx on http://localhost:8080 and proxies `/api`.

## Where things live

- `src/routes.tsx` — **the single source of truth for pages.** Each entry drives both the router
  and the sidebar. Add a page by adding an entry (`page` lazy import, optional `roles`, `feature`,
  `children` for a sidebar group).
- `src/router.tsx` — builds the React Router config from `routes.tsx` (auth, role and feature guards).
- `src/auth/` — `AuthProvider` (React context) + `useAuth`. The access token is kept in memory only;
  the refresh token is an httpOnly cookie set by the API, used to restore the session on reload.
- `src/api/client.ts` — `api()` fetch wrapper: unwraps `{ success, data }`, throws `ApiError` with
  the backend's `code`/`details`, and refreshes the session once on 401 (single-flight, serialised
  across tabs).
- `src/config/` — feature flags from `GET /api/config`; disabled features vanish from the sidebar
  and their routes show Not Found.
- `src/layout/` — app shell: collapsible sidebar (icon rail on desktop, sheet on mobile), top bar.
- `src/features/<feature>/` — pages and TanStack Query hooks per feature.
