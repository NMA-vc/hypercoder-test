# AGENTS.md — Habitly Specialist Fleet

This document defines the specialist agent fleet responsible for delivering Habitly per the BuildSpec. Each agent owns a discrete slice of the codebase, has clearly scoped capabilities, and coordinates with peers via the task graph dependencies.

Stack: Next.js (App Router) + Supabase + Tailwind/shadcn + Vercel.

---

## Coordination Model

- **Waves** drive scheduling: Wave 0 (foundations) → Wave 1 (auth/data/APIs) → Wave 2 (UI/polish/tests).
- Each agent edits **only its owned files**. Cross-cutting concerns are negotiated by the LeadArchitect.
- All DB-touching agents must use the `lib/supabase/*` clients and respect RLS — no service-role usage in user paths.
- All dates use **user-local `completed_on`** to avoid timezone bugs in streaks.

---

## 1. LeadArchitect (Coordinator)

**Role:** Owns the BuildSpec, task graph, conventions, and cross-agent consistency. Resolves API contracts and shared type shapes.

**Capabilities:**
- Maintain task ordering, unblock waves, mediate file-ownership disputes.
- Approve API surface contracts before downstream agents consume them.
- Final arbiter on data-model and RLS shape.

**Owned files:** `AGENTS.md`, `BUILDSPEC.md` (if produced), top-level conventions docs.

**Coordinates with:** All agents.

---

## 2. ScaffoldSpecialist

**Role:** Bootstraps the Next.js app, Tailwind, and shadcn/ui. Establishes baseline layout and global styles.

**Capabilities:**
- Initialize Next.js App Router project, TypeScript, ESLint.
- Configure Tailwind, shadcn `components.json`, design tokens, font stack.
- Provide root `app/layout.tsx` shell that ThemeSpecialist later wraps.

**Owned files (T01):**
- `package.json`
- `next.config.js`
- `tailwind.config.ts`
- `app/layout.tsx`
- `app/globals.css`
- `components.json`

**Wave:** 0  
**Coordinates with:** ThemeSpecialist (root layout integration), FrontendArchitect.

---

## 3. PlatformSpecialist (Supabase Wiring)

**Role:** Provides typed Supabase clients (browser + server) and environment configuration.

**Capabilities:**
- Create SSR-safe and client-side Supabase factories.
- Define `.env.example` for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Export shared `Database` types (generated or hand-rolled).

**Owned files (T02):**
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `.env.example`

**Wave:** 0  
**Coordinates with:** DBSpecialist, AuthSpecialist, APISpecialist.

---

## 4. DBSpecialist

**Role:** Owns the Postgres schema, indexes, and Row-Level Security (RLS) policies in Supabase.

**Capabilities:**
- Define `habits` and `completions` tables per data model.
- Enforce `unique(habit_id, completed_on)` and FK cascade rules.
- Author RLS so users can only read/write their own rows (mitigates risk #2).
- Add indexes for `(user_id, archived)` and `(habit_id, completed_on desc)`.

**Owned files (T03):**
- `supabase/migrations/0001_init.sql`

**Wave:** 0  
**Coordinates with:** PlatformSpecialist, APISpecialist.

---

## 5. AuthSpecialist

**Role:** Implements Supabase email/password auth, session persistence, route protection, and password recovery.

**Capabilities:**
- Build login, signup, forgot/reset password flows and server actions.
- Implement Next.js `middleware.ts` to redirect unauthenticated users from protected routes to `/login`.
- Handle Supabase email confirmation callback and logout.
- Expose `/api/me` for current user profile.

**Owned files:**
- T04: `app/login/page.tsx`, `app/signup/page.tsx`, `app/auth/actions.ts`, `middleware.ts`
- T12: `app/api/auth/logout/route.ts`
- T13: `app/auth/callback/route.ts`
- T24: `app/forgot-password/page.tsx`, `app/reset-password/page.tsx`
- T25: `app/api/auth/reset-password/route.ts`
- T26: `app/api/me/route.ts`

**Wave:** 1  
**Coordinates with:** PlatformSpecialist, FrontendArchitect (protected layout).

---

## 6. APISpecialist (Habits & Completions)

**Role:** Owns all REST route handlers and shared domain logic for habits, completions, archiving, and streaks.

**Capabilities:**
- Implement habits CRUD, toggle, archive/unarchive, completions list.
- Encapsulate query logic in `lib/habits.ts` and streak math in `lib/streaks.ts` (current + longest, timezone-safe via `completed_on`).
- Validate inputs (zod recommended) and return typed JSON.
- Return 401 for unauth, 403 for cross-user access (defense-in-depth on top of RLS).

**Owned files:**
- T05: `app/api/habits/route.ts`, `app/api/habits/[id]/route.ts`, `lib/habits.ts`
- T06: `app/api/habits/[id]/toggle/route.ts`, `app/api/habits/[id]/streak/route.ts`, `lib/streaks.ts`
- T27: `app/api/habits/[id]/archive/route.ts`
- T28: `app/api/habits/[id]/completions/route.ts`

**Wave:** 1  
**Coordinates with:** DBSpecialist (schema), AnalyticsSpecialist (summary endpoint reuses `lib/habits.ts`).

---

## 7. AnalyticsSpecialist (Weekly Summary)

**Role:** Builds the 7-day completion matrix endpoint and the summary page UI.

**Capabilities:**
- Aggregate last 7 days × active habits into a matrix payload.
- Compute weekly completion percentage per habit.
- Render `WeeklyGrid` with accessible color cues for completed days.

**Owned files (T08):**
- `app/api/summary/weekly/route.ts`
- `app/(app)/summary/page.tsx`
- `components/weekly-grid.tsx`

**Wave:** 2  
**Coordinates with:** APISpecialist (reuses `lib/habits.ts`), FrontendArchitect.

---

## 8. FrontendArchitect (App Shell & Habit UI)

**Role:** Owns the authenticated app shell, dashboard, and all habit-management pages.

**Capabilities:**
- Compose protected `(app)` route group layout with auth guard, header, and nav.
- Build dashboard with habit list, optimistic toggle, and inline create.
- Implement habit list, new/edit, detail (with streaks), and archived views.
- Ensure 375px-min layout, 44px+ touch targets.

**Owned files:**
- T07: `app/(app)/dashboard/page.tsx`, `components/habit-card.tsx`, `components/habit-form.tsx`
- T11: `app/page.tsx` (root redirect)
- T14: `app/(app)/layout.tsx`
- T15: `app/(app)/habits/new/page.tsx`
- T16: `app/(app)/habits/[id]/edit/page.tsx`
- T17: `app/(app)/habits/[id]/page.tsx`
- T18: `app/(app)/habits/page.tsx`
- T19: `app/(app)/habits/archived/page.tsx`
- T20: `app/(app)/settings/page.tsx`
- T23: `app/(app)/loading.tsx`, `app/(app)/dashboard/loading.tsx`

**Wave:** 1–2  
**Coordinates with:** AuthSpecialist (guard), APISpecialist (data), ThemeSpecialist, UIKitSpecialist.

---

## 9. ThemeSpecialist (Dark Mode & Responsive Polish)

**Role:** Owns theming, system-preference detection, and responsive navigation chrome.

**Capabilities:**
- Provide `ThemeProvider` (next-themes pattern) with localStorage persistence.
- Build accessible theme toggle and primary nav.
- Build mobile bottom nav + header that collapse appropriately.

**Owned files:**
- T09: `components/theme-provider.tsx`, `components/theme-toggle.tsx`, `components/nav.tsx`
- T29: `components/mobile-nav.tsx`, `components/header.tsx`

**Wave:** 2  
**Coordinates with:** ScaffoldSpecialist (root layout), FrontendArchitect (app shell).

---

## 10. UIKitSpecialist (Shared Components)

**Role:** Builds reusable UX primitives consumed across pages.

**Capabilities:**
- `EmptyState` for zero-habit dashboards and archived lists.
- `ConfirmDialog` for destructive actions (delete/archive).
- Built atop shadcn primitives, fully accessible (focus trap, ESC close).

**Owned files (T30):**
- `components/empty-state.tsx`
- `components/confirm-dialog.tsx`

**Wave:** 2  
**Coordinates with:** FrontendArchitect, AnalyticsSpecialist.

---

## 11. ReliabilitySpecialist (Errors & Not Found)

**Role:** Owns global error boundaries and 404 surfaces.

**Capabilities:**
- Implement `not-found.tsx` with recovery links.
- Implement segment + global error boundaries with retry actions and safe logging.

**Owned files:**
- T21: `app/not-found.tsx`
- T22: `app/error.tsx`, `app/global-error.tsx`

**Wave:** 2  
**Coordinates with:** FrontendArchitect.

---

## 12. QASpecialist

**Role:** End-to-end smoke tests and developer documentation.

**Capabilities:**
- Playwright E2E covering: signup → create habit → toggle → streak → weekly grid → logout.
- Author `README.md` covering local setup, env vars, Supabase migration steps, and deploy-to-Vercel notes.

**Owned files (T10):**
- `tests/e2e/habits.spec.ts`
- `README.md`

**Wave:** 2 (final)  
**Coordinates with:** All agents — runs after T07/T08/T09 land.

---

## File Ownership Index (Conflict Prevention)

| Path prefix | Owner |
|---|---|
| `app/api/auth/**` | AuthSpecialist |
| `app/api/habits/**` | APISpecialist |
| `app/api/summary/**` | AnalyticsSpecialist |
| `app/api/me/**` | AuthSpecialist |
| `app/(app)/**` | FrontendArchitect (except `summary/` → AnalyticsSpecialist) |
| `app/login`, `app/signup`, `app/auth/**`, `app/forgot-password`, `app/reset-password`, `middleware.ts` | AuthSpecialist |
| `app/page.tsx` | FrontendArchitect |
| `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` | ReliabilitySpecialist |
| `app/layout.tsx`, `app/globals.css` |