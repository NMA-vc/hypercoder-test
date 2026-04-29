# GUARDRAILS.md

> **Project:** BentoBoard
> **Stack:** Rust (Axum + Tokio) · SurrealDB · SvelteKit
> **Scope:** Single-tenant, self-hosted MVP
> **Owner:** Security & Performance Engineering

This document defines the **non-negotiable guardrails** for the BentoBoard project. All code, infrastructure, and design decisions MUST comply with these rules. PRs that violate guardrails MUST be blocked at CI.

---

## 1. Security (OWASP-Aligned)

BentoBoard follows the **OWASP ASVS Level 2** baseline and the **OWASP Top 10 (2021)** as primary threat references.

### 1.1 Authentication & Session Management (A07)

- **Password hashing:** MUST use `argon2` (Argon2id, m=19456 KiB, t=2, p=1) via the `argon2` crate. **NEVER** use MD5, SHA-1, SHA-256, or bcrypt.
- **Password policy:** Minimum 12 characters; reject passwords found in the HIBP top-10k list (compile-time embedded).
- **JWT:**
  - Algorithm MUST be `HS256` (or `EdDSA` if upgraded). `alg: none` MUST be rejected explicitly.
  - Secret MUST be ≥ 256 bits, loaded from env var `JWT_SECRET`, **never** hardcoded or committed.
  - Token TTL: **15 minutes** for access; refresh via Session record (TTL 7 days).
  - Claims MUST include `sub`, `iat`, `exp`, `jti`. Validate all on every request.
- **Session storage:** Sessions persisted in SurrealDB with `expires_at`; expired sessions purged hourly.
- **Logout:** MUST revoke session server-side (delete row); client clears token.
- **Brute-force protection:** Login endpoint rate-limited to **5 attempts / 15 min / IP+email** (tower-governor).

### 1.2 Authorization (A01 — Broken Access Control)

- **Every** widget/dashboard handler MUST verify `widget.user_id == claims.sub` before read/write/delete.
- Authorization checks MUST be enforced in the handler/service layer, not relying solely on query filters.
- No client-supplied `user_id` in request bodies — always derived from JWT claims.
- Default deny: any new route MUST be explicitly added to the auth middleware allow-list or it is protected by default.

### 1.3 Input Validation & Injection (A03)

- All request bodies MUST be parsed via `serde` into typed structs with `validator` constraints (length, regex, enum).
- SurrealDB queries MUST use **parameterized bindings** (`$param`). String concatenation into SurrealQL is forbidden.
- WebSocket messages MUST be deserialized into typed enums; unknown message types MUST be dropped + logged.
- Widget `config` JSON MUST be size-capped at **16 KiB** and schema-validated per widget `type`.

### 1.4 Cryptographic Failures (A02)

- TLS 1.2+ enforced at the reverse proxy (Caddy/Traefik) — HTTP redirects to HTTPS.
- HSTS: `max-age=63072000; includeSubDomains; preload`.
- Cookies (if used): `Secure`, `HttpOnly`, `SameSite=Strict`.
- Secrets MUST be loaded from environment or Docker secrets; **never** from repo or logs.

### 1.5 Security Headers (Frontend & API)

| Header | Value |
|---|---|
| `Content-Security-Policy` | `default-src 'self'; connect-src 'self' wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |

### 1.6 CORS

- Allowed origin: configured `FRONTEND_URL` only. Wildcard `*` is **forbidden** when credentials are sent.
- Allowed methods: `GET, POST, PATCH, DELETE`. Allowed headers: `Authorization, Content-Type`.

### 1.7 Logging & Monitoring (A09)

- Use `tracing` with structured JSON logs in production.
- **Forbidden in logs:** passwords, JWTs, full session tokens, email addresses (hash or mask), widget `config` payloads.
- All auth events (`login_success`, `login_fail`, `register`, `logout`, `token_invalid`) MUST be logged with correlation ID.

### 1.8 Dependencies (A06)

- `cargo audit` MUST run in CI; build fails on any RUSTSEC advisory ≥ Medium.
- `npm audit --production` MUST pass with zero High/Critical.
- Dependabot/Renovate enabled; security patches merged within **7 days**.

### 1.9 WebSocket Security

- WS upgrade MUST require valid JWT (via `Sec-WebSocket-Protocol` or first message handshake).
- Per-connection rate limit: **100 msgs/sec**, max payload **64 KiB**.
- Idle connections closed after **120 s** without ping/pong.

---

## 2. Performance (Latency & Throughput Targets)

### 2.1 Backend Latency SLOs (p95, single-node, warm cache)

| Endpoint | p50 | p95 | p99 |
|---|---|---|---|
| `POST /api/auth/login` | 80 ms | 200 ms | 400 ms |
| `POST /api/auth/register` | 100 ms | 250 ms | 500 ms |
| `GET /api/me` | 5 ms | 20 ms | 50 ms |
| `GET /api/widgets` | 10 ms | 40 ms | 100 ms |
| `POST /api/widgets` | 15 ms | 50 ms | 120 ms |
| `PATCH /api/widgets/:id` | 15 ms | 50 ms | 120 ms |
| `DELETE /api/widgets/:id` | 10 ms | 40 ms | 100 ms |
| `GET /api/dashboards` | 15 ms | 50 ms | 120 ms |
| WS message broadcast (server→client) | 10 ms | 50 ms | 100 ms |

> Argon2 dominates auth latency by design — that is acceptable.

### 2.2 Frontend Performance Targets

- **Lighthouse Performance score:** ≥ 90 on landing & dashboard (mobile profile).
- **Core Web Vitals (p75 field/lab):**
  - LCP ≤ **2.0 s**
  - INP ≤ **200 ms**
  - CLS ≤ **0.05**
- **Time to Interactive:** ≤ 2.5 s on 4G/Moto-G class device.
- **Initial JS payload:** ≤ **150 KB gzipped** for the landing route; ≤ **250 KB gzipped** for `/dashboard`.
- **Theme toggle:** zero FOUC — theme MUST be applied via inline `<script>` in `app.html` before first paint.

### 2.3 Capacity Targets (MVP, single Docker host, 4 vCPU / 8 GiB)

- Sustained throughput: **≥ 2,000 RPS** on `GET /api/widgets`.
- Concurrent WS clients: **≥ 1,000** with < 5% CPU per 100 idle connections.
- Memory ceiling: backend ≤ 512 MiB resident; frontend SSR ≤ 256 MiB.

### 2.4 Performance Engineering Rules

- All SurrealDB queries on `Widget` and `Dashboard` MUST filter by `user_id` and use indexed fields (`user_id`, `id`).
- N+1 queries are forbidden; aggregate via single SurrealQL query (`FETCH` / `SELECT ... GROUP BY`).
- WebSocket broadcaster MUST use `tokio::sync::broadcast` (or topic-scoped) — no per-client polling.
- HTTP responses MUST set `Cache-Control` appropriately:
  - `GET /api/me`, widgets → `private, no-cache`
  - Static assets → `public, max-age=31536000, immutable` (hashed filenames)
- Compression: `br` preferred, `gzip` fallback for responses ≥ 1 KiB.
- Database connection pool: min 4, max 32, acquire timeout 5 s.

### 2.5 Performance Gates in CI

- `criterion` micro-benchmarks for hot paths (JWT verify, widget serialize) — regression > 15% fails build.
- Playwright Lighthouse run on PRs touching frontend — score regression > 5 points fails.

---

## 3. Styling (System Defaults & Design System)

BentoBoard follows a **system-defaults-first** philosophy: prefer native browser/OS behavior over custom replacements.

### 3.1 Typography

- **Font stack:** system UI fonts only — no web-font downloads.
  ```css
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
               Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  ```
- **Mono stack:** `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
- **Scale:** modular 1.25 ratio; base `16px`. Use `rem` units exclusively (no `px` for type).

### 3.2 Color & Theming

- All colors MUST be defined as CSS custom properties in `app.css` under `:root` and `[data-theme="dark"]`.
- **Forbidden:** hardcoded hex/rgb in components. Use tokens: `--color-bg`, `--color-fg`, `--color-accent`, `--color-muted`, `--color-border`.
- Dark mode default: respect `prefers-color-scheme` on first visit; persist override in `localStorage`.
- Contrast: **WCAG 2.1 AA minimum** (4.5:1 text, 3:1 UI). Verified via axe-core in e2e.

### 3.3 Layout & Spacing

- Spacing scale: `4px` base — `--space-1` (4) … `--space-8` (64). No arbitrary margins.
- Bento grid uses CSS Grid with `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`.
- Mobile breakpoint: `640px`. Tablet: `1024px`. Desktop: `1280px`.

### 3.4 Motion

- Default transition: `150ms ease-out` for color/opacity; `200ms ease-in-out` for layout.
- MUST honor `@media (prefers-reduced-motion: reduce)` — disable all non-essential animation.
- No animations longer than **400 ms** on user-initiated actions.

### 3.5 Components

- Use **native HTML elements** first: `<dialog>`, `<details>`, `<input type="...">`, `<button>`. Custom replacements require justification.
- Forms MUST use native validation attributes (`required`, `minlength`, `pattern`, `type="email"`).
- Focus states MUST be visible — never `outline: none` without a visible alternative.

### 3.6 Accessibility

- Semantic HTML mandatory (`<nav>`, `<main>`, `<header>`, `<article>`).
- All interactive elements keyboard-navigable; tab order MUST follow visual flow.
- ARIA used only when native semantics insufficient.
- Color MUST never be the sole conveyor of meaning.

---

## 4. Compliance (GDPR / EU