# AGENTS.md — DashCraft Specialist Agent Fleet

## Project Context

**Project:** DashCraft — A high-performance, customizable real-time dashboard platform
**Stack:** Rust (Axum) backend + SvelteKit frontend + SurrealDB + WebSockets
**Scale:** 28 tasks across 3 waves, ~1120 minutes estimated
**Market:** EU-first (GDPR, Mollie/SEPA/iDEAL), freemium SaaS

This document defines the specialist agent fleet responsible for executing the DashCraft build. Each agent owns a domain, a file boundary, and a quality bar. Agents coordinate via the dependency graph in BuildSpec; they do not cross domain lines without an explicit handoff.

---

## Fleet Overview

| Agent | Domain | Wave(s) | Owned Tasks |
|---|---|---|---|
| `rust-foundation` | Cargo workspace, config, telemetry, errors | 0 | T02 |
| `data-modeler` | SurrealDB schema, models, migrations | 0 | T01 |
| `auth-engineer` | JWT, sessions, password hashing, auth middleware | 1 | T03, T05 |
| `resilience-engineer` | Rate limiting, circuit breakers, timeouts | 1 | T04 |
| `backend-services` | Domain service layer (dashboard, widget) | 1 | T06, T07 |
| `backend-api` | Axum handlers, routing, request validation | 1 | T08, T09, T13 |
| `realtime-engineer` | WebSocket lifecycle, connection registry, fan-out | 1 | T10 |
| `payments-engineer` | Mollie integration, subscription state sync | 1 | T11 |
| `compliance-engineer` | GDPR, audit logging, data export/deletion | 1 | T12, T26 |
| `frontend-foundation` | Theme system, design tokens, base UI primitives | 2 | T14, T25 |
| `frontend-resilience` | Error boundaries, toasts, API client, retry/CB | 2 | T15, T17 |
| `frontend-auth` | Login/register flows, auth stores | 2 | T16 |
| `dashboard-ux` | Bento grid, layout engine, dashboard CRUD UI | 2 | T18, T23 |
| `widget-ux` | Widget components, configuration UI | 2 | T19 |
| `realtime-client` | WS client, reconnection, connection status | 2 | T20 |
| `interaction-engineer` | Drag-and-drop, touch handlers, mobile responsive | 2 | T21, T27 |
| `navigation-engineer` | Sidebar, header, app shell, routing | 2 | T22 |
| `billing-ux` | Pricing, subscription status, billing portal UI | 2 | T24 |
| `offline-engineer` | Service worker, cache strategy, offline indicator | 2 | T28 |

---

## Wave 0 — Foundation Agents

### `rust-foundation`
**Role:** Establishes the Rust project skeleton and cross-cutting infrastructure that every backend agent depends on.
**Owned Files:** `Cargo.toml`, `src/lib.rs`, `src/config.rs`, `src/telemetry.rs`, `src/error.rs`
**Capabilities:**
- Configures Cargo workspace with Axum, Tokio, SurrealDB driver, `tracing`, `tracing-subscriber`, `serde`, `thiserror`
- Implements layered config (env → file → defaults) via `figment` or `config`
- Sets up structured `tracing` with JSON output for production, pretty for dev
- Defines a unified `AppError` enum implementing `IntoResponse` for Axum
- Exports a clean `lib.rs` surface so binaries and tests share the same core
**Quality Bar:** Zero `unwrap()` in non-test code; all errors typed; telemetry spans on every public boundary.
**Hands off to:** all backend agents in Wave 1.

### `data-modeler`
**Role:** Owns the persistence schema and Rust struct representations of all 10 domain entities.
**Owned Files:** `src/db/mod.rs`, `src/db/models.rs`, `src/db/migrations.rs`, `src/models/*.rs` (10 files)
**Capabilities:**
- Designs SurrealDB schema with explicit `DEFINE TABLE` / `DEFINE FIELD` statements (schema-full where data integrity matters)
- Models: User, Dashboard, Widget, DataSource, Subscription, Session, WebSocketConnection, AuditLog, ApiKey, SharedDashboard
- Implements connection pooling and a `Db` handle injected via Axum state
- Writes idempotent migrations with version tracking
- Provides `From`/`TryFrom` between DB rows and domain models; never leaks DB types past the model boundary
**Quality Bar:** Every field has a documented purpose; indexes defined for all foreign-key lookups; encryption-at-rest fields flagged.
**Risk Watch:** SurrealDB pre-1.0 maturity — abstract DB access behind a trait so a Postgres swap remains feasible.

---

## Wave 1 — Backend Agents

### `auth-engineer`
**Role:** Owns identity, session lifecycle, and the authenticated-request contract.
**Owned Files:** `src/auth/{mod,service,jwt,password}.rs`, `src/middleware/auth.rs`, `src/handlers/auth.rs`, `src/routes/auth.rs`
**Capabilities:**
- Argon2id password hashing with sane parameters
- JWT issuance (HS256 or EdDSA) with short-lived access + refresh token pattern
- Session record stored in SurrealDB for revocation
- Axum extractor `AuthUser` that fails closed on missing/invalid tokens
- `/auth/login` and `/auth/register` with rate-limited brute-force protection (coordinates with `resilience-engineer`)
**Quality Bar:** Constant-time comparisons; no PII in logs; tokens scoped to specific permissions.

### `resilience-engineer`
**Role:** Cross-cutting middleware that protects every endpoint from abuse and cascading failures.
**Owned Files:** `src/middleware/{rate_limit,circuit_breaker,timeout,mod}.rs`
**Capabilities:**
- Tower-layer rate limiter keyed by user_id and IP (separate buckets for auth vs. general)
- Circuit breaker around outbound calls (Mollie, future data sources)
- Per-route timeout middleware with sensible defaults (5s API, 30s WS handshake)
- Emits metrics/spans for every rejection so abuse is observable
**Quality Bar:** Middleware is composable, ordered intentionally, and exposes config via `AppConfig`.

### `backend-services`
**Role:** Pure business logic for dashboards and widgets — no HTTP, no DB SQL leaking out.
**Owned Files:** `src/services/{mod,dashboard,widget}.rs`
**Capabilities:**
- Enforces freemium limits (3 dashboards / 10 widgets) at the service boundary
- CRUD with authorization checks (owner-only, with shared-dashboard exceptions)
- Layout config validation for bento grid integrity
- Returns domain errors that handlers translate to HTTP codes
**Quality Bar:** 100% of authorization decisions live here, never in handlers.

### `backend-api`
**Role:** HTTP surface — Axum handlers, route composition, request/response DTOs, and the main server bootstrap.
**Owned Files:** `src/handlers/{dashboard,widget}.rs`, `src/routes/{dashboard,widget,mod}.rs`, `src/main.rs`, `src/server.rs`
**Capabilities:**
- Implements all dashboard and widget endpoints from the API surface
- Request validation via `validator` crate
- Wires services, middleware stack, CORS, and graceful shutdown
- Mounts WebSocket routes from `realtime-engineer`
- Health and readiness endpoints for DigitalOcean App Platform
**Quality Bar:** Handlers are <30 lines each; every route emits a tracing span with user_id and resource_id.

### `realtime-engineer`
**Role:** WebSocket transport for live widget updates.
**Owned Files:** `src/websocket/{mod,connection,handler}.rs`, `src/services/websocket.rs`
**Capabilities:**
- Per-connection task with heartbeat ping/pong
- Subscription model: clients subscribe to dashboard_id channels
- Backpressure-aware fan-out (drop slow consumers, never block the producer)
- Authenticated handshake reusing `AuthUser` extractor
- Persists active connections in `WebSocketConnection` table for multi-instance routing later
**Quality Bar:** Memory bounded per connection; scale plan documented (sticky sessions or pub/sub bus).

### `payments-engineer`
**Role:** Mollie subscription integration and entitlement reconciliation.
**Owned Files:** `src/services/{subscription,payment}.rs`, `src/external/mollie.rs`
**Capabilities:**
- Mollie API client (customers, subscriptions, mandates) with retries via `resilience-engineer`'s circuit breaker
- Webhook handler that is the source of truth for subscription state
- Reconciliation job that catches missed webhooks (cron-style)
- Entitlement check helper used by `backend-services` for Pro/Team gating
- Plans: Free / Pro €19 / Team €49 with 14-day trial
**Quality Bar:** Idempotent webhook processing keyed by Mollie event ID; double-billing is impossible.

### `compliance-engineer` (Backend half)
**Role:** GDPR rights implementation and audit trail.
**Owned Files:** `src/services/{gdpr,audit}.rs`
**Capabilities:**
- Data export endpoint producing a complete user JSON archive
- Hard-delete cascade with audit record retention (delete data, keep "user X deleted at Y")
- Append-only audit log writes from auth, payment, and dashboard services
- Data retention policy enforcement (background job)
**Quality Bar:** Export completes within 24h SLA; deletion is verifiable and tested.

---

## Wave 2 — Frontend Agents

### `frontend-foundation`
**Role:** Design system bedrock — tokens, theme switching, and primitive components everyone else composes.
**Owned Files:** `src/lib/styles/{global,variables}.css`, `src/lib/stores/theme.ts`, `src/lib/components/ui/{Button,Input,Card,Modal,Skeleton,LoadingSpinner,ProgressBar}.svelte`, `src/lib/stores/loading.ts`
**Capabilities:**
- CSS custom properties for color/spacing/typography scales (light + dark)
- Theme store persisted to localStorage, hydrated SSR-safely
- Premium aesthetic: consistent 8px spacing grid, type scale, motion tokens (cubic-bezier easing)
- Accessible primitives (focus rings, ARIA, keyboard nav)
- Skeleton/loading primitives for use across all data-fetching components
**Quality Bar:** Zero hardcoded colors outside variables.css; all primitives keyboard-navigable.

### `frontend-resilience`
**Role:** Error containment and the API transport layer.
**Owned Files:** `src/lib/components/{ErrorBoundary,ui/Toast,ui/ErrorFallback}.svelte`, `src/lib/stores/{errors,api-status}.ts`, `src/lib/utils/error-handler.ts`, `src/lib/api/{client,circuit-breaker}.ts`,