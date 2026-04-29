# GUARDRAILS.md

> **Project:** BentoDash
> **Stack:** Rust (Axum/Tokio) + SvelteKit + SurrealDB
> **Version:** 1.0.0 (aligned with `tectic_v1`)
> **Owner:** Security & Performance Engineering
> **Status:** Authoritative — all PRs must pass these gates before merge.

This document defines the non-negotiable engineering guardrails for BentoDash. Every feature (F1–F8), task (T1–T15), and API endpoint listed in the BuildSpec inherits these rules. Violations block release.

---

## 1. Security Guardrails (OWASP-aligned)

BentoDash maps directly to the **OWASP Top 10 (2021)** and **OWASP ASVS L2** baseline. The following controls are mandatory.

### 1.1 Authentication & Session Management (F1, T4)

| Control | Requirement |
|---|---|
| Password storage | `argon2id` (memory: 19 MiB, iterations: 2, parallelism: 1 minimum). **Never** bcrypt/MD5/SHA-only. |
| Password policy | Min 12 chars, checked against HIBP-style breached-password list (offline bloom filter acceptable). |
| JWT algorithm | `EdDSA` (Ed25519) **or** `HS256` with ≥256-bit secret from env. **Never** `none`. |
| JWT lifetime | Access token: **15 min**. Refresh token: **7 days**, rotated on use. |
| Session revocation | Server-side `Session` table is **source of truth**; JWT `jti` checked against revocation list on every authenticated request. Mitigates risk noted in BuildSpec. |
| Login throttling | 5 failed attempts / 15 min / IP+email tuple → exponential backoff. Returns generic `401` (no user enumeration). |
| Logout | `POST /api/auth/logout` MUST invalidate the `jti` server-side, not just clear the client cookie. |

### 1.2 Transport & Headers

- **TLS 1.3 only** in production; HTTP → HTTPS redirect at the edge.
- Mandatory response headers (set via Axum `tower-http` middleware):
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss:; frame-ancestors 'none'`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- JWTs delivered as `HttpOnly; Secure; SameSite=Lax` cookies. **No `localStorage`.**

### 1.3 Input Validation & Injection (OWASP A03)

- All request bodies validated via `serde` + `validator` crate at the API boundary. Reject unknown fields (`#[serde(deny_unknown_fields)]`).
- SurrealDB queries **must** use parameterized statements (`db.query("...").bind(...)`). String interpolation into SurrealQL is a release blocker.
- Path/query params validated for type, length (≤256 chars unless declared), and charset.
- Output encoding: SvelteKit's default escaping must not be bypassed (`{@html}` requires security review + DOMPurify).

### 1.4 Authorization & Multi-tenant Isolation (per-user)

- Every `/api/*` handler (except `/api/health`, `/api/auth/*`) extracts `user_id` from the verified JWT and scopes **all** DB queries with `WHERE user_id = $auth_user`.
- Add an automated test for each resource endpoint proving cross-user access returns `404` (not `403`, to avoid existence leaks).
- IDOR check on `PATCH /api/widgets/:id`, `DELETE /api/widgets/:id`: verify ownership **before** mutation.

### 1.5 WebSocket Security (F4, T7)

- `/ws` upgrade requires a valid JWT cookie **and** an `Origin` header allowlist check.
- Per-connection rate limit: **30 messages/sec**, burst 60. Excess → close with code `1008`.
- Outbound messages are filtered by `user_id` server-side; clients cannot subscribe to other users' channels.
- Idle timeout: **60s** without ping → close.

### 1.6 Dependency & Supply Chain

- `cargo audit` and `cargo deny` run in CI on every PR; `RUSTSEC` advisories of `high`+ severity block merge.
- `pnpm audit --prod` for SvelteKit; high/critical block merge.
- Dependencies pinned via `Cargo.lock` and `pnpm-lock.yaml` (committed). Renovate weekly.
- Docker base images: `rust:1-slim` and `node:lts-slim` pinned by digest. Final image is `distroless` or `gcr.io/distroless/cc`.

### 1.7 Secrets

- **Zero secrets in repo.** Enforced via `gitleaks` pre-commit + CI.
- Runtime config from env vars only. JWT signing key, DB credentials, and CORS origins are required at boot — app refuses to start otherwise.

### 1.8 Logging & Monitoring (without leaking PII)

- Use `tracing` with structured JSON output.
- **Forbidden in logs:** passwords, JWTs, full email addresses (hash or mask `u***@domain`), widget `payload` contents.
- Log every auth event (login success/fail, logout, token refresh) to the `Activity` table.

---

## 2. Performance Guardrails

BentoDash markets itself as "high-performance." These targets are SLOs, not aspirations.

### 2.1 Backend Latency Targets (server-side, p95 under 100 RPS)

| Endpoint class | p50 | p95 | p99 |
|---|---|---|---|
| `GET /api/health` | < 5 ms | < 15 ms | < 30 ms |
| `GET /api/me`, `/api/preferences` | < 10 ms | < 40 ms | < 100 ms |
| `GET /api/widgets`, `/api/activity` | < 25 ms | < 80 ms | < 150 ms |
| `POST/PATCH/DELETE` (writes) | < 30 ms | < 100 ms | < 200 ms |
| `POST /api/auth/login` (incl. argon2) | < 150 ms | < 250 ms | < 400 ms |
| WS message fan-out (server processing) | < 5 ms | < 20 ms | < 50 ms |

### 2.2 Frontend Performance (Lighthouse + Web Vitals, mobile profile)

| Metric | Target |
|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.0 s |
| INP (Interaction to Next Paint) | ≤ 150 ms |
| CLS (Cumulative Layout Shift) | ≤ 0.05 |
| TTFB | ≤ 200 ms |
| JS bundle (initial route) | ≤ 150 KB gzipped |
| Lighthouse Perf score | ≥ 90 |

### 2.3 Resource & Concurrency Budgets

- Tokio runtime: multi-threaded, worker count = `num_cpus`. Blocking calls **must** use `spawn_blocking` (e.g., argon2).
- Single API instance must sustain **≥ 2,000 RPS** on a 4-vCPU/8 GiB box for read endpoints.
- Memory ceiling per container: **512 MiB** baseline, **1 GiB** alert threshold.
- WebSocket: **≥ 5,000 concurrent connections** per node (mitigates BuildSpec risk #2). If exceeded, document horizontal scaling path before launch.

### 2.4 Database (SurrealDB)

- Indexes required at launch: `User.email` (unique), `Session.token`, `Widget.user_id`, `Activity.user_id + created_at DESC`, `WidgetData.widget_id + timestamp DESC`.
- Query budget: any single SurrealQL query > 50 ms in dev → flagged in CI via `EXPLAIN`-style logging.
- Connection pool: min 4, max 32. Health-checked.
- N+1 queries are a **release blocker** — enforce via repository-layer review (T3).

### 2.5 Caching & Compression

- HTTP responses use `gzip` and `br` via `tower-http::compression`.
- `GET /api/widgets`, `/api/preferences` set `Cache-Control: private, max-age=0, must-revalidate` + strong `ETag`. 304 responses required for unchanged payloads.
- Static SvelteKit assets: `Cache-Control: public, max-age=31536000, immutable` with hashed filenames.

### 2.6 Performance Testing Gate

- `T14` E2E suite includes a `k6` smoke run: 100 VUs / 2 min on `/api/widgets`. p95 regression > 20% vs baseline blocks merge.
- WebSocket load test: 1,000 concurrent connections, 1 msg/sec each, for 60s. Server CPU < 70%, no dropped messages.

---

## 3. Styling Guardrails (System Defaults, Premium Aesthetic)

The brief calls for "premium design with smooth transitions and dark mode." Achieve this with system primitives — **no custom design tokens drift**.

### 3.1 Design System Foundation

- **Tailwind CSS** is the single styling layer. No CSS-in-JS, no ad-hoc `<style>` blocks except in Svelte component scoped styles for layout-only concerns.
- Use the **system font stack** by default — no webfont loading on critical path:
  ```css
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI",
               Roboto, "Helvetica Neue", Arial, sans-serif;
  ```
- Optional display font (e.g., Inter) loaded via `font-display: swap` and self-hosted (no Google Fonts CDN — see §4.3).

### 3.2 Theming (F5, T13)

- Two themes only: `light` and `dark`. Default = `prefers-color-scheme`.
- Theme stored in `Preference.theme` and mirrored in a cookie (not localStorage) to prevent FOUC during SSR.
- Color tokens defined **once** in `tailwind.config.js` under semantic names (`bg-surface`, `bg-elevated`, `text-primary`, `text-muted`, `border-subtle`, `accent`). Components reference semantic tokens only — **no raw hex values in components**.
- Contrast: All text/background pairs meet **WCAG 2.2 AA** (4.5:1 body, 3:1 large). Dark mode included.

### 3.3 Bento Grid (F2, T10)

- Built with CSS Grid (`grid-template-areas` or `grid-auto-flow: dense`). **No JS layout libraries** for MVP.
- Breakpoints: mobile-first, `sm:640`, `md:768`, `lg:1024`, `xl:1280`. Single-column < `md`.
- Widget min size: 1×1 cell; max: 3×2. Enforced server-side in `Widget.position` validation.

### 3.4 Motion & Interaction

- Transitions: `150–250 ms`, `cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind's default `ease-in-out`).
- Respect `prefers-reduced-motion: reduce` — disable non-essential transitions and animations.
- Focus rings visible on all interactive elements (`focus-visible:ring-2`). Never `outline: none` without replacement.

### 3.5 Accessibility (