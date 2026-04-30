# GUARDRAILS.md

**Project:** HabitFlow
**Stack:** Next.js 15 (App Router) + Supabase + shadcn/ui + Tailwind
**Version:** 1.0.0
**Owner:** Engineering (Security & Performance)

This document defines the non-negotiable guardrails for HabitFlow. All PRs MUST satisfy these rules before merge. CI MUST enforce automated checks where indicated (✅ AUTO).

---

## 1. Security (OWASP-Aligned)

### 1.1 Authentication & Session Management (OWASP A07)
- **MUST** use Supabase Auth email/password with PKCE flow only. No implicit flow.
- **MUST** enforce password minimum 10 chars, with NIST 800-63B style validation (no forced rotation, block known-breached passwords via Supabase config).
- **MUST** store sessions in `httpOnly`, `Secure`, `SameSite=Lax` cookies via `@supabase/ssr`. Never persist tokens in `localStorage`.
- **MUST** validate session in `middleware.ts` for every `/(app)/*` route. Unauthenticated requests redirect to `/login`.
- **MUST** call `supabase.auth.getUser()` (not `getSession()`) in Server Components/Actions to revalidate JWT.
- Session inactivity timeout: **24h**. Absolute lifetime: **7d**. Refresh on activity.

### 1.2 Authorization & Data Access (OWASP A01 — Broken Access Control)
- **MUST** enable Row-Level Security (RLS) on every table in `public` schema. Migration MUST fail CI if any user-data table lacks RLS. ✅ AUTO
- **MUST** define policies: `user_id = auth.uid()` for SELECT/INSERT/UPDATE/DELETE on `habits` and `completions`.
- **MUST NOT** use the Supabase service-role key in any client-reachable code path. Service-role usage restricted to migrations and admin scripts only. Lint rule: forbid `SUPABASE_SERVICE_ROLE_KEY` import outside `/scripts/**`. ✅ AUTO
- All Server Actions **MUST** re-derive `user_id` from the session — never trust client-supplied `user_id`.

### 1.3 Input Validation & Injection (OWASP A03)
- **MUST** validate all Server Action inputs with Zod schemas. Reject on parse failure with generic 400.
- Habit `name`: 1–80 chars, trimmed. `description`: ≤500 chars. `color`: regex `^#[0-9a-fA-F]{6}$`.
- **MUST** use Supabase parameterized query builder (`.eq()`, `.insert()`). Raw SQL only in migrations.
- **MUST** escape/sanitize any user content rendered as HTML (React handles by default; `dangerouslySetInnerHTML` is **forbidden**). ✅ AUTO via ESLint `react/no-danger`.

### 1.4 Cryptographic & Secret Hygiene (OWASP A02)
- **MUST NOT** commit secrets. `.env.local` gitignored; `.env.example` contains keys only.
- All env vars exposed to browser MUST be prefixed `NEXT_PUBLIC_*` and contain no secrets beyond the Supabase anon key.
- TLS 1.2+ enforced end-to-end (Vercel + Supabase defaults).
- Secret scanning (gitleaks) runs on every PR. ✅ AUTO

### 1.5 Security Headers & CSRF
- **MUST** set in `next.config.ts` headers:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy`: `default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'`
- Server Actions are CSRF-protected by Next.js Origin checking — **MUST NOT** disable.

### 1.6 Logging, Monitoring & Errors (OWASP A09)
- **MUST NOT** log PII (email, user_id beyond first 8 chars), passwords, or tokens.
- Server errors return generic messages to clients; full stack traces only in server logs.
- Failed login attempts logged with rate-limit counters (Supabase built-in).

### 1.7 Vulnerable Components (OWASP A06)
- `npm audit --audit-level=high` MUST pass on CI. ✅ AUTO
- Dependabot weekly updates enabled.
- No dependencies with <1k weekly downloads without security review.

### 1.8 Rate Limiting & Abuse
- Auth endpoints: rely on Supabase rate limits (default: 30/hr per IP for sign-in).
- `toggleCompletion`: idempotent by `unique(habit_id, completed_on)` constraint — DB enforces no duplicates.
- Habit creation: soft cap of **200 active habits per user** (enforced in Server Action).

---

## 2. Performance

### 2.1 Latency Targets (p75, EU region)

| Surface | Target | Hard Ceiling |
|---|---|---|
| Server Action (toggleCompletion) | ≤150 ms | 400 ms |
| Server Action (createHabit/updateHabit) | ≤200 ms | 500 ms |
| `/` Dashboard TTFB | ≤200 ms | 500 ms |
| `/summary` TTFB | ≤250 ms | 600 ms |
| Auth pages TTFB | ≤150 ms | 400 ms |

### 2.2 Core Web Vitals (mobile, p75)
- **LCP** ≤ 2.0 s
- **INP** ≤ 200 ms
- **CLS** ≤ 0.05
- **FCP** ≤ 1.5 s
- Lighthouse mobile score ≥ 90 (Performance, Accessibility, Best Practices). CI runs Lighthouse on preview URL. ✅ AUTO

### 2.3 Bundle Budgets
- Initial JS (per route, gzipped): **≤ 130 KB**
- Total JS per page: **≤ 250 KB** gzipped
- Per-route CSS: **≤ 30 KB** gzipped
- No single dependency >50 KB gzipped without justification (logged in PR description).
- `@next/bundle-analyzer` report attached to PRs that change `package.json`.

### 2.4 Database & Query Discipline
- **MUST** create indexes on:
  - `habits(user_id, archived)`
  - `completions(user_id, completed_on)`
  - `completions(habit_id, completed_on)` (covered by unique constraint)
- **MUST NOT** issue N+1 queries from Server Components. Use joins or `.in()` batched fetches.
- Dashboard query budget: **≤2 DB round-trips** per render.
- Weekly summary: **single query** returning 7-day window.
- All queries on user-data tables MUST filter by `user_id` explicitly (defense-in-depth alongside RLS).

### 2.5 Rendering Strategy
- **Default to Server Components.** Client Components only for interactivity (theme toggle, completion toggle, mobile nav).
- **MUST** use `revalidatePath('/')` after mutations — no full page reloads.
- Optimistic UI for `toggleCompletion` via `useOptimistic`.
- No client-side data fetching libraries (SWR/React Query) for MVP — Server Components only.
- `next/image` required for any raster images. `next/font` for all fonts (no external font CDNs).

### 2.6 Caching
- Static auth pages: `force-static` where possible.
- Dashboard/Summary: `dynamic = 'force-dynamic'` (per-user data).
- HTTP cache headers managed by Next.js defaults; do not override without review.

---

## 3. Styling & UI Conventions (System Defaults)

### 3.1 Component Library
- **MUST** use shadcn/ui primitives. Do not introduce alternative UI libs (MUI, Chakra, Mantine, etc.).
- New components live in `components/ui/` (shadcn) or `components/` (composed). No styled-components or CSS-in-JS runtime libs.
- Tailwind utility classes only. No custom CSS files except `globals.css` (tokens + resets).

### 3.2 Theming
- **MUST** use `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`.
- All colors via CSS variables (`--background`, `--foreground`, etc.) defined in `globals.css`. No hardcoded hex outside the `color` field of a Habit.
- **MUST NOT** introduce flash of unstyled content: `suppressHydrationWarning` on `<html>`, theme script in `<head>`.

### 3.3 Responsive & Accessibility
- **Mobile-first**. Layouts MUST work at 375 × 667 viewport with no horizontal overflow.
- Tap targets **≥ 44 × 44 px** (Apple HIG / WCAG 2.5.5).
- Breakpoints: Tailwind defaults (`sm 640`, `md 768`, `lg 1024`). Do not customize.
- WCAG 2.1 AA color contrast (≥ 4.5:1 for body text, ≥ 3:1 for large text/UI).
- Every interactive element MUST be keyboard-operable with visible focus ring.
- Forms MUST use `<label>` (or `aria-label`) and announce errors via `aria-live`.
- `axe-core` checks in Playwright E2E. Zero serious/critical violations. ✅ AUTO

### 3.4 Typography & Spacing
- Use shadcn typographic scale (Tailwind `text-sm/base/lg/xl/2xl`). No arbitrary `text-[13px]`.
- Spacing on Tailwind scale (`p-2`, `gap-4`). Arbitrary values discouraged; require comment if used.

### 3.5 Iconography
- **MUST** use `lucide-react`. No mixing icon libraries.

---

## 4. Compliance (GDPR / EU-Native)

HabitFlow is treated as **EU-native** by default: EU data residency, GDPR-compliant by design, even though no formal compliance requirement was specified. Cost of retrofit > cost of upfront.

### 4.1 Data Residency
- Supabase project **MUST** be provisioned in an EU region (`eu-central-1` Frankfurt or `eu-west-1` Ireland).
- Vercel deployment region pinned to **`fra1` (Frankfurt)**.
- No third-party processors outside EU/EEA without a documented SCC (Standard Contractual Clauses).

### 4.2 Lawful Basis & Data Minimization (GDPR Art. 5, 6)
- Lawful basis: **performance of contract** (providing the habit tracker service the user signed up for).
- Personal data collected limited to:
  - `auth.users.email` — required for authentication
  - `auth.users.id` — internal identifier
  - Habit content (user-generated; not classified as special-category data)
- **MUST NOT** collect: name, location, IP for analytics, device fingerprints, behavioral telemetry.
- **MUST NOT** add analytics, ad pixels, or session-replay tools without DPIA + consent flow.

### 4.3 Cookies & Consent (ePrivacy)
- Only **strictly necessary** cook