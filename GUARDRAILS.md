# GUARDRAILS.md

**Project:** BentoStack
**Stack:** Rust (Axum + Tokio) · SurrealDB · SvelteKit
**Scale target:** ~100 concurrent users (MVP)
**Deployment:** Self-hosted, single-tenant

This document defines the **non-negotiable engineering guardrails** for BentoStack. All PRs, code reviews, and CI gates must enforce these rules. Deviations require explicit written justification in the PR description and sign-off from a maintainer.

---

## 1. Security (OWASP-aligned)

### 1.1 Authentication & Session Management
- **Password hashing:** Argon2id (memory ≥ 19 MiB, iterations ≥ 2, parallelism = 1). Never bcrypt < 12 rounds, never MD5/SHA1/plain.
- **JWT:** HS256 minimum (prefer EdDSA if key infra allows). Tokens MUST include `iss`, `sub`, `iat`, `exp`, `jti`. Max lifetime: **15 min access**, **7 day refresh** (rotated on use).
- **Session revocation:** maintain `Session` row keyed by `jti`; deny if revoked or expired. `/api/auth/logout` MUST invalidate the `jti` server-side.
- **Cookies:** `HttpOnly`, `Secure`, `SameSite=Lax` for refresh tokens. Access token may live in memory only.
- **Brute force:** rate-limit `/api/auth/login` and `/api/auth/signup` to **5 req / IP / minute** with exponential backoff.
- **Email enumeration:** uniform error message ("Invalid credentials") and uniform timing on login failure.

### 1.2 OWASP Top 10 — Required Mitigations
| OWASP Risk | Required Control |
|---|---|
| A01 Broken Access Control | Every handler MUST resolve `workspace_id` from the authenticated `user_id`, never from client input. Authorisation check at handler entry. |
| A02 Cryptographic Failures | TLS 1.3 only at edge. Secrets via env or secret manager — never in repo. |
| A03 Injection | SurrealDB queries via parameterised bindings only. No string concatenation of user input into queries. |
| A04 Insecure Design | Threat model reviewed per feature; deny-by-default on new endpoints. |
| A05 Security Misconfig | CSP `default-src 'self'`; `X-Frame-Options: DENY`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy` restricting camera/mic/geo. |
| A06 Vulnerable Components | `cargo audit` and `npm audit` MUST pass in CI. No `unsafe` in app crates without review. |
| A07 Auth Failures | See 1.1. |
| A08 Software/Data Integrity | Lockfiles committed (`Cargo.lock`, `package-lock.json` or `pnpm-lock.yaml`). Container images pinned by digest. |
| A09 Logging Failures | All auth events, authz denials, and 5xx must be logged with `trace_id`. No PII or secrets in logs. |
| A10 SSRF | No outbound HTTP from user-provided URLs in MVP. If added, allowlist only. |

### 1.3 Input Validation
- All request bodies validated via `serde` + explicit schema (e.g. `validator` crate). Reject unknown fields (`#[serde(deny_unknown_fields)]`).
- Item `title` ≤ 200 chars, `body` ≤ 50 KB. Widget `config` JSON ≤ 8 KB.
- WebSocket frames ≤ 64 KB. Reject oversized.

### 1.4 WebSocket Security
- `/ws` requires valid access token via subprotocol or first-message auth handshake within 5s, else close.
- Server only emits events for the authenticated user's workspace. Cross-workspace leakage is a P0 incident.

---

## 2. Performance

### 2.1 Latency Targets (p95, server-side, warm)
| Endpoint class | p95 | p99 |
|---|---|---|
| `/healthz` | < 5 ms | < 20 ms |
| Auth (`/api/auth/*`) | < 150 ms | < 300 ms |
| Read (`GET /api/items`, `/api/widgets`, `/api/me`) | < 50 ms | < 120 ms |
| Write (`POST/PATCH/DELETE` items, widgets) | < 100 ms | < 250 ms |
| WebSocket broadcast fan-out | < 50 ms end-to-end | < 150 ms |

### 2.2 Throughput & Resource Budgets
- Sustain **100 concurrent users** with **≤ 500 MB RSS** for the Axum process and **≤ 1 vCPU** at < 60% utilisation.
- Single SurrealDB connection pool, max 32 connections. Queries > 100 ms must be logged with `slow_query=true`.

### 2.3 Frontend Performance
- **Lighthouse Performance ≥ 90** on landing and dashboard (mobile profile).
- **TTFB < 200 ms**, **LCP < 2.5 s**, **CLS < 0.1**, **INP < 200 ms**.
- Initial JS bundle (dashboard route) ≤ **150 KB gzipped**. Landing route ≤ **75 KB gzipped**.
- Code-split per route. Lazy-load widgets.
- Images: AVIF/WebP, explicit `width`/`height`, `loading="lazy"` below the fold.

### 2.4 Backend Patterns (mandatory)
- All handlers `async`; no blocking calls in Tokio runtime (use `spawn_blocking` for CPU work).
- Bounded channels for the WebSocket broadcast bus (capacity = 256). On lag, drop oldest with metric increment.
- N+1 queries forbidden — fetch related data in single SurrealDB query or explicit batched fetch.
- Pagination required on any list endpoint (`/api/items`, `/api/activity`): default `limit=50`, max `limit=200`.

---

## 3. Styling & UX (System Defaults)

### 3.1 Design Tokens
- **Typography:** system font stack only — `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Mono: `ui-monospace, SFMono-Regular, Menlo, monospace`.
- **No web fonts** in MVP (perf + GDPR). Custom fonts require sign-off.
- **Spacing scale:** 4 px base (4, 8, 12, 16, 24, 32, 48, 64).
- **Radii:** 4 / 8 / 12 / 16 px. Bento cards default 16 px.
- **Color:** semantic tokens (`--bg`, `--fg`, `--muted`, `--accent`, `--danger`) defined for `light` and `dark`. No hard-coded hex in components.

### 3.2 Dark Mode
- Default: `prefers-color-scheme`. User override persisted in `localStorage` key `bento:theme`.
- Theme switch must not cause FOUC: apply class on `<html>` before hydration.

### 3.3 Motion & Transitions
- Default duration **150–250 ms**, easing `cubic-bezier(0.2, 0, 0, 1)`.
- All motion gated on `prefers-reduced-motion: reduce` → disable transitions/parallax.

### 3.4 Accessibility (WCAG 2.2 AA)
- Color contrast ≥ **4.5:1** body, **3:1** large text and UI components.
- All interactive elements keyboard-reachable with visible focus ring (≥ 2 px, contrast 3:1).
- Forms: associated `<label>`, `aria-invalid` on errors, error text linked via `aria-describedby`.
- Landmarks: `<header>`, `<main>`, `<nav>`, `<footer>` on every page.
- Bento grid must be screen-reader navigable as a list of regions with accessible names.

### 3.5 Component Rules
- No third-party UI kit. Build on Svelte primitives + native HTML.
- No CSS-in-JS. Use scoped Svelte styles + a single `app.css` for tokens.
- Icons: inline SVG, `aria-hidden="true"` unless decorative-with-meaning.

---

## 4. Compliance (GDPR / EU-Native)

BentoStack is built **EU-native**: lawful basis, data minimisation, and user rights are first-class concerns even though deployment is self-hosted.

### 4.1 Lawful Basis & Minimisation
- **Lawful basis:** Contract (Art. 6(1)(b)) for account/service operation.
- Collect only: email, password hash, display name, optional avatar URL. **No** IP geolocation, **no** behavioural tracking, **no** ad/analytics SDKs in MVP.
- `ActivityEvent.payload` MUST NOT contain plaintext PII beyond what the user authored. Document the schema per `kind`.

### 4.2 User Rights (Art. 15–22)
The following must be implementable without code changes (operator runbook acceptable for MVP):
- **Access (Art. 15):** export user's `User`, `Workspace`, `Item`, `Widget`, `ActivityEvent` rows as JSON via admin script.
- **Rectification (Art. 16):** `PATCH /api/me` covers profile; items editable via UI.
- **Erasure (Art. 17):** admin script deletes user + cascades to workspace, items, widgets, activity, sessions within **30 days** of request. Hard delete, not soft.
- **Portability (Art. 20):** same JSON export as Access, machine-readable.

### 4.3 Data Retention
| Data | Retention |
|---|---|
| `Session` (expired) | Purged nightly |
| `ActivityEvent` | 90 days rolling, auto-pruned |
| Server logs | 30 days max, no PII |
| Deleted user data | Purged within 30 days, no backups retained > 90 days |

### 4.4 Transfers & Hosting
- **Default deployment posture:** EU/EEA region (operator MUST document hosting location in `DEPLOYMENT.md`).
- No third-party processors in MVP. If added later, a **DPA + SCCs** are required and the processor MUST be listed in a public sub-processor page.
- No data transferred to the US or other third countries without an Art. 46 transfer mechanism.

### 4.5 Cookies & Tracking
- Only **strictly necessary** cookies (auth refresh token). **No banner required** under ePrivacy because no non-essential cookies are set.
- No analytics, no pixels, no fingerprinting. If added: prior opt-in consent, granular, revocable, and pre-consent state must set zero cookies.

### 4.6 Security of Processing (Art. 32)
- Encryption in transit: TLS 1.3.
- Encryption at rest: operator MUST enable disk encryption on the SurrealDB volume (documented requirement).
- Backups encrypted; restore drill documented.
- Breach notification runbook: detect → assess → notify supervisory authority within **72 hours** if risk to rights/freedoms.

### 4.7 Records & Documentation
- Maintain `PRIVACY.md` (public-facing privacy notice) and `ROPA.md` (Record of Processing Activities, Art. 30) in repo.
- Update both when data model changes.

---

## 5. Enforcement

### 5.1 CI Gates (block merge)
- `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`, `cargo audit`
- `npm run lint`, `npm run check` (svelte-check)
- Playwright E2E green.
- Accessibility audit (axe) green.
