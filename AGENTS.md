# AGENTS.md

# BentoBoard — Specialist Agent Fleet

This document defines the specialist agent fleet responsible for delivering **BentoBoard**, a real-time dashboard application built on Rust (Axum + Tokio), SurrealDB, and SvelteKit. Each agent owns a clear domain, a defined set of files, and explicit interfaces with sibling agents.

The fleet is coordinated by the **Lead Architect** (orchestrator) and executes work in three waves matching the task graph (`T01–T15`).

---

## Coordination Model

- **Wave 0 (Foundations):** Scaffold, DB, server bootstrap, frontend scaffold.
- **Wave 1 (Domain features):** Auth, widgets, websockets, dashboard UI, realtime client.
- **Wave 2 (Polish & ship):** Landing, theming, tests, deployment.
- **Contracts:** API shapes are defined by the `BackendArchitect` and consumed by the `FrontendArchitect`. WS message schemas are owned by the `RealtimeSpecialist` (shared spec, dual implementation).
- **Definition of done:** Every agent must produce code that compiles, passes lint/format, and is covered by tests delegated to `QASpecialist`.

---

## 1. PlatformSpecialist

**Role:** Owns the repository skeleton, workspace topology, container orchestration, and developer ergonomics.

**Capabilities:**
- Cargo workspace + npm/pnpm workspace setup
- Docker / docker-compose for SurrealDB + backend + frontend
- Environment variable conventions and `.env.example`
- README and onboarding docs

**Owned Files:**
- `Cargo.toml`
- `backend/Cargo.toml`
- `frontend/package.json`
- `docker-compose.yml`
- `README.md`

**Tasks:** `T01`

**Interfaces:** Publishes the canonical project layout consumed by every other agent.

---

## 2. DBSpecialist

**Role:** Owns SurrealDB connectivity, schema definitions, migrations, and data-access conventions.

**Capabilities:**
- SurrealDB client setup (connection pool, namespaces, DBs)
- Schema-full table definitions for `User`, `Session`, `Widget`, `Dashboard`
- Indexes (e.g., unique `email`, `user_id` lookups)
- Migration / bootstrap routines

**Owned Files:**
- `backend/src/db/mod.rs`
- `backend/src/db/schema.rs`

**Tasks:** `T02`

**Interfaces:** Exposes a typed `Db` handle and repository helpers consumed by `AuthSpecialist`, `WidgetSpecialist`, and `RealtimeSpecialist`.

---

## 3. BackendArchitect

**Role:** Owns the Axum HTTP server bootstrap, configuration, global middleware, error handling, and the master router. Acts as the API contract authority.

**Capabilities:**
- Axum app factory, Tokio runtime configuration
- Layered middleware (tracing, CORS, auth extractor mounting)
- Centralized `AppError` / `Result` types
- Configuration loading (env, defaults, secrets)

**Owned Files:**
- `backend/src/main.rs`
- `backend/src/config.rs`
- `backend/src/router.rs`

**Tasks:** `T03`

**Interfaces:** Provides `AppState` (db, jwt secret, ws hub handle) and the router into which feature modules mount their nested routers.

---

## 4. AuthSpecialist

**Role:** Owns the entire authentication subsystem — registration, login, logout, JWT issuance/verification, password hashing, and the auth middleware/extractor.

**Capabilities:**
- Argon2 password hashing
- JWT (HS256) signing & verification with configurable secret + expiry
- Session persistence (revocation on logout)
- `AuthUser` extractor used by other handlers

**Owned Files:**
- `backend/src/auth/mod.rs`
- `backend/src/auth/handlers.rs`
- `backend/src/auth/jwt.rs`
- `backend/src/auth/middleware.rs`

**API Surface:**
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

**Tasks:** `T04`

**Interfaces:** Exports `AuthUser` extractor consumed by `WidgetSpecialist` and `RealtimeSpecialist` for protected endpoints.

---

## 5. WidgetSpecialist

**Role:** Owns the Widget domain — CRUD endpoints, ownership enforcement, and the canonical widget data model on the backend.

**Capabilities:**
- Widget CRUD with strict `user_id` scoping
- Validation of `type`, `title`, `config`, `position`
- Emits change events to the WS hub on create/update/delete

**Owned Files:**
- `backend/src/widgets/mod.rs`
- `backend/src/widgets/handlers.rs`
- `backend/src/widgets/model.rs`

**API Surface:**
- `GET /api/widgets`
- `POST /api/widgets`
- `PATCH /api/widgets/:id`
- `DELETE /api/widgets/:id`
- `GET /api/dashboards`

**Tasks:** `T05`

**Interfaces:** Calls `RealtimeSpecialist::Hub::broadcast(user_id, event)` after each mutation.

---

## 6. RealtimeSpecialist

**Role:** Owns the WebSocket gateway, the in-process broadcaster (hub), and the wire format for realtime updates. Authoritative source for WS message schemas.

**Capabilities:**
- Authenticated WS upgrade (`WS /ws`) using JWT from query/header
- Per-user subscription channels via `tokio::sync::broadcast`
- Heartbeat / ping-pong, graceful disconnect
- Typed event envelope (e.g., `widget.created`, `widget.updated`, `widget.deleted`)

**Owned Files:**
- `backend/src/ws/mod.rs`
- `backend/src/ws/hub.rs`

**Tasks:** `T06`

**Interfaces:** Exposes `Hub` handle through `AppState`; consumed by `WidgetSpecialist` (publish) and `FrontendRealtimeSpecialist` (subscribe).

---

## 7. FrontendArchitect

**Role:** Owns SvelteKit scaffolding, design tokens, global styles, the API client, and frontend conventions. Authority on frontend module layout.

**Capabilities:**
- SvelteKit + Vite configuration, TypeScript strict mode
- Design token system (colors, spacing, radii, typography) for both themes
- Typed `fetch` wrapper with auth header injection and error normalization

**Owned Files:**
- `frontend/svelte.config.js`
- `frontend/vite.config.ts`
- `frontend/src/app.css`
- `frontend/src/lib/theme.ts`
- `frontend/src/lib/api.ts` *(co-owned with `AuthFrontendSpecialist` for the auth client surface)*

**Tasks:** `T07`

**Interfaces:** Provides `api` client and theme tokens consumed by every frontend agent.

---

## 8. AuthFrontendSpecialist

**Role:** Owns user-facing auth flows — login, registration pages, the auth store, and token persistence.

**Capabilities:**
- Form handling with validation + error UX
- JWT storage strategy (httpOnly cookie preferred; localStorage fallback)
- `auth` Svelte store with derived `isAuthenticated` and `user`
- Route guards / redirects for protected pages

**Owned Files:**
- `frontend/src/routes/login/+page.svelte`
- `frontend/src/routes/register/+page.svelte`
- `frontend/src/lib/stores/auth.ts`
- `frontend/src/lib/api.ts` *(auth-related calls)*

**Tasks:** `T08`

**Interfaces:** Consumes `AuthSpecialist`'s API; provides the auth store consumed by `DashboardUISpecialist` and `FrontendRealtimeSpecialist`.

---

## 9. DashboardUISpecialist

**Role:** Owns the bento-grid dashboard experience and individual widget rendering.

**Capabilities:**
- Responsive bento grid (CSS Grid + container queries) adapting mobile ↔ desktop
- `Widget.svelte` renderer for generic key/value metric widgets
- Empty/loading/error states
- Add / edit / delete UX wired to the widgets API

**Owned Files:**
- `frontend/src/routes/dashboard/+page.svelte`
- `frontend/src/lib/components/BentoGrid.svelte`
- `frontend/src/lib/components/Widget.svelte`

**Tasks:** `T09`

**Interfaces:** Consumes widgets API; subscribes to `realtime` store from `FrontendRealtimeSpecialist`.

---

## 10. FrontendRealtimeSpecialist

**Role:** Owns the WebSocket client, reconnection logic, and the realtime store that feeds reactive UI updates.

**Capabilities:**
- Authenticated WS connection with JWT
- Exponential backoff reconnection, heartbeat handling
- Typed event dispatch matching `RealtimeSpecialist`'s schema
- `realtime` store that merges WS events into local widget state

**Owned Files:**
- `frontend/src/lib/ws.ts`
- `frontend/src/lib/stores/realtime.ts`

**Tasks:** `T10`

**Interfaces:** Mirrors `RealtimeSpecialist`'s wire schema; consumed by `DashboardUISpecialist`.

---

## 11. MarketingSpecialist

**Role:** Owns the public, unauthenticated surface area — landing page and hero.

**Capabilities:**
- Premium marketing aesthetic, responsive layout
- CTAs to `/register` and `/login`
- SEO basics (title, meta, OG tags)

**Owned Files:**
- `frontend/src/routes/+page.svelte`
- `frontend/src/lib/components/Hero.svelte`

**Tasks:** `T11`

**Interfaces:** Uses tokens from `FrontendArchitect`.

---

## 12. ThemeSpecialist

**Role:** Owns the dark/light theming system, toggle component, and persistence behavior.

**Capabilities:**
- `prefers-color-scheme` detection with localStorage override
- No-flash hydration (SSR-aware initial class)
- Smooth color transitions across components
- Token-driven CSS variables

**Owned Files:**
- `frontend/src/lib/components/ThemeToggle.svelte`
- `frontend/src/lib/stores/theme.ts`

**Tasks:** `T12`

**Interfaces:** Uses theme tokens defined by `FrontendArchitect`.

---

## 13. QASpecialist

**Role:** Owns automated test strategy across backend integration tests and frontend E2E tests.

**Capabilities:**
- Rust integration tests against a spawned Axum app + ephemeral SurrealDB
- Auth + Widget happy-path and authorization (negative) tests
- Playwright E2E covering dashboard load, widget CRUD, realtime updates
- Test fixtures, factories, and CI-friendly config

**Owned Files:**
- `backend/tests/auth_test.rs`
- `backend/tests/widgets_test.rs`
- `frontend/tests/dashboard.spec.ts`
- `frontend/playwright.config.ts`

**Tasks:** `T13`, `T