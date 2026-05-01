# AGENTS.md — DashFlow Analytics Specialist Fleet

**Project:** DashFlow Analytics
**Stack:** Rust (Tokio/Axum) + SurrealDB + SvelteKit + Mollie
**Fleet Size:** 12 specialists across 3 waves (40 tasks)
**Coordination:** Wave-gated execution; agents claim tasks by ID; file ownership is exclusive per task.

---

## Operating Principles (All Agents)

1. **File ownership is exclusive** — never edit files outside your task's `owned_files`.
2. **Dependencies are gospel** — verify upstream task completion before starting.
3. **Observability first** — every async boundary gets a `tracing` span; every error gets context.
4. **Resilience by default** — external calls wrapped in timeout + circuit breaker.
5. **Multi-tenant safety** — every query scoped by `workspace_id`; no exceptions.
6. **Commit granularity** — one task = one PR; reference task ID in commit message.

---

## Wave 0 — Foundation (Tasks T01–T07)

### `agent.platform-bootstrapper`
**Role:** Owns the Rust project skeleton, dependency graph, and environment scaffolding.
**Tasks:** T01
**Capabilities:**
- Cargo workspace layout with feature flags
- Tokio runtime configuration (multi-threaded scheduler tuning)
- Axum + Tower middleware baseline
- `.env` schema with `dotenvy` loading
- Workspace-level lints (`clippy::pedantic`, `deny(unsafe_code)`)
**Hand-off:** Provides the module tree all other Rust agents extend.

### `agent.persistence-engineer`
**Role:** SurrealDB schema authority and connection pool owner.
**Tasks:** T02, T07
**Capabilities:**
- SurrealDB v2.x schemafull table design
- `surrealdb` Rust client connection pooling with health probes
- SCHEMAFULL definitions for User, Workspace, Dashboard with `DEFINE FIELD` constraints
- Migration discipline via versioned `.sql` files
- Index strategy for tenant-scoped queries (`workspace_id` first)
**Constraints:** Must expose typed `Repo<T>` traits — no raw query strings leak past `src/db/`.

### `agent.observability-engineer`
**Role:** Telemetry spine for the entire backend.
**Tasks:** T03
**Capabilities:**
- `tracing` + `tracing-subscriber` with JSON formatter for prod, pretty for dev
- OpenTelemetry-compatible span exporters
- Correlation ID propagation across async tasks
- Structured log fields (`workspace_id`, `user_id`, `request_id`)
**Hand-off:** All subsequent agents inject the `Tracer` handle from `src/telemetry.rs`.

### `agent.resilience-engineer`
**Role:** Failure-mode specialist — rate limiting, circuit breaking, timeouts.
**Tasks:** T04, T05, T06
**Capabilities:**
- Token-bucket rate limiter as Tower layer (per-IP and per-workspace)
- Circuit breaker state machine (closed/open/half-open) with `tracing` events
- Generic `with_timeout<F>` wrapper using `tokio::time::timeout`
- Backpressure-aware concurrency limits
**Output Contract:** Reusable middleware + utility types — consumed by every handler in Wave 1.

---

## Wave 1 — Backend Services (Tasks T08–T20)

### `agent.identity-engineer`
**Role:** Authentication, sessions, and credential security.
**Tasks:** T08, T17
**Capabilities:**
- Argon2id password hashing (parameters tuned for ~250ms)
- JWT (HS256) issuance + refresh token rotation
- Session store backed by SurrealDB with TTL cleanup
- Login rate-limit hooks via `agent.resilience-engineer`'s middleware
**Threat Model:** Credential stuffing, JWT replay, session fixation.

### `agent.tenancy-engineer`
**Role:** Multi-tenant boundary enforcement and workspace lifecycle.
**Tasks:** T09, T16
**Capabilities:**
- Tenant-resolution middleware (extract workspace from path/JWT, attach to request extensions)
- Workspace CRUD with owner/member role checks
- Invitation tokens (signed, single-use, TTL-bound) with email dispatch hook
**Critical Invariant:** No service layer below this agent ever queries without a `WorkspaceContext`.

### `agent.product-api-engineer`
**Role:** Core product endpoints — dashboards, widgets, data sources, metrics, analytics.
**Tasks:** T10, T12, T13, T15
**Capabilities:**
- RESTful handler design with typed request/response DTOs
- Query aggregation pipelines for metrics with filter pushdown to SurrealDB
- Data source credential encryption-at-rest (AES-256-GCM with per-workspace KEK)
- Analytics rollups (hourly/daily) computed via background tasks
**Dependencies:** Consumes resilience layer for all external data source connections.

### `agent.realtime-engineer`
**Role:** WebSocket transport and live update fan-out.
**Tasks:** T11
**Capabilities:**
- Axum WebSocket upgrade handling
- Per-dashboard subscription registry (`DashMap<DashboardId, Vec<ConnectionHandle>>`)
- Heartbeat + reconnection protocol
- SurrealDB LIVE query subscription bridging to WS frames
**Performance Target:** 10k concurrent connections per node.

### `agent.billing-engineer`
**Role:** Mollie subscription integration and webhook integrity.
**Tasks:** T14
**Capabilities:**
- Mollie API client with circuit breaker (Mollie outage ≠ user-facing error)
- Webhook signature verification + idempotency keys
- Subscription state machine (trialing → active → past_due → cancelled)
- Tier enforcement hooks (downgrade on payment failure after grace period)
**Compliance:** No PAN data ever touches our database — Mollie tokens only.

### `agent.compliance-engineer`
**Role:** Audit trail and GDPR plumbing.
**Tasks:** T18
**Capabilities:**
- Append-only audit log (workspace_id, actor, action, resource, IP, UA)
- Structured event taxonomy (auth.login, dashboard.update, data.export, etc.)
- Retention policy enforcement (configurable per workspace)
**Hand-off:** All other Wave 1 agents emit audit events via `audit::log!()` macro.

### `agent.server-integrator`
**Role:** Composes the HTTP server, route table, and middleware stack.
**Tasks:** T19, T20
**Capabilities:**
- Axum router composition with nested workspace routes
- CORS policy (strict allowlist; credentials true for app domain)
- Health endpoints: `/health/live` (process), `/health/ready` (DB+deps)
- Graceful shutdown (drain WS, flush logs, close pool)
**Final Wave 1 Step:** Smoke tests before Wave 2 unblocks.

---

## Wave 2 — Frontend (Tasks T21–T40)

### `agent.frontend-platform-engineer`
**Role:** SvelteKit foundation, build pipeline, and resilience primitives.
**Tasks:** T21, T22, T23, T24, T39
**Capabilities:**
- SvelteKit + Vite + TypeScript strict mode
- Tailwind config aligned to design tokens
- Global error boundary + toast system + skeleton/empty/offline fallback components
- Retry utilities with exponential backoff + offline queue (IndexedDB-backed)
**Hand-off:** Every UI agent below uses these primitives — no custom error/toast paths.

### `agent.design-system-engineer`
**Role:** Premium visual language — components, theming, motion.
**Tasks:** T27, T36, T37
**Capabilities:**
- Headless component primitives (Button, Card, Input) with variant API
- CSS custom properties for dark/light themes; `prefers-color-scheme` + manual override
- Mobile-first responsive nav (sidebar collapse, mobile drawer)
- Animation utilities (Svelte transitions, FLIP, spring physics) — the "design signature"
**Aesthetic Bar:** Screenshot-worthy by default.

### `agent.app-experience-engineer`
**Role:** User-facing flows — auth, workspaces, dashboards, widgets, sharing.
**Tasks:** T25, T26, T28, T29, T38
**Capabilities:**
- Auth pages with form validation + protected route guards via `hooks.server.ts`
- Workspace selector + tenant-aware layout
- Bento-grid layout engine with drag/resize (pointer events, keyboard a11y)
- Widget plugin system (Chart, Metric, Table) with config panels
- Public share tokens + PNG/PDF export
**UX Discipline:** Optimistic updates everywhere a user clicks.

### `agent.data-experience-engineer`
**Role:** Data source UIs, query builder, billing, analytics, members.
**Tasks:** T31, T32, T33, T34, T35
**Capabilities:**
- Data source connection wizard with credential masking
- Visual query builder (filters, group-by, time range) compiling to backend metric queries
- Mollie checkout redirect flow + subscription management UI
- Workspace analytics charts + activity feed
- Member invite/list/role management
**Reuses:** Chart components from `agent.app-experience-engineer`.

### `agent.realtime-client-engineer`
**Role:** WebSocket client, caching, and live state synchronization.
**Tasks:** T30, T40
**Capabilities:**
- Reconnecting WebSocket client with backoff + connection status store
- Optimistic update layer with rollback on server reject
- Cache store with TTL + tag-based invalidation
- Conflict resolution for concurrent dashboard edits (last-write-wins with toast warning)
**Dependencies:** Pairs tightly with `agent.realtime-engineer` (Wave 1) on protocol.

---

## Coordination Protocol

| Stage | Gate Criteria |
|---|---|
| Wave 0 → 1 | T01–T07 merged; CI green; SurrealDB schema applied in dev |
| Wave 1 → 2 | T19/T20 merged; `/health/ready` returns 200; OpenAPI spec published |
| Wave 2 → Release | All 40 tasks merged; e2e suite green; Lighthouse ≥ 90 mobile |

**Conflict Resolution:** Lead architect arbitrates cross-agent file disputes within 1 business day.
**Escalation Triggers:** Any task exceeding 1.5× estimated duration, any cross-wave dependency violation, any new external service introduction.