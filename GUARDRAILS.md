# GUARDRAILS.md

**Project:** Dashboard Pro
**Stack:** Rust (Axum + Tokio) / SvelteKit / SurrealDB
**Version:** 1.0.0
**Status:** Binding — violations block PR merge

---

## 1. Security Guardrails (OWASP Top 10 2021 Aligned)

### 1.1 A01 — Broken Access Control
- **MUST** enforce authorization at the handler layer via `src/middleware/auth.rs`; never trust client-supplied `user_id`.
- **MUST** scope every dashboard/widget query by authenticated `user_id` (`WHERE user_id = $session.user`). Reject cross-tenant access with `403`, log to `AuditLog`.
- **MUST NOT** expose internal IDs in URLs without ownership checks; deny-by-default routing.
- WebSocket `/ws/:dashboard_id` **MUST** re-validate dashboard ownership on every connection upgrade — no relying on initial HTTP auth alone.

### 1.2 A02 — Cryptographic Failures
- Passwords: **Argon2id** only (`m=19456, t=2, p=1` minimum). No bcrypt, no SHA-*.
- Sessions: opaque random tokens (≥256 bits, `rand::rngs::OsRng`) stored server-side. **No JWT for session state** (despite `src/auth/jwt.rs` existing — restrict JWTs to short-lived signed payloads only, ≤5min TTL).
- TLS 1.3 only at edge. HSTS `max-age=31536000; includeSubDomains; preload`.
- Encryption at rest: SurrealDB volume must be on encrypted block storage (LUKS/AWS EBS-encrypted equivalent).
- **MUST NOT** log secrets, tokens, password hashes, or Mollie API keys. Enforce via `tracing` redaction filter.

### 1.3 A03 — Injection
- All SurrealDB queries **MUST** use parameterized bindings (`.bind(...)`). String interpolation into queries = automatic PR rejection.
- Frontend: never use `{@html}` with user data. Sanitize via DOMPurify if unavoidable.
- WebSocket messages: validate against typed schema (`serde` with `deny_unknown_fields`) before dispatch.

### 1.4 A04 — Insecure Design
- Rate limit per route class (see §2.4). Defined in `src/resilience/rate_limiter.rs`.
- Circuit breakers (`src/resilience/circuit_breaker.rs`) **MUST** wrap all Mollie and SurrealDB calls.
- Idempotency keys required on `POST /dashboards`, `POST /widgets`, and Mollie webhook handlers.

### 1.5 A05 — Security Misconfiguration
- Production builds: `RUST_LOG=info`, `debug_assertions=false`, no stack traces returned to clients.
- CORS: explicit allowlist of frontend origin(s). No `*`. Credentials-mode requires exact origin match.
- Security headers (set in `src/middleware/`):
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; connect-src 'self' wss://...; style-src 'self' 'unsafe-inline'`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: geolocation=(), camera=(), microphone=()`
- Cookies: `Secure; HttpOnly; SameSite=Lax; Path=/`. Session cookie name must not leak framework.

### 1.6 A06 — Vulnerable & Outdated Components
- `cargo audit` and `cargo deny` **MUST** pass in CI. No `RUSTSEC` advisories of severity ≥ Medium permitted in `main`.
- `npm audit --audit-level=high` blocking on frontend.
- Dependabot/Renovate enabled; security patches merged within 7 days.
- Pin SurrealDB version explicitly; document migration path before any minor bump (pre-1.0 risk).

### 1.7 A07 — Identification & Authentication Failures
- Login throttling: 5 attempts / 15 min / IP+email pair. Exponential backoff after 3.
- Session rotation on privilege change (subscription upgrade, password reset).
- Logout **MUST** invalidate server-side session record, not just clear cookie.
- No password complexity rules beyond NIST: min 12 chars, check against HIBP top-10k offline list.

### 1.8 A08 — Software & Data Integrity
- Mollie webhook signatures **MUST** be verified before processing. Reject unsigned/invalid → `401`.
- All container images built reproducibly via pinned base image digests (`FROM rust:1.XX@sha256:...`).
- GitHub Actions: pin actions to commit SHA, not tags. Require signed commits on `main`.

### 1.9 A09 — Security Logging & Monitoring
- `AuditLog` entries required for: login (success/fail), logout, dashboard CRUD, subscription changes, data export, GDPR deletion requests, admin actions.
- Logs **MUST** include: timestamp (UTC, RFC3339), user_id, action, resource, IP (hashed), result. Retain 365 days.
- Alert on: >10 failed logins/min, circuit breaker open >2min, 5xx rate >1%, WebSocket reconnect storms.

### 1.10 A10 — SSRF
- DataSource `connection_config` URLs **MUST** be validated against allowlist of schemes (`https`, `wss`) and deny private IP ranges (RFC1918, link-local, metadata IPs `169.254.169.254`).
- Outbound HTTP client (`reqwest`) configured with no-redirect-to-internal policy.

### 1.11 GDPR / Compliance Specifics
- Data residency: all SurrealDB and Redis instances **MUST** be hosted in EU region (Frankfurt/Amsterdam).
- Right to deletion: `src/gdpr/` **MUST** support full user erasure ≤30 days, including audit log pseudonymization (not deletion — replace `user_id` with hash).
- Right to export: JSON export endpoint, complete within 72h, signed download link expires 24h.
- Cookie consent: required before any non-essential cookie/telemetry is set. Reject = full functionality minus analytics.
- DPA template available at `/legal/dpa`; sub-processor list maintained in repo.

---

## 2. Performance Guardrails

### 2.1 Backend SLOs (Rust/Axum)
| Metric | Target (p95) | Hard Ceiling (p99) |
|---|---|---|
| `GET /dashboards` | 80 ms | 200 ms |
| `POST /dashboards` | 120 ms | 300 ms |
| `GET /widgets/:dashboard_id` | 60 ms | 150 ms |
| `POST /auth/login` (incl. Argon2) | 250 ms | 500 ms |
| WebSocket message broadcast | 50 ms | 150 ms |
| Health check | 10 ms | 25 ms |

- All HTTP handlers **MUST** have a timeout middleware (`src/middleware/timeout.rs`) — default 5s, login 2s, exports 30s.
- DB query budget: ≤3 queries per HTTP request unless justified in PR description.

### 2.2 Frontend Performance (SvelteKit)
- **Core Web Vitals** (75th percentile, mid-tier mobile, 4G):
  - LCP ≤ 2.0s
  - INP ≤ 200ms
  - CLS ≤ 0.1
- Initial JS payload ≤ **150 KB gzipped** for landing/auth routes; ≤ **300 KB gzipped** for app shell.
- Route-level code splitting mandatory; lazy-load widget components.
- Skeleton screens (`src/lib/components/Skeleton.svelte`) **MUST** appear within 100ms of nav.

### 2.3 Resource Limits
- Max request body: 1 MiB (10 MiB for `/dashboards/*/import`).
- Max WebSocket message: 64 KiB. Ping/pong every 30s; idle disconnect at 90s.
- Max concurrent WS connections per user: 5.
- Max widgets per dashboard: 50 (free), 200 (pro), 500 (enterprise).

### 2.4 Rate Limits (per authenticated user, sliding window)
| Route Class | Limit |
|---|---|
| `POST /auth/login` | 5 / 15 min (per IP+email) |
| Read endpoints (`GET /*`) | 600 / min |
| Write endpoints (`POST/PUT/DELETE`) | 120 / min |
| Mollie webhook (per IP) | 60 / min |
| WebSocket connect | 10 / min |

Anonymous: ⅓ of authenticated quotas, keyed by IP.

### 2.5 Database (SurrealDB)
- Indexes required on: `user.email`, `dashboard.user_id`, `widget.dashboard_id`, `session.token`, `audit_log.user_id+created_at`.
- N+1 queries banned — use `FETCH` or batched lookups.
- Connection pool: min 5, max 50. Acquisition timeout 1s.
- Slow query log threshold: 100 ms.

### 2.6 Real-time / WebSocket
- Broadcast fanout uses `tokio::sync::broadcast` with bounded channel (capacity 256). Slow consumers dropped + reconnected, never block producers.
- No per-message DB read on broadcast — cache widget state in memory, invalidate on write.

---

## 3. Styling & Code Guardrails

### 3.1 Rust Code Style
- `cargo fmt` (rustfmt default) and `cargo clippy -- -D warnings` block CI.
- Edition 2021. MSRV pinned in `rust-toolchain.toml`.
- **Forbidden:** `unwrap()`, `expect()`, `panic!()` in non-test code (use `thiserror` + `Result<T, AppError>`). Lints enforced via `#![deny(clippy::unwrap_used, clippy::expect_used, clippy::panic)]`.
- `unsafe` requires module-level `// SAFETY:` comment and architect approval.
- Error handling: single `AppError` enum in `src/error.rs`, `IntoResponse` impl maps to sanitized HTTP errors (no internal details leaked).
- Module layout: handlers → services → repositories → db. **No** cross-layer skipping.
- Public APIs documented with `///` doc comments; `#![warn(missing_docs)]` on lib crates.

### 3.2 TypeScript / Svelte Style
- ESLint (`@typescript-eslint/strict`) + Prettier; CI blocking.
- `tsconfig.json`: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`.
- **No `any`.** Use `unknown` + narrowing.
- Svelte components: `<script lang="ts">` mandatory. Props typed via `interface Props`.
- File naming: components `PascalCase.svelte`, stores/utils `kebab-case.ts`.
- Max component size: 250 LOC. Extract logic to `$lib/utils/` or stores.

### 3.3 Design System (Premium Aesthetic)
- All colors, spacing, radii, shadows defined as CSS custom properties in `src/lib/styles/design-system.css`. **No hardcoded hex values** in components.
- Theming via `data-theme="light|dark"` on `<html>`; both themes WCAG **AA** minimum (4.5:1 text