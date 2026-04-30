# GUARDRAILS.md

**Project:** Habitly
**Stack:** tectic_v1 (Next.js + Supabase + Tailwind/shadcn on Vercel)
**Version:** 1.0.0
**Owner:** Security & Performance Engineering

These guardrails are **non-negotiable** constraints that apply to every task in the task graph (T01–T30). Any PR that violates them must be rejected at review.

---

## 1. Security (OWASP Top 10 Aligned)

### 1.1 Authentication & Session Management (OWASP A07)
- **Auth provider:** Supabase Auth only. No custom password hashing, no custom JWT issuance.
- **Sessions** must be stored in **HttpOnly, Secure, SameSite=Lax cookies** via `@supabase/ssr`. Never persist tokens in `localStorage` or expose them to client JS.
- **Password policy:** minimum 8 characters; rely on Supabase's default complexity + breach checks.
- **Middleware (`middleware.ts`, T04, T14)** must reject unauthenticated requests to `/(app)/*` and all `/api/*` routes except `/api/auth/*`.
- **Logout (T12)** must invalidate the Supabase session server-side and clear cookies.
- **Password reset (T24, T25)** must use Supabase's signed reset tokens with ≤1 hour TTL.

### 1.2 Authorization & Access Control (OWASP A01)
- **Row Level Security (RLS) is mandatory** on `habits` and `completions` tables (T03). Policies must enforce `auth.uid() = user_id` for SELECT, INSERT, UPDATE, DELETE.
- The `service_role` key **must never** be imported into any file under `app/`, `components/`, or `lib/` reachable from the browser bundle. Use `lib/supabase/server.ts` exclusively for server contexts.
- Every API route (T05, T06, T08, T25–T28) must:
  1. Resolve the current user via `createServerClient`.
  2. Return `401` if no session.
  3. Scope all queries by `user_id` (defense-in-depth even with RLS).
- **IDOR protection:** `:id` route params (e.g. `/api/habits/[id]/*`) must be UUID-validated and confirmed to belong to `auth.uid()` before any mutation.

### 1.3 Input Validation & Injection (OWASP A03)
- All request bodies and query params must be validated with **Zod schemas** before use. Reject with `400` and a sanitized error message on failure.
- Field constraints:
  - `habit.name`: 1–80 chars, trimmed.
  - `habit.description`: ≤500 chars, nullable.
  - `habit.color`: must match `^#[0-9A-Fa-f]{6}$`.
  - `completed_on`: ISO `YYYY-MM-DD` only.
- **No raw SQL string interpolation.** Use Supabase query builder or parameterized RPC.
- React JSX auto-escapes — `dangerouslySetInnerHTML` is **forbidden** anywhere in `components/` and `app/`.

### 1.4 Security Headers & Transport (OWASP A05)
Set in `next.config.js` (T01):
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- **CSP:** `default-src 'self'; script-src 'self' 'unsafe-inline' https://*.supabase.co; connect-src 'self' https://*.supabase.co; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'`

### 1.5 Secrets & Configuration (OWASP A05)
- All secrets via environment variables. `.env.example` (T02) lists keys only, never values.
- Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be exposed to the client. `SUPABASE_SERVICE_ROLE_KEY` is server-only and gated behind `lib/supabase/server.ts`.
- No secrets in git history. CI must run `gitleaks` or equivalent on every PR.

### 1.6 Rate Limiting & Abuse (OWASP A04)
- Mutating endpoints (`POST /api/habits`, `POST /api/habits/:id/toggle`, `/api/auth/reset-password`) must be rate-limited: **30 req/min per user, 10 req/min per IP for unauthenticated routes**. Use Vercel Edge Middleware or Upstash.
- Auth endpoints capped at **5 attempts per 15 min per IP** to mitigate brute force.

### 1.7 Logging & Monitoring (OWASP A09)
- Server logs must include `user_id`, route, status, and latency — **never** request bodies, passwords, tokens, or email addresses in plaintext.
- 4xx/5xx responses must surface a `request_id` to the client for support correlation.
- Failed auth attempts logged with IP and timestamp; do not log which factor (email vs password) failed.

### 1.8 Dependencies (OWASP A06)
- `npm audit --audit-level=high` must pass in CI.
- Renovate/Dependabot enabled with weekly cadence.
- No deprecated or unmaintained packages (>12 months without release).

---

## 2. Performance (Latency & Resource Targets)

### 2.1 API Latency (Server-Side, p95)
| Endpoint | Target p95 | Hard Ceiling |
|---|---|---|
| `GET /api/habits` | ≤150 ms | 400 ms |
| `POST /api/habits` | ≤200 ms | 500 ms |
| `PATCH/DELETE /api/habits/:id` | ≤200 ms | 500 ms |
| `POST /api/habits/:id/toggle` | ≤150 ms | 400 ms |
| `GET /api/habits/:id/streak` | ≤200 ms | 500 ms |
| `GET /api/summary/weekly` | ≤300 ms | 700 ms |
| `GET /api/me` | ≤100 ms | 300 ms |

Measured from Vercel edge to response sent (excluding cold starts).

### 2.2 Frontend Web Vitals (Mobile, 4G, p75)
- **LCP** ≤ 2.5 s
- **INP** ≤ 200 ms
- **CLS** ≤ 0.1
- **TTFB** ≤ 800 ms
- **JS bundle (initial)** ≤ 180 KB gzipped per route
- Lighthouse score (mobile): **Performance ≥ 90, Accessibility ≥ 95**

### 2.3 Database
- **Required indexes (T03):**
  - `habits(user_id, archived)` — dashboard list
  - `completions(habit_id, completed_on DESC)` — streak + weekly grid
  - `completions(user_id, completed_on)` — cross-habit weekly aggregation
  - Unique constraint `completions(habit_id, completed_on)` (already specified)
- **Streak calculation (`lib/streaks.ts`, T06)** must be O(n) over completions in a single window query — no N+1, no per-day round trips.
- **Weekly summary (T08)** must fetch all habits + completions in **≤2 queries** total, joined or batched.
- Connection pooling via Supabase pooler (PgBouncer transaction mode) for serverless.

### 2.4 Caching & Rendering
- Authenticated app routes: `cache: 'no-store'` for user-specific data; never cache at CDN.
- Static assets (fonts, icons): immutable cache headers `max-age=31536000, immutable`.
- Use **React Server Components** for initial dashboard render to minimize client JS.
- **No client-side polling.** Updates via optimistic UI on mutation.

### 2.5 Cold Starts & Regions
- Supabase region must align with Vercel function region (default `iad1` → assume Supabase `us-east-1`, OR migrate both to `fra1` / `eu-central-1` for EU residency — see §4.2).
- Edge runtime preferred for read-only routes (`GET /api/me`, `GET /api/habits`) where Supabase client supports it.

---

## 3. Styling (System Defaults)

### 3.1 Design System
- **Tailwind CSS + shadcn/ui only.** No additional UI libraries (no MUI, Chakra, Bootstrap).
- shadcn components installed via CLI into `components/ui/` — do not hand-roll primitives that shadcn provides (Button, Input, Dialog, Switch, etc.).
- Use **system font stack** by default: `font-sans` resolves to `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, …`. No custom web fonts in MVP (saves ~100 KB and avoids GDPR-relevant font CDN calls — see §4.3).

### 3.2 Theming (T09)
- Theme tokens via CSS variables in `app/globals.css` using shadcn's default `--background`, `--foreground`, `--primary`, etc.
- Dark mode via `class` strategy on `<html>`. Initial value resolved server-side from cookie to prevent FOUC; falls back to `prefers-color-scheme`.
- Habit colors (user-chosen) must be picked from a **predefined accessible palette** (8–10 swatches), not free-form hex input from a color wheel — guarantees WCAG AA contrast on both themes.

### 3.3 Responsive & Accessibility
- Mobile-first. Breakpoints: default (mobile), `md:` (≥768 px tablet), `lg:` (≥1024 px desktop).
- Verified at **375 × 667** (iPhone SE) — no horizontal scroll.
- **Touch targets ≥ 44 × 44 px** (enforced via min-height utility on `HabitCard` toggle, T07).
- All interactive elements keyboard-reachable; visible `:focus-visible` ring (shadcn default).
- Color is **never** the sole signal of state (completed habits show checkmark + color shift).
- Contrast ≥ **4.5:1** for text, **3:1** for UI components (WCAG 2.1 AA).
- All form inputs have associated `<label>`; icon-only buttons have `aria-label`.

### 3.4 Code Style
- Prettier + ESLint (`next/core-web-vitals`) enforced in CI.
- Tailwind classes ordered via `prettier-plugin-tailwindcss`.
- No inline `style={}` except for dynamic habit color swatches.

---

## 4. Compliance (GDPR / EU-Native)

### 4.1 Lawful Basis & Data Minimization
- **Lawful basis:** Contract (Art. 6(1)(b)) — providing the habit-tracking service the user signed up for.
- **Data collected is strictly limited to:**
  - `auth.users`: email, hashed password, timestamps (Supabase-managed).
  - `habits`: user-authored content.
  - `completions`: dates only.
- **Prohibited without explicit consent:** analytics SDKs, advertising pixels, third-party trackers, session replay, fingerprinting.

### 4.2 Data Residency
- Supabase project **must be provisioned in an EU region** (`eu-central-1` Frankfurt or `eu-west-1` Ireland).
- Vercel deployment region pinned to `fra1` or `dub1`.
- This overrides the BuildSpec assumption of "Supabase default region" — log as a deviation and document in README (T10).
- No data egress to non-adequate countries. No US