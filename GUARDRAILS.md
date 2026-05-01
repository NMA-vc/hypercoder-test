# GUARDRAILS.md

**Project:** DashCraft
**Stack:** Rust (Axum) + SvelteKit + SurrealDB
**Version:** 1.0
**Audience:** All contributors (human + AI agents). These rules are enforced in CI and reviewed at PR time.

---

## 1. Security Guardrails (OWASP Top 10 Aligned)

### 1.1 Authentication & Session Management (A07: Identification & Auth Failures)
- **Password hashing:** Use `argon2` (argon2id) with `m=19456, t=2, p=1` minimum. **Never** bcrypt < cost 12, **never** SHA/MD5.
- **JWT:** Use `EdDSA` or `HS256` with ≥256-bit secret from env (`JWT_SECRET`). Access tokens TTL ≤ **15 min**; refresh tokens ≤ **7 days**, rotated on use.
- **Session table** (`Session`) is authoritative — JWT revocation MUST check DB on sensitive ops (delete, billing, GDPR export).
- **Login endpoint** rate-limited to **5 attempts / 15 min per IP+email**. Return generic `401` (no user enumeration).
- **Registration:** require email verification before paid features unlock. Validate email via RFC 5322 + DNS MX check.
- Cookies: `HttpOnly; Secure; SameSite=Lax; Path=/`. Refresh token in cookie, access token in memory (never `localStorage`).

### 1.2 Authorization (A01: Broken Access Control)
- **Every** handler touching `Dashboard`, `Widget`, `DataSource`, `Subscription` MUST verify `resource.user_id == session.user_id` OR a valid `SharedDashboard` token grants access.
- Default-deny: new routes require explicit `#[require_auth]` or `#[require_plan(Pro)]` macro. Public routes are an allowlist in `src/routes/mod.rs`.
- IDOR test: integration test for every `:id` route confirming 403/404 on cross-tenant access. **CI fails if any `:id` route lacks this test.**
- API keys (`ApiKey`) scoped by `permissions` enum — no wildcard scopes.

### 1.3 Injection & Input Validation (A03)
- All inputs deserialized via `serde` + `validator` crate. No raw string concatenation into SurrealDB queries — use parameterized `surrealdb::sql::Value` bindings.
- Frontend: never use `{@html}` on user-provided content. Widget configs sanitized via `DOMPurify` before render.
- File uploads (future): MIME sniffing + size cap (5 MB), stored outside webroot.

### 1.4 Cryptography & Data Protection (A02)
- TLS 1.2+ enforced at edge (DigitalOcean App Platform). HSTS: `max-age=31536000; includeSubDomains; preload`.
- At-rest encryption: SurrealDB cloud volume encryption + application-layer AES-256-GCM for `DataSource.connection_config` (contains third-party secrets). Keys in DO secret store, rotated annually.
- **No secrets in code, logs, or error messages.** CI runs `gitleaks` on every PR.

### 1.5 SSRF, XXE, Deserialization (A08, A10)
- Outbound HTTP (Mollie, future data sources) restricted via allowlist domain validator. Block RFC1918/loopback unless dev mode.
- `reqwest` clients have **5s connect / 10s total** timeout, **no redirects to private IPs**.
- Reject XML payloads outright (JSON only).

### 1.6 Security Headers & CORS
- `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' wss://*.dashcraft.app https://api.mollie.com; frame-ancestors 'none'`
- `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), camera=(), microphone=()`
- CORS: explicit origin allowlist (`https://dashcraft.app`, dev localhost). **No `*`**.

### 1.7 Logging & Monitoring (A09)
- `tracing` structured logs in JSON. **PII redaction filter** for `email`, `password`, `token`, `key_hash`, `mollie_*`.
- All auth events, billing events, GDPR actions, and 4xx/5xx → `AuditLog`.
- Alert on: >10 failed logins/min, >1% 5xx rate, circuit breaker open >60s.

### 1.8 Dependency & Supply Chain
- `cargo audit` and `npm audit --audit-level=high` block CI.
- `cargo deny` enforces license allowlist (MIT/Apache/BSD/MPL).
- Lockfiles committed; Dependabot weekly; pin Docker base images by digest.

### 1.9 GDPR Specific
- `/privacy/export` returns full user JSON within request (sync ≤ 30 s; async if larger).
- `/privacy/delete` performs **30-day soft delete** then hard purge (audit log retained anonymised for 12 months — legal basis).
- Cookie consent gate **before** any non-essential cookie/script. Mollie + analytics behind consent.
- DPA in place with SurrealDB Cloud, DigitalOcean, Mollie. Data residency: EU regions only.

---

## 2. Performance Guardrails

### 2.1 Backend Latency Budgets (p95, measured in production)
| Endpoint class           | p95   | p99   |
|--------------------------|-------|-------|
| Auth (login/register)    | 250ms | 500ms |
| Dashboard/Widget CRUD    | 100ms | 250ms |
| GET list endpoints       | 80ms  | 200ms |
| WebSocket message RTT    | 50ms  | 150ms |

CI perf test (k6 smoke) fails build if local p95 regresses >20% vs `main`.

### 2.2 Database
- **Every query** must hit an index. `EXPLAIN` reviewed in PRs touching `src/db/`.
- N+1 forbidden — use batched fetches or graph traversals. PR template asks "Any list endpoint? Show the query plan."
- Connection pool: min 5 / max 25 per instance. Statement timeout: 5s.
- Pagination mandatory on list endpoints, default 25 / max 100.

### 2.3 WebSocket
- Per-connection rate limit: **10 msgs/sec inbound**, **30 msgs/sec outbound**.
- Max 5 concurrent WS connections per user. Reject with `429`-equivalent close code.
- Broadcast updates **debounced** to 5s minimum interval per widget (matches BuildSpec 5–30s).
- Heartbeat every 30s; idle close at 90s.
- Total WS connections per node capped (start 10k); horizontal scale before cap.

### 2.4 Frontend (SvelteKit)
- **Bundle budgets:** initial JS ≤ **150 KB gzip**, total route ≤ **250 KB gzip**. CI fails on regression.
- **Core Web Vitals targets** (75th percentile, mobile):
  - LCP ≤ 2.0s, INP ≤ 200ms, CLS ≤ 0.05
- Images: AVIF/WebP, `loading="lazy"`, explicit `width/height`.
- Code-split per route. No barrel imports from large libs (`lodash` → `lodash-es` named imports).
- Skeleton loaders required for any data fetch >300ms expected.
- Service Worker: cache-first for static, stale-while-revalidate for API GET, network-only for mutations.

### 2.5 Resilience
- All external calls (Mollie, future integrations) wrapped in:
  - **Timeout** (10s default)
  - **Retry** (max 3, exponential backoff w/ jitter, only on 5xx/network)
  - **Circuit breaker** (open after 5 consecutive failures, half-open after 30s)
- Frontend API client mirrors backend resilience (`src/lib/api/client.ts`).

### 2.6 Caching
- HTTP caching: `Cache-Control: private, no-store` on auth/user data; `public, max-age=31536000, immutable` on hashed assets.
- In-process cache for subscription entitlements (TTL 60s) to avoid Mollie call per request.

---

## 3. Styling & Design Guardrails ("Premium Aesthetic")

### 3.1 Design Tokens (single source: `src/lib/styles/variables.css`)
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px. **No magic numbers.**
- **Type scale:** 12 / 14 / 16 / 18 / 24 / 32 / 48 px. Body = 16px / 1.5 line-height.
- **Font:** Inter (variable) for UI; JetBrains Mono for data/code. Self-hosted (`woff2`), `font-display: swap`.
- **Radii:** 4 / 8 / 12 / 16 px. Cards = 12px standard.
- **Color:** OKLCH-defined palette with light/dark pairs. Min contrast **WCAG AA (4.5:1 text, 3:1 UI)**.
- **Shadows:** 3-tier elevation (`--shadow-sm/md/lg`), no arbitrary `box-shadow`.

### 3.2 Theme System
- Theme via `data-theme="light|dark"` on `<html>`, persisted in `theme_preference` (User model) + localStorage fallback.
- All colors via CSS custom properties. **No hex/rgb literals in components.**
- Respect `prefers-color-scheme` on first visit; respect `prefers-reduced-motion` for all animations.

### 3.3 Motion
- Durations: 150ms (micro), 250ms (standard), 400ms (entrance). Easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
- No animation > 500ms. No autoplay. All transitions cancellable.
- Drag-and-drop uses transform (GPU), never `top/left`.

### 3.4 Component Rules
- All UI built on primitives in `src/lib/components/ui/`. No bespoke buttons in feature code.
- Every interactive element: keyboard accessible, visible focus ring (`:focus-visible`), `aria-*` where needed.
- Forms: labels always present (visible or `sr-only`), inline error message, `aria-invalid` on error.
- Touch targets ≥ **44×44 px** on mobile.

### 3.5 Responsive
- Mobile-first. Breakpoints: 640 / 768 / 1024 / 1280 px.
- Bento grid collapses to single column < 768px. Drag-and-drop disabled on touch < 1024px (use long-press menu instead).
- Test matrix: iPhone SE (375), iPad (768), Desktop (1440).

### 3.6 Accessibility (non-negotiable)
- Lighthouse A11y score ≥ **95** in CI.
- `axe-core` automated checks per component story.
- Color is never the sole carrier of meaning.
- Skip-to-content link, semantic landmarks (`<nav>`, `<main>`, `<aside>`).

---

## 4. Code Quality & Process

- **Rust:** `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` all required.
- **TS/Svelte:** `prettier`, `eslint`, `svelte-check`, `vitest` required.
- **Coverage:** ≥ 70% lines on `src/services/`, `src/auth/`, `src