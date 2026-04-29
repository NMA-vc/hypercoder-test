# AGENTS.md

**Project:** BentoStack
**Stack:** Rust (Axum + Tokio) · SurrealDB · SvelteKit
**Lead Architect Brief:** Specialist agent fleet for parallel execution of the BuildSpec task graph. Each agent owns a clear slice of the codebase, has explicit capabilities, and coordinates through well-defined contracts (DB schema, OpenAPI surface, WebSocket message envelope).

---

## Coordination Model

- **Source of truth:** This file + `BUILDSPEC.json` at repo root.
- **Contract handoffs:**
  - DB schema → `db/schema.surql` (owned by DBSpecialist)
  - HTTP contract → `api/openapi.yaml` (owned by APISpecialist)
  - WS envelope → `core/src/realtime/protocol.rs` (owned by RealtimeSpecialist)
  - Shared TS types → `web/src/lib/api/types.ts` (generated, consumed by FrontendArchitect)
- **Branching:** One agent = one feature branch, rebased onto `main` after each task completes.
- **Merge gate:** OpsSpecialist must green-light CI (lint + test + build) before merge.

---

## Repository Layout (authoritative)

```
bentostack/
├── api/                # Axum HTTP + WS server (binary crate)
├── core/               # Domain logic, services, DTOs (lib crate)
├── db/                 # SurrealDB client, repos, migrations (lib crate)
├── web/                # SvelteKit app
├── docker/             # Dockerfiles, compose
├── docs/               # Deployment + architecture docs
├── tests/              # Cross-crate integration + E2E
└── BUILDSPEC.json
```

---

## Agent Fleet

### 1. RepoSteward
**Role:** Bootstraps and maintains the monorepo skeleton, tooling, and workspace plumbing.
**Owns:**
- `Cargo.toml` (workspace root)
- `rust-toolchain.toml`, `rustfmt.toml`, `clippy.toml`
- `package.json` (root, for tooling)
- `.editorconfig`, `.gitignore`, `.gitattributes`
- `web/package.json`, `web/svelte.config.js`, `web/vite.config.ts`, `web/tsconfig.json`
**Capabilities:** Cargo workspaces, SvelteKit scaffolding, pnpm/npm config, formatter/linter wiring, pre-commit hooks.
**Primary tasks:** T1
**Hands off to:** DBSpecialist, APISpecialist, FrontendArchitect.

---

### 2. DBSpecialist
**Role:** Designs and maintains the SurrealDB schema, migrations, and repository layer.
**Owns:**
- `db/Cargo.toml`
- `db/src/lib.rs`
- `db/src/client.rs` (connection pool, config)
- `db/src/schema.surql` + `db/migrations/*.surql`
- `db/src/repos/{users,sessions,workspaces,items,widgets,activity}.rs`
- `db/tests/`
**Capabilities:** SurrealDB query language (SurrealQL), schema design, indexing, migration ordering, transaction patterns, repository abstractions.
**Primary tasks:** T2
**Contracts produced:** `db::repos::*` traits + concrete impls consumed by `core`.

---

### 3. APISpecialist (Axum Server Lead)
**Role:** Owns the Axum HTTP server skeleton, middleware stack, routing, error handling, and the non-auth/non-WS endpoints.
**Owns:**
- `api/Cargo.toml`
- `api/src/main.rs`, `api/src/server.rs`
- `api/src/routes/mod.rs`, `api/src/routes/health.rs`
- `api/src/routes/me.rs`, `api/src/routes/workspace.rs`, `api/src/routes/items.rs`, `api/src/routes/widgets.rs`, `api/src/routes/activity.rs`
- `api/src/middleware/{tracing,cors,error}.rs`
- `api/src/error.rs`, `api/src/state.rs`
- `api/openapi.yaml`
**Capabilities:** Axum 0.7+, Tower middleware, Tokio runtime config, structured error responses (problem+json), request validation, OpenAPI authoring.
**Primary tasks:** T3, T5, T6
**Depends on:** DBSpecialist (repos), CoreSpecialist (services).

---

### 4. AuthSpecialist
**Role:** Implements signup, login, logout, JWT issuance/verification, password hashing, and session management.
**Owns:**
- `core/src/auth/mod.rs`
- `core/src/auth/{password,jwt,session,service}.rs`
- `api/src/routes/auth.rs`
- `api/src/middleware/auth.rs` (extractor for `AuthUser`)
- `core/src/auth/tests/`
**Capabilities:** `argon2` password hashing, `jsonwebtoken` crate, secure cookie handling, session token rotation, axum extractors, timing-attack-safe comparisons.
**Primary tasks:** T4
**Contracts produced:** `AuthUser` extractor used by all protected routes; `POST /api/auth/{signup,login,logout}` endpoints.
**Risks owned:** JWT revocation strategy (documented in `docs/auth.md`).

---

### 5. RealtimeSpecialist
**Role:** Owns the WebSocket endpoint, broadcast bus, message envelope, and per-workspace pub/sub fan-out.
**Owns:**
- `api/src/routes/ws.rs`
- `core/src/realtime/mod.rs`
- `core/src/realtime/{protocol,bus,session}.rs`
- `core/src/realtime/tests/`
**Capabilities:** `axum::extract::ws`, `tokio::sync::broadcast`, backpressure, heartbeat/ping, JSON envelopes, auth handshake, graceful disconnect.
**Primary tasks:** T7
**Contracts produced:** WS message schema (typed, mirrored to TS in `web/src/lib/realtime/protocol.ts`).
**Risks owned:** Single-instance broadcast assumption documented; multi-instance pub/sub deferred.

---

### 6. CoreSpecialist (Domain Services)
**Role:** Owns the domain layer between repos and routes — workspace, items, widgets, activity services. Emits realtime events on mutations.
**Owns:**
- `core/Cargo.toml`
- `core/src/lib.rs`
- `core/src/domain/{workspace,items,widgets,activity,user}.rs`
- `core/src/services/{workspace,items,widgets,activity,profile}.rs`
- `core/src/dto/`
**Capabilities:** Service-oriented design, DTO mapping, validation rules, event emission to RealtimeSpecialist's bus, transactional boundaries.
**Primary tasks:** Supports T5, T6
**Depends on:** DBSpecialist (repos), RealtimeSpecialist (event bus handle).

---

### 7. FrontendArchitect
**Role:** Owns the SvelteKit application structure, routing, stores, API client, theming, and the public landing.
**Owns:**
- `web/src/app.html`, `web/src/app.css`, `web/src/app.d.ts`
- `web/src/lib/api/{client,types,errors}.ts`
- `web/src/lib/stores/{auth,theme,workspace,items,activity}.ts`
- `web/src/lib/theme/`
- `web/src/routes/+layout.svelte`, `web/src/routes/+layout.ts`
- `web/src/routes/+page.svelte` (landing)
- `web/src/routes/(auth)/login/+page.svelte`, `web/src/routes/(auth)/signup/+page.svelte`
- `web/src/routes/profile/+page.svelte`
- `web/static/`
**Capabilities:** SvelteKit 2, Svelte 5 runes, typed fetch wrappers, SSR-safe stores, dark mode persistence (localStorage + `prefers-color-scheme`), form actions.
**Primary tasks:** T8, T9, T13
**Contracts consumed:** OpenAPI spec from APISpecialist, Auth endpoints from AuthSpecialist.

---

### 8. DashboardSpecialist (Bento UI Lead)
**Role:** Builds the bento-grid dashboard, widget rendering, items CRUD UI, and the live activity feed view.
**Owns:**
- `web/src/routes/dashboard/+page.svelte`, `web/src/routes/dashboard/+page.ts`
- `web/src/lib/components/bento/{BentoGrid,BentoCell,WidgetRenderer}.svelte`
- `web/src/lib/components/widgets/*.svelte`
- `web/src/lib/components/items/{ItemList,ItemCard,ItemEditor,ItemDeleteDialog}.svelte`
- `web/src/lib/components/activity/ActivityFeed.svelte`
- `web/src/lib/realtime/{client,protocol}.ts`
- `web/src/lib/motion/` (transitions, easings)
**Capabilities:** CSS grid + container queries, Svelte transitions/motion, optimistic updates, WebSocket client with reconnect/backoff, accessible interactive components.
**Primary tasks:** T10, T11, T12
**Depends on:** FrontendArchitect (stores, API client), RealtimeSpecialist (WS protocol).

---

### 9. QASpecialist
**Role:** Owns end-to-end tests, accessibility audits, and final UX polish review.
**Owns:**
- `tests/e2e/` (Playwright)
- `web/playwright.config.ts`
- `tests/integration/` (Rust integration tests against ephemeral SurrealDB)
- `docs/qa-checklist.md`
**Capabilities:** Playwright, axe-core, Rust integration testing with `testcontainers`, animation timing review, keyboard nav verification, contrast checks.
**Primary tasks:** T14
**Authority:** Can block merge on a11y or E2E regressions.

---

### 10. OpsSpecialist
**Role:** Owns containerization, CI/CD, observability config, and deployment documentation.
**Owns:**
- `docker/Dockerfile.api`, `docker/Dockerfile.web`, `docker/docker-compose.yml`
- `.github/workflows/ci.yml`, `.github/workflows/release.yml`
- `api/src/observability.rs` (tracing-subscriber init, JSON logs)
- `docs/deployment.md`, `docs/operations.md`, `docs/architecture.md`
- `.env.example`
**Capabilities:** Multi-stage Docker builds, distroless images, GitHub Actions, `tracing` + OpenTelemetry exporters, healthcheck wiring, secrets management guidance.
**Primary tasks:** T15
**Cross-cutting:** Owns `/healthz` wiring with APISpecialist; owns CI gate on every PR.
