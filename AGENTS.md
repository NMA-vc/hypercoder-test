# AGENTS.md — Dashboard Pro Specialist Fleet

> Lead Architect: Agent fleet definition for the **Dashboard Pro** build (Rust/Axum + SvelteKit + SurrealDB, 38 tasks across 3 waves, ~1520 min).
> Each agent owns a non-overlapping slice of the codebase. Coordination happens via the wave gates and the file-ownership boundaries declared in the BuildSpec `task_graph`.

---

## Fleet Overview

| Agent | Domain | Wave(s) | Owns Tasks |
|---|---|---|---|
| `@platform-foundation` | Bootstrap, config, errors, telemetry, server | 0 | T02, T03, T04 |
| `@db-architect` | SurrealDB schema, migrations, connection pool | 0–1 | T01 |
| `@resilience-engineer` | Circuit breakers, rate limiters, timeouts | 0 | T05 |
| `@auth-engineer` | Users, sessions, JWT, password, login flow | 1 | T06, T07, T08 |
| `@dashboard-domain` | Dashboards & widgets domain (model→handler) | 1 | T09, T10, T11, T12 |
| `@realtime-engineer` | WebSocket infra + live dashboard updates | 1 | T13, T14 |
| `@billing-engineer` | Subscriptions + Mollie integration | 1 | T15 |
| `@compliance-officer` | GDPR, audit log, data export/deletion | 1 | T16 |
| `@sre-agent` | Health checks, monitoring, ops, Docker, CI | 1 | T17 |
| `@docs-agent` | OpenAPI spec, API docs | 1 | T18 |
| `@frontend-foundation` | SvelteKit setup, design system, theming | 2 | T19, T24, T25 |
| `@frontend-resilience` | Error boundaries, toasts, offline, telemetry | 2 | T20, T23, T36, T37, T38 |
| `@frontend-api` | API client, auth state, WS client | 2 | T21, T22, T28 |
| `@frontend-app-shell` | App layout, auth pages, navigation | 2 | T26, T27 |
| `@frontend-dashboard` | Bento grid, dashboard pages, widgets, realtime sync | 2 | T29, T30, T31, T32 |
| `@frontend-commerce` | Subscription UI, payment error handling | 2 | T33 |
| `@frontend-mobile` | Mobile responsive, touch gestures | 2 | T34 |
| `@frontend-export` | Data export, PDF generation | 2 | T35 |

---

## Wave 0 — Foundation Agents

### `@platform-foundation`
**Role:** Establish the Rust process model: configuration loading, error taxonomy, telemetry pipeline, and the Axum HTTP server skeleton with global middleware.
**Owns:** T02, T03, T04
**Capabilities:**
- Tracing crate setup (structured logs, OTLP-compatible spans), metrics façade
- `config-rs` layered config (default.toml → production.toml → env overrides)
- Single canonical `AppError` enum with `IntoResponse` mapping; thiserror + anyhow boundaries
- Axum router composition, tower middleware stack (timeout, request-id, trace, compression)
- Graceful shutdown via tokio signal handlers
**Inputs:** None (wave 0).
**Outputs consumed by:** every backend agent.
**Definition of done:** `cargo run` produces a server binding to configured port, emitting structured logs with request IDs and exposing the middleware contract documented in `src/server.rs`.

### `@db-architect`
**Role:** Own the SurrealDB persistence layer: connection lifecycle, migrations, and schema definitions for all eight data models.
**Owns:** T01
**Capabilities:**
- SurrealDB Rust SDK connection pooling with reconnect/backoff
- Idempotent migration runner reading `migrations/*.sql`
- Schema-first table definitions for User, Dashboard, Widget, Subscription, Session, DataSource, WebSocketConnection, AuditLog
- Index strategy for `user_id` lookups and `dashboard_id` joins
**Risk-aware:** explicitly hedges against the SurrealDB pre-1.0 risk by isolating SDK usage behind repository traits so it can be swapped.
**Outputs:** `Db` handle injected into Axum app state.

### `@resilience-engineer`
**Role:** Provide reusable resilience primitives consumed by repositories, external clients, and handlers.
**Owns:** T05
**Capabilities:**
- Circuit breaker (closed/open/half-open) with metrics hooks
- Token-bucket rate limiter (per-IP and per-user)
- Tower-compatible layers so handlers can opt in declaratively
**Coordination contract:** exposes builder API; consumers pass policy from config (T03).

---

## Wave 1 — Backend Domain Agents

### `@auth-engineer`
**Role:** End-to-end authentication: user storage, password hashing, sessions (Redis-backed), JWT issuance, and the `/auth/login` + `/auth/logout` endpoints with rate-limit + circuit-breaker integration.
**Owns:** T06, T07, T08
**Capabilities:**
- Argon2id password hashing
- Session model with Redis store and TTL refresh
- JWT signing/verification (Ed25519 preferred)
- Login endpoint with account-lockout via `@resilience-engineer` rate limiter
- `auth` middleware exporting an `AuthenticatedUser` extractor for other handlers
**Depends on:** T01, T02, T05.
**Provides to:** T11, T12, T13, T15, T16, T22.

### `@dashboard-domain`
**Role:** CRUD slices for Dashboards and Widgets — the product's core domain. Owns models, repositories, services, and HTTP handlers.
**Owns:** T09, T10, T11, T12
**Capabilities:**
- Layout config validation (bento-grid JSON shape)
- Widget polymorphism by `type` discriminator with config validators
- Authorization checks (owner-only) via `AuthenticatedUser` extractor
- Per-route rate limiting and circuit breakers around DataSource fetches
- Emits domain events consumed by `@realtime-engineer`
**Depends on:** T01, T02, T04, T05, T06, T07.

### `@realtime-engineer`
**Role:** WebSocket transport, connection registry, and the broadcast pipeline that pushes dashboard mutations to subscribed clients.
**Owns:** T13, T14
**Capabilities:**
- Axum `WebSocketUpgrade` handler with auth handshake
- In-memory connection manager keyed by `(user_id, dashboard_id)`; pluggable for future Redis pub/sub
- Heartbeat/ping protocol; idle disconnect with timeout protection
- Subscribes to `@dashboard-domain` events; fans out with backpressure-aware sends
**Depends on:** T04, T05, T07, T09, T10.
**Risk:** explicitly designs the connection manager behind a trait so a Redis pub/sub backend can replace the in-memory one when scale demands it.

### `@billing-engineer`
**Role:** Mollie subscription lifecycle: plan catalog, checkout creation, webhook ingestion, entitlement state machine.
**Owns:** T15
**Capabilities:**
- Mollie HTTP client wrapped in circuit breaker
- Webhook handler with signature verification + idempotency keys
- Entitlement model: `free | trial | pro | enterprise | past_due | canceled` with downgrade grace period
- Tier-based feature flags exposed to other services (e.g., dashboard count enforcement)
**Depends on:** T01, T02, T05, T06.

### `@compliance-officer`
**Role:** GDPR posture: audit logging of data access, data export endpoint, right-to-deletion workflow, retention policies.
**Owns:** T16
**Capabilities:**
- Append-only `AuditLog` writes from interceptors on user/dashboard/subscription mutations
- Export job that streams a user's data as JSON archive
- Deletion job with cascading anonymization, respecting legal-hold flags
- DPA-aligned data classification helpers
**Depends on:** T01, T02, T06.

### `@sre-agent` (backend half)
**Role:** Operational endpoints and runtime health introspection.
**Owns:** T17
**Capabilities:**
- `/health/live`, `/health/ready` separating liveness from dependency readiness
- DB / Redis / Mollie probes with timeouts
- `/metrics` Prometheus exposition
**Depends on:** T01, T02, T04.

### `@docs-agent`
**Role:** Single source of truth for the public API contract.
**Owns:** T18
**Capabilities:**
- `utoipa`-derived OpenAPI 3.1 spec generated from handler annotations
- Markdown reference in `docs/api.md` with curl examples
- Schema diffing in CI to catch breaking changes
**Depends on:** T08, T11, T12.

---

## Wave 2 — Frontend Agents

### `@frontend-foundation`
**Role:** SvelteKit project scaffolding, the design system, and theme infrastructure that every other frontend agent builds on.
**Owns:** T19, T24, T25
**Capabilities:**
- SvelteKit + Vite + TypeScript config, adapter selection (Vercel/Netlify static)
- Design tokens in CSS custom properties; dark/light theme stylesheets
- Base UI primitives: `Button`, `Input`, `Card` with a11y baked in
- Theme store with `prefers-color-scheme` detection + persisted user choice
**Depends on:** T01, T04 (only for env shape).
**Provides to:** all other frontend agents.

### `@frontend-resilience`
**Role:** Cross-cutting UX safety net: error boundaries, toasts, skeleton loaders, offline handling, and client-side telemetry.
**Owns:** T20, T23, T36, T37, T38
**Capabilities:**
- `ErrorBoundary.svelte` + `hooks.client.ts` global error capture
- Toast/notification store with priority + dedupe
- Skeleton + page-loader components driven by a global loading store
- Network/online-status store + offline queue for mutations
- Performance & error telemetry shipping to backend (T02 sink)
**Depends on:** T19, T20 (self), T02.
**Note:** `@frontend-resilience` and `@frontend-api` share `hooks.client.ts` — coordinate via clear sectioning; `@frontend-resilience` owns the file (T38).

### `@frontend-api`
**Role:** Typed HTTP and WebSocket clients with retry, backoff, and the auth state that drives them.
**Owns:** T21, T22, T28
**Capabilities:**
- Fetch wrapper with retry, exponential backoff, circuit-breaker awareness, and request cancellation
- Auth store + SvelteKit `hooks.server.ts` for SSR session hydration
- Route guards (`requireAuth`, `requireTier`)
- WebSocket client with reconnect-with-jitter and heartbeat
**Depends on:** T08, T07, T13, T19.

### `@frontend-app-shell`
**Role:** Authentication pages and the authenticated app chrome (sidebar, header, layout).
**Owns:** T26, T27
**Capabilities:**
- Login/register pages with form validation, loading + error states
- `(app)` layout with sidebar, header, theme toggle slot, fallback dashboard for empty/error states
**Depends on:** T22, T23, T24, T25,