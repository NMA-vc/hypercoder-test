# GUARDRAILS.md

**Project:** HabitFlow
**Stack:** tectic_v1 (Next.js / Prisma / Tailwind)
**Owner:** Security & Performance Engineering
**Status:** Authoritative — violations block merge.

---

## 1. Security (OWASP Top 10 Aligned)

### 1.1 Authentication & Session Management
- **Password hashing:** Use `argon2id` (preferred) or `bcrypt` cost ≥ 12. **Never** store plaintext or reversible encryption.
- **Password policy:** Minimum 10 chars, reject top-10k common passwords (use `zxcvbn` score ≥ 3).
- **Sessions:** Server-side, opaque tokens (≥ 256 bits CSPRNG). Stored in DB (`Session` model), 30-day rolling expiry, revoked on logout.
- **Cookies:** `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. **Never** store session tokens in `localStorage` or accessible JS.
- **Rate limiting:** `/api/auth/login` and `/api/auth/register` — max **5 attempts per IP per 15 min**, exponential backoff on failure. Use sliding-window limiter (e.g., Upstash, Redis, or in-memory for MVP).
- **Account enumeration:** Login failures must return generic `"Invalid email or password"` regardless of cause. Registration must not leak whether an email exists (return generic success + email confirmation flow if added later).
- **Logout:** Must invalidate server-side session row, not just clear cookie.

### 1.2 Authorization (OWASP A01: Broken Access Control)
- **Every** route handler under `/api/habits/*`, `/api/completions/*`, `/api/summary/*` MUST:
  1. Resolve session → `userId`.
  2. Scope all DB queries with `where: { userId }`.
  3. Return `404` (not `403`) on cross-user access attempts to avoid resource enumeration.
- **No** client-supplied `userId` in request bodies — derive from session only.
- IDs must be UUIDv4 or CUID (no sequential integers exposed in URLs).

### 1.3 Input Validation & Injection (A03)
- **All** request bodies validated with Zod schemas at the route boundary. Reject unknown keys (`.strict()`).
- **Prisma only** for DB access — no raw SQL unless reviewed and parameterized.
- **String limits:** `Habit.name` ≤ 100 chars, `Habit.description` ≤ 500 chars, `Habit.color` must match `^#[0-9A-Fa-f]{6}$`.
- **Date validation:** `Completion.date` must be `YYYY-MM-DD`, ≤ today, ≥ today − 30 days (backfill window).

### 1.4 XSS & Output Encoding (A03)
- React auto-escapes — **never** use `dangerouslySetInnerHTML`.
- User-supplied color values applied via inline `style` only after regex validation; never via `innerHTML` or class string concatenation.

### 1.5 CSRF (A01)
- All mutating routes (`POST`, `PATCH`, `DELETE`) require either:
  - `SameSite=Lax` cookie + same-origin enforcement (default for Next.js App Router fetches), **and**
  - Custom header check (`X-Requested-With: fetch` or origin verification).

### 1.6 Security Headers
Set globally via `next.config.js` headers or middleware:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 1.7 Secrets & Configuration (A05)
- All secrets via environment variables. `.env*` files in `.gitignore`.
- Required env: `DATABASE_URL`, `SESSION_SECRET` (≥ 32 bytes), `NODE_ENV`.
- Fail-fast on missing/weak secrets at boot (validate with Zod in `src/lib/env.ts`).

### 1.8 Dependencies & Supply Chain (A06)
- `npm audit --production` must report **0 high/critical** vulnerabilities to merge.
- Renovate/Dependabot enabled; weekly review.
- Lockfile (`package-lock.json`) committed; CI uses `npm ci` only.

### 1.9 Logging & Monitoring (A09)
- Log auth events: register, login success/failure, logout, session revocation. Include hashed user id, IP, UA, timestamp.
- **Never** log: passwords, session tokens, full email addresses (mask: `j***@example.com`).
- 5xx errors logged with request id; no stack traces in client responses.

---

## 2. Performance (Latency Targets)

### 2.1 API Latency Budgets (p95, server-side)
| Endpoint | p95 Target | p99 Ceiling |
|---|---|---|
| `POST /api/auth/login` | 250 ms (incl. argon2) | 500 ms |
| `POST /api/auth/register` | 300 ms | 600 ms |
| `GET /api/habits` | 80 ms | 200 ms |
| `POST /api/habits` | 100 ms | 250 ms |
| `PATCH /api/habits/:id` | 100 ms | 250 ms |
| `POST /api/completions` | 100 ms | 250 ms |
| `GET /api/habits/:id/completions` | 120 ms | 300 ms |
| `GET /api/summary/weekly` | 150 ms | 350 ms |

### 2.2 Frontend Web Vitals (mobile, 4G, mid-tier device)
| Metric | Target | Hard Ceiling |
|---|---|---|
| LCP | ≤ 2.0 s | 2.5 s |
| INP | ≤ 150 ms | 200 ms |
| CLS | ≤ 0.05 | 0.1 |
| FCP | ≤ 1.5 s | 2.0 s |
| TTFB | ≤ 400 ms | 800 ms |

### 2.3 Bundle Budgets
- Initial route JS (gzip): **≤ 130 KB** per route.
- Total page weight on dashboard: **≤ 250 KB** gzip (excl. images).
- No client-side date library > 15 KB (prefer `date-fns` tree-shaken or native `Intl`).

### 2.4 Database
- **Required indexes:**
  - `Session(token)` unique
  - `Habit(user_id, archived)`
  - `Completion(habit_id, date)` unique composite
  - `Completion(user_id, date)`
- N+1 prohibited: use Prisma `include`/`select` explicitly. Reviewed in PR.
- Weekly summary query MUST be a single aggregated query, not per-habit loops.

### 2.5 Caching
- `GET /api/habits` and `GET /api/summary/weekly` may set `Cache-Control: private, max-age=0, must-revalidate` with ETag.
- Static assets: immutable, 1-year max-age via Next.js defaults.

### 2.6 Streak Calculation
- O(n) over completions for a single habit. Bounded scan (max 365 days lookback) — never full-table scan.
- Cache current/longest streak in memo per request; invalidate on completion mutation.

---

## 3. Styling (System Defaults)

### 3.1 Foundations
- **Framework:** Tailwind CSS only. No CSS-in-JS, no separate `.module.css` unless justified.
- **Typography:** System font stack — `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. **No web fonts** in MVP (perf + GDPR).
- **Color tokens:** Defined in `tailwind.config.ts` under `theme.extend.colors`. Components reference tokens, never raw hex (except validated user habit color).
- **Spacing:** Tailwind 4px scale only (`p-1`, `p-2`, …). No arbitrary `[13px]` values without comment.

### 3.2 Theming (Light/Dark)
- Implemented via `class="dark"` on `<html>` (Tailwind `darkMode: 'class'`).
- Theme persisted to `localStorage` key `habitflow:theme` (`light` | `dark` | `system`).
- Default = `system` (respects `prefers-color-scheme`).
- All components MUST provide both light and dark variants. Acceptance: visual diff in both modes.

### 3.3 Accessibility (WCAG 2.1 AA)
- Color contrast ≥ **4.5:1** for body text, **3:1** for large text and UI components — verified for both themes.
- All interactive elements: focus-visible ring (`focus-visible:ring-2`), keyboard-operable.
- Touch targets ≥ **44×44 px** (per BuildSpec).
- Semantic HTML; ARIA only where semantics insufficient.
- Form fields: associated `<label>`, error messages tied via `aria-describedby`.

### 3.4 Responsive Design
- Mobile-first. Breakpoints: Tailwind defaults (`sm:640`, `md:768`, `lg:1024`, `xl:1280`).
- Layouts MUST work from **320px** width with no horizontal scroll.
- Navigation collapses to bottom nav or hamburger below `md`.

### 3.5 Component Conventions
- File naming: `PascalCase.tsx`. One component per file.
- Props typed via TypeScript `interface`. No `any`.
- Server Components by default; `"use client"` only when needed (forms, theme toggle, completion checkbox).

---

## 4. Compliance (GDPR / EU-Native)

### 4.1 Lawful Basis & Data Minimization
- **Lawful basis:** Contract performance (Art. 6(1)(b)) for account & habit data; legitimate interest for security logs.
- **Data minimization (Art. 5(1)(c)):** Collect only `email`, `password_hash`, `theme_preference`, habit data. **No** analytics, fingerprinting, IP geolocation, or behavioral tracking in MVP.

### 4.2 Hosting & Data Residency
- **All processing in EU.** Required:
  - Hosting region: EU (e.g., Vercel `fra1`/`cdg1`, Hetzner DE/FI, Scaleway FR).
  - Database region: EU only.
  - No US-based sub-processors (rules out US-region Vercel KV, Supabase US, etc.) without DPA + SCCs review.
- Document chosen sub-processors in `docs/SUBPROCESSORS.md`.

### 4.3 Cookies & Tracking
- Only **strictly necessary** cookies in MVP (session cookie). No consent banner required under ePrivacy.
- **No** third-party analytics, tag managers, fonts (Google Fonts ❌), or CDNs that proxy user IPs outside EU.

### 4.4 User Rights (Art. 15–22)
MVP must support, even if manually via admin script initially:
- **Access (Art. 15):** Export user's habits, completions, account data as JSON.
- **Erasure (Art. 17):** Hard-delete `User`, cascade `Habit`, `Completion`, `Session` rows. Confirm within 30 days.
- **Rectification (Art. 16):** Email change endpoint (post-MVP acceptable; document