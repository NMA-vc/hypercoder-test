# GUARDRAILS.md

**Project:** DashFlow Analytics
**Stack:** Rust (Tokio/Axum) + SurrealDB + SvelteKit + Mollie
**Version:** 1.0.0
**Status:** Binding — violations block PR merge.

---

## 0. Scope & Enforcement

These guardrails are **mandatory** for all 40 tasks (T01–T40). CI must enforce them via:
- `cargo clippy -- -D warnings`, `cargo audit`, `cargo deny`
- `pnpm lint`, `pnpm check`, `eslint`, `prettier --check`
- Snyk/Trivy container scans
- OWASP ZAP baseline scan in staging pipeline

Any exception requires a documented `// GUARDRAIL-EXCEPTION:` comment with ticket ID and security review sign-off.

---

## 1. Security Guardrails (OWASP Top 10 2021)

### 1.1 A01 — Broken Access Control
- **Multi-tenancy isolation is non-negotiable.** Every DB query MUST be scoped by `workspace_id` derived from the authenticated session, NOT from request body/params. Enforce via `tenant.rs` middleware (T09) injecting a `TenantContext` extractor.
- Deny-by-default authorization. No endpoint ships without an explicit role check (`workspace.owner | admin | member`).
- Object-level checks: `GET /dashboards/{id}` MUST verify `dashboard.workspace_id == ctx.workspace_id` before returning data. Add an integration test per resource.
- Public dashboards (`is_public=true`, T38 share tokens) use signed, expiring tokens (HMAC-SHA256, 30-day max TTL). Never expose internal IDs in share URLs.
- WebSocket connections (T11, T30) re-authenticate on connect AND validate workspace scope on every subscription frame.

### 1.2 A02 — Cryptographic Failures
- Passwords: **Argon2id** only (`argon2` crate), `m=19456, t=2, p=1` minimum. No bcrypt, no SHA-anything.
- JWTs (T08): EdDSA (Ed25519) signing keys, 15-min access token, 7-day refresh token, rotation on use. Keys loaded from env/secrets manager — never committed.
- TLS 1.3 only at the edge. HSTS `max-age=31536000; includeSubDomains; preload`.
- Mollie API keys, DB credentials, JWT keys: secrets manager (Vault/Doppler/AWS SM). `.env.example` (T01) MUST contain only placeholders.
- Data at rest: SurrealDB volume encrypted (LUKS/EBS-encrypted). Backups encrypted with separate KMS key.
- Webhook signatures (T14): verify Mollie's `Mollie-Signature` header with constant-time comparison (`subtle` crate).

### 1.3 A03 — Injection
- SurrealDB: parameterized queries ONLY via `surrealdb::sql::Value` bindings. String concatenation into SurrealQL is a CI fail (grep rule: `format!.*SELECT|format!.*UPDATE`).
- Frontend: Svelte's `{@html}` is **banned** outside an allowlisted `SafeHtml` component that runs DOMPurify. ESLint rule enforced.
- All user input validated with `validator` crate (Rust) and `zod` (frontend) at the boundary. Reject, don't sanitize.
- File names, data source connection strings, widget configs: schema-validated JSON; reject unknown fields.

### 1.4 A04 — Insecure Design
- Rate limiting (T04): per-IP AND per-user. Defaults: `100 req/min` general, `5 req/min` for `/auth/login`, `10 req/min` for `/workspaces/{id}/invite`. Use `tower-governor`.
- Circuit breakers (T05) on every external call: Mollie, data sources, SMTP. Half-open after 30s, trip at 50% failure over 20 calls.
- Timeouts (T06): all I/O has a timeout. HTTP client default 5s, DB query 3s, webhook handler 10s. No unbounded `await`.
- Account enumeration prevention: `/auth/login` returns identical response/timing for unknown user vs bad password.
- Invitation tokens (T16): 256-bit random, single-use, 72h TTL, hashed at rest.

### 1.5 A05 — Security Misconfiguration
- **Security headers** mandatory on all HTTP responses (T19 middleware):
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' wss://*.dashflow.app https://api.mollie.com; frame-ancestors 'none'`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- CORS (T19): explicit allowlist of origins. No wildcards. `Access-Control-Allow-Credentials: true` requires exact-match origin.
- Production builds: `RUST_LOG=info` (never `debug`), SvelteKit `vite build` with sourcemaps uploaded to error tracker but NOT served.
- Default-deny firewall; SurrealDB never exposed publicly.

### 1.6 A06 — Vulnerable & Outdated Components
- `cargo audit` and `pnpm audit` run on every PR; high/critical = fail.
- Renovate/Dependabot configured for weekly minor/patch PRs.
- Pinned versions in `Cargo.lock` and `pnpm-lock.yaml` committed.
- SurrealDB version pinned; upgrade requires migration test on staging snapshot.

### 1.7 A07 — Identification & Authentication Failures
- Session management (T17): server-side session store in SurrealDB, `expires_at` enforced server-side. Logout invalidates session row.
- HttpOnly, Secure, SameSite=Lax cookies for session tokens. `__Host-` prefix in production.
- Login throttling: 5 failures → 15-min lockout per (email, IP). Surface generic "credentials invalid."
- MFA hooks reserved in schema even if not shipped v1 (forward-compat).
- WebSocket auth: token in subprotocol header, NOT query string (avoids access-log leakage).

### 1.8 A08 — Software & Data Integrity
- Dependency lockfiles + `cargo deny` policy file checked in (T01).
- CI artifacts signed with cosign; container images SBOM-attested (Syft).
- Mollie webhook (T14): verify signature → check idempotency key → process. Replay-protect with `processed_webhook_ids` table, 30-day window.
- No `eval`, no dynamic `import()` from user input on frontend.

### 1.9 A09 — Security Logging & Monitoring
- Audit log (T18) MUST capture: auth events (login/logout/fail), workspace membership changes, billing events, data source CRUD, dashboard share/export, permission changes. Append-only, immutable in retention window.
- Logs are **structured JSON** (`tracing` + `tracing-subscriber` with `json` formatter, T03). Required fields: `timestamp`, `level`, `trace_id`, `span_id`, `workspace_id`, `user_id`, `event`.
- **PII redaction**: never log passwords, JWTs, Mollie keys, raw connection strings, full email addresses (hash or mask). Enforce via custom `tracing` layer.
- Alerts on: >10 auth failures/min from one IP, circuit breaker trips, 5xx rate >1%, webhook signature failures.

### 1.10 A10 — SSRF
- Data source connections (T12): URL allowlist by scheme (`https`, `postgres`, `mysql`); deny RFC1918/loopback/link-local/metadata IPs (169.254.169.254). Resolve DNS server-side and re-check IP before connect.
- Outbound HTTP via single shared `reqwest::Client` with redirect limit = 3 and forced proxy in production.

---

## 2. Performance Guardrails

### 2.1 Backend SLOs (Rust/Tokio/Axum)
- **p95 latency < 150ms**, **p99 < 400ms** for all REST endpoints excluding `/metrics` queries.
- `/metrics` query: **p95 < 800ms** with default filters; queries exceeding 5s are killed (timeout T06).
- WebSocket message fanout: **p95 < 100ms** from event ingress to subscriber delivery.
- Sustained throughput target: **2,000 RPS per node** at <70% CPU.
- Memory: server process steady-state <512 MB; leaks fail load test if RSS grows >10% over 1h soak.

### 2.2 Async Discipline
- **No blocking calls in async context.** File I/O via `tokio::fs`, CPU-bound work via `tokio::task::spawn_blocking`. Clippy lint `clippy::unwrap_used` denied in `src/`.
- Bounded channels only (`tokio::sync::mpsc::channel(N)`); unbounded channels banned (back-pressure required).
- All `spawn`ed tasks must have a panic handler or be supervised — no fire-and-forget.
- Database connection pool sized = `2 * cores`, max idle 60s.

### 2.3 Database (SurrealDB)
- Indexes required on every field used in `WHERE`/`JOIN`. Schema migration PR must list indexes added.
- N+1 query detection: integration tests assert query count via tracing spans.
- LIVE queries: max 50 per connection; broadcast via in-process pub/sub (T11), not per-client polling.
- Pagination mandatory on any list endpoint; `limit` capped at 200, default 50, cursor-based (`start_at` token).

### 2.4 Frontend SLOs (SvelteKit)
- **Core Web Vitals**: LCP <2.0s, INP <200ms, CLS <0.05 on 4G/mid-tier mobile.
- **JS bundle**: initial route <180 KB gzipped; per-route async chunks <80 KB. CI fails on regression >10%.
- **Time-to-interactive dashboard**: <2.5s on cable, <4.5s on 4G.
- Lighthouse Performance score ≥90 in CI (Playwright + Lighthouse CI).

### 2.5 Frontend Implementation Rules
- Charts (T29, T32): use lightweight libs (uPlot or Chart.js with tree-shaking), NOT D3 unless justified. Lazy-load chart bundle.
- Bento grid (T28): CSS Grid native, virtualize widgets if count >20.
- Images: AVIF/WebP with `<picture>` fallback; explicit `width`/`height` (CLS).
- Cache strategy (T40): SWR pattern via stores; invalidate on mutation + WebSocket events. Stale-while-revalidate window ≤5min for analytics.
- WebSocket client (T30): exponential backoff reconnect (1s → 30s, jitter), heartbeat every 25s, queue outbound during reconnect (offline queue T39).

### 2.6 Caching & CDN
- Static assets: immutable, hashed filenames, `Cache-Control: public, max-age=31536000, immutable`.
- HTML: `Cache-Control: no-cache`.
- API: explicit `Cache-Control: private, no-store` by default; opt-in caching for read-only public endpoints.
- CDN (Cloudflare/Fastly) in front of static + signed dashboard exports.

---

## 3. Styling & Design Guard