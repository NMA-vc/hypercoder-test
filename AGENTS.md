# AGENTS.md

**Project:** BentoDash
**Stack:** Rust (Axum + Tokio) · SvelteKit · SurrealDB · Docker
**Architecture:** Specialist agent fleet with clear ownership boundaries to prevent merge conflicts and enable parallel execution.

---

## Coordination Model

- **Orchestrator** assigns tasks from the `task_graph` to specialists based on file ownership.
- Specialists **own** files (exclusive write) and **consume** contracts from peers (read-only).
- Cross-cutting changes (e.g., new API surface) require a **contract handshake**: BackendCore publishes OpenAPI/types → FrontendArchitect consumes.
- All agents respect `CONTRIBUTING.md` conventions and run `cargo fmt`, `cargo clippy`, `pnpm lint`, `pnpm check` before handoff.

---

## 1. BackendCore (Rust Foundation Agent)

**Role:** Owns the Rust workspace skeleton, async runtime, HTTP server, middleware stack, error model, and configuration.

**Capabilities:**
- Cargo workspace + crate layout (`api`, `core`, `db`, `shared`)
- Axum router composition, Tower middleware (CORS, tracing, compression)
- Tokio runtime tuning, graceful shutdown
- `thiserror`/`anyhow` error taxonomy → HTTP status mapping
- Structured logging via `tracing` + `tracing-subscriber`
- Config via `figment`/`envy` (env + `.env`)
- Health endpoint (`GET /api/health`)

**Owned Files:**
- `Cargo.toml`, `Cargo.lock`, `rust-toolchain.toml`
- `crates/api/src/main.rs`, `crates/api/src/router.rs`
- `crates/api/src/middleware/**`
- `crates/api/src/error.rs`
- `crates/api/src/config.rs`
- `crates/api/src/routes/health.rs`
- `crates/shared/**`

**Tasks:** T1, (supports T2–T7), part of T14

---

## 2. DBSpecialist (SurrealDB & Persistence Agent)

**Role:** Owns the SurrealDB connection pool, schema migrations, repository pattern, and data model definitions.

**Capabilities:**
- SurrealDB Rust client (`surrealdb` crate) connection lifecycle
- Schema-first migrations via SurrealQL files + a small migration runner
- Repository trait per entity (`UserRepo`, `WidgetRepo`, etc.) with async CRUD
- Domain model structs with `serde` + validation (`validator`)
- Query optimization, indexing strategy for `user_id` scoping
- Transactional helpers and per-user data isolation guards

**Owned Files:**
- `crates/db/Cargo.toml`, `crates/db/src/lib.rs`
- `crates/db/src/connection.rs`
- `crates/db/src/migrations/**` (`.surql` files + runner)
- `crates/db/src/models/{user,session,widget,widget_data,activity,preference}.rs`
- `crates/db/src/repos/**`

**Consumes:** BackendCore config + error types.
**Publishes:** Repository traits + model structs (used by AuthSpecialist, WidgetDomain, RealtimeEngineer).

**Tasks:** T2, T3

---

## 3. AuthSpecialist (Identity & Sessions Agent)

**Role:** Owns email/password authentication, JWT issuance/verification, session lifecycle, and auth middleware.

**Capabilities:**
- Argon2 password hashing (`argon2` crate)
- JWT (HS256) with `jsonwebtoken` — access + refresh strategy
- Session table for revocation (logout = delete session row)
- Axum extractor `AuthUser` for protected routes
- Signup/login/logout/me endpoints with input validation
- Rate-limit hooks (Tower layer placeholder)

**Owned Files:**
- `crates/api/src/routes/auth.rs` (signup, login, logout)
- `crates/api/src/routes/me.rs` (GET/PATCH /api/me)
- `crates/api/src/middleware/auth.rs`
- `crates/api/src/extractors/auth_user.rs`
- `crates/core/src/auth/**` (password, jwt, session services)

**Consumes:** `UserRepo`, `SessionRepo` from DBSpecialist.
**Publishes:** `AuthUser` extractor + JWT contract for FrontendArchitect.

**Tasks:** T4

---

## 4. WidgetDomain (Widget & Preferences Business Logic Agent)

**Role:** Owns widget CRUD, activity logging, and user preferences endpoints + business rules.

**Capabilities:**
- Widget CRUD with ownership checks (user scoping enforced)
- Position/layout validation for bento grid
- Activity event emission (writes to `Activity` + broadcasts via realtime hub)
- Preferences upsert (theme, settings JSON)
- Pagination + filtering for `/api/activity`

**Owned Files:**
- `crates/api/src/routes/widgets.rs`
- `crates/api/src/routes/activity.rs`
- `crates/api/src/routes/preferences.rs`
- `crates/core/src/widgets/**`
- `crates/core/src/activity/**`
- `crates/core/src/preferences/**`

**Consumes:** `WidgetRepo`, `ActivityRepo`, `PreferenceRepo`, `AuthUser` extractor.
**Publishes:** Domain events to RealtimeEngineer's hub.

**Tasks:** T5, T6

---

## 5. RealtimeEngineer (WebSocket Hub Agent)

**Role:** Owns the WebSocket endpoint, connection registry, pub/sub fan-out, and live widget data delivery.

**Capabilities:**
- Axum `WebSocketUpgrade` handler with JWT handshake
- Per-user channel registry (`DashMap<UserId, Vec<Tx>>`)
- Tokio broadcast channels for widget/activity events
- Heartbeat (ping/pong), reconnect-friendly protocol
- Typed message envelopes (`ServerMsg`, `ClientMsg`) with serde
- Backpressure-safe send strategy

**Owned Files:**
- `crates/api/src/routes/ws.rs`
- `crates/core/src/realtime/hub.rs`
- `crates/core/src/realtime/messages.rs`
- `crates/core/src/realtime/registry.rs`

**Consumes:** AuthSpecialist's JWT verifier; events from WidgetDomain.
**Publishes:** WS message schema (shared with FrontendArchitect).

**Tasks:** T7

---

## 6. FrontendArchitect (SvelteKit Foundation Agent)

**Role:** Owns SvelteKit project structure, Tailwind/theming, routing, layout shell, and shared UI primitives.

**Capabilities:**
- SvelteKit (Svelte 5 / runes) + Vite + TypeScript
- Tailwind CSS 4 + design tokens, dark mode via `class` strategy
- Global layout, navigation, toast/notification system
- Shared UI primitives: `Button`, `Card`, `Modal`, `Input`, `Skeleton`
- API client wrapper (`fetch` with auth header injection)
- Type generation pipeline from backend (manual or `ts-rs`)

**Owned Files:**
- `web/package.json`, `web/svelte.config.js`, `web/vite.config.ts`, `web/tsconfig.json`
- `web/tailwind.config.ts`, `web/postcss.config.js`, `web/src/app.css`
- `web/src/app.html`, `web/src/routes/+layout.svelte`, `web/src/routes/+layout.ts`
- `web/src/lib/ui/**` (shared primitives)
- `web/src/lib/api/client.ts`
- `web/src/lib/types/**`

**Tasks:** T8

---

## 7. AuthUIEngineer (Frontend Auth Agent)

**Role:** Owns login/signup pages, session store, route guards, and profile/preferences UI.

**Capabilities:**
- `/login`, `/signup` pages with form validation (Zod or Valibot)
- Session store (`$lib/stores/session.ts`) — JWT in httpOnly cookie or localStorage + refresh
- Route guards via `+layout.server.ts` redirects
- Profile page (`/me`) with edit form
- Preferences page + dark mode toggle (writes to `/api/preferences` + applies `class="dark"`)

**Owned Files:**
- `web/src/routes/(auth)/login/+page.svelte`
- `web/src/routes/(auth)/signup/+page.svelte`
- `web/src/routes/(app)/profile/+page.svelte`
- `web/src/routes/(app)/preferences/+page.svelte`
- `web/src/lib/stores/session.ts`
- `web/src/lib/stores/theme.ts`
- `web/src/lib/api/auth.ts`, `web/src/lib/api/me.ts`, `web/src/lib/api/preferences.ts`

**Consumes:** API contracts from AuthSpecialist + WidgetDomain (preferences).
**Tasks:** T9, T13

---

## 8. DashboardUIEngineer (Bento Grid & Widget UI Agent)

**Role:** Owns the bento dashboard layout, widget renderers, and widget CRUD UI.

**Capabilities:**
- CSS Grid–based responsive bento layout with drag/resize (using `svelte-dnd-action` or custom)
- Widget registry — renderer per `widget.type`
- Create/Edit widget modal with dynamic config form
- Optimistic updates, smooth Framer-Motion-style transitions (Svelte transitions + `motion`)
- Empty states, skeleton loaders

**Owned Files:**
- `web/src/routes/(app)/+page.svelte` (dashboard)
- `web/src/lib/dashboard/BentoGrid.svelte`
- `web/src/lib/dashboard/WidgetCard.svelte`
- `web/src/lib/dashboard/widgets/**` (per-type renderers)
- `web/src/lib/dashboard/WidgetEditor.svelte`
- `web/src/lib/api/widgets.ts`

**Consumes:** WidgetDomain API, RealtimeEngineer message types.
**Tasks:** T10, T11

---

## 9. RealtimeClientEngineer (WS Client Agent)

**Role:** Owns the WebSocket client, reconnect logic, and reactive binding of live data into widget stores.

**Capabilities:**
- Typed WS client with auto-reconnect + exponential backoff
- Subscription model — components subscribe by `widget_id`
- Activity feed live rendering (`/activity` route)
- Connection status indicator

**Owned Files:**
- `web/src/lib/realtime/client.ts`
- `web/src/lib/realtime/stores.ts`
- `web/src/lib/realtime/messages.ts` (mirrors backend schema)
- `web/src/routes/(app)/activity/+page.svelte`
- `web/src/lib/ui/ConnectionStatus.svelte`

**Consumes:** RealtimeEngineer's message schema, session JWT.
**Tasks:** T12

---

## 10. QAEngineer (Testing & Health Agent)

**Role:** Owns unit/integration/E2E tests, CI configuration, and health-check verification.

**Capabilities:**
- Rust integration tests using `axum::Router` + `tower::ServiceExt`
- Repository t