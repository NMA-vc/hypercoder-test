# AGENTS.md — HabitFlow Specialist Fleet

This document defines the specialist agent fleet responsible for building **HabitFlow**, a mobile-first habit tracker built on Next.js 15 (App Router), Supabase, and shadcn/ui.

Each agent owns a distinct slice of the system. Files are owned exclusively to prevent merge conflicts during parallel waves. Agents must coordinate across declared dependencies via the task graph.

---

## Conventions

- **Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Auth + Postgres + RLS), next-themes, Playwright.
- **Server-first:** Prefer Server Components and Server Actions; Client Components only when interactivity demands.
- **Security:** All DB access goes through Supabase RLS; no service-role key in client bundles.
- **Dates:** UTC in DB; `today` derived from browser timezone at the edge (Server Action receives client-provided date string `YYYY-MM-DD`).
- **Testing:** Unit tests colocated; E2E in `/e2e`.

---

## 1. PlatformSpecialist

**Role:** Bootstraps and maintains the project shell, build pipeline, and shared design tokens.

**Capabilities:**
- Next.js 15 + App Router scaffolding
- Tailwind v4 configuration and shadcn/ui CLI integration
- Root layout, font loading, global styles
- Vercel deployment configuration

**Owned files:**
- `package.json`
- `next.config.ts`
- `tailwind.config.ts`
- `app/layout.tsx`
- `app/globals.css`
- `components.json`
- `vercel.json`
- `README.md`

**Tasks:** T01, T15

**Coordination:** Provides the foundation all other agents depend on. Must publish initial commit before Wave 1 begins.

---

## 2. DBSpecialist

**Role:** Owns the Postgres schema, migrations, and Row Level Security policies in Supabase.

**Capabilities:**
- SQL DDL and migration authoring
- Supabase RLS policy design (per-user isolation on `habits` and `completions`)
- Index design (e.g., `(user_id, archived)`, unique `(habit_id, completed_on)`)
- Schema review for streak/timezone edge cases

**Owned files:**
- `supabase/migrations/0001_init.sql`

**Tasks:** T03

**Coordination:** Publishes schema before T07 (server actions) and T11 (streaks). Risk owner for **RLS misconfiguration leaking data**.

---

## 3. AuthSpecialist

**Role:** Implements Supabase Auth integration: signup, login, logout, session middleware, and protected layout enforcement.

**Capabilities:**
- Supabase SSR client (`@supabase/ssr`) wiring for browser, server, and middleware
- Email/password flows + auth callback route
- Cookie-based session refresh in middleware
- Redirect logic for unauthenticated users

**Owned files:**
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/middleware.ts`
- `middleware.ts`
- `.env.example`
- `app/login/page.tsx`
- `app/signup/page.tsx`
- `app/auth/actions.ts`
- `app/auth/callback/route.ts`

**Tasks:** T02, T05

**Coordination:** Auth client consumed by every server action and protected page. Must complete T02 before any data-layer work begins.

---

## 4. FrontendArchitect

**Role:** Owns the application shell, navigation, theming, and shared UI primitives.

**Capabilities:**
- Protected `(app)` route group layout
- next-themes integration (system + manual toggle, no FOUC)
- Desktop nav and mobile drawer nav
- Responsive design system enforcement (375px baseline, ≥44px tap targets)

**Owned files:**
- `components/theme-provider.tsx`
- `components/theme-toggle.tsx`
- `app/(app)/layout.tsx`
- `components/nav.tsx`
- `components/mobile-nav.tsx`

**Tasks:** T04, T06, T13

**Coordination:** Consumes AuthSpecialist's server client to gate the `(app)` group. Provides shell that FeatureSpecialist pages render into.

---

## 5. DomainSpecialist

**Role:** Owns the domain logic — habit/completion server actions, types, and streak computation.

**Capabilities:**
- Zod input validation for server actions
- Idempotent completion toggle (insert-or-delete on `(habit_id, completed_on)`)
- Pure streak algorithm (current + longest) with DST/timezone-safe date math
- TypeScript domain types shared across UI and actions
- Unit tests for streak edge cases

**Owned files:**
- `lib/types.ts`
- `app/(app)/habits/actions.ts`
- `app/(app)/completions/actions.ts`
- `lib/streaks.ts`
- `lib/streaks.test.ts`

**Tasks:** T07, T09, T11

**Coordination:** Depends on DBSpecialist's schema. Risk owner for **timezone handling** and **streak edge cases around DST**. Server actions must call `revalidatePath` for affected routes.

---

## 6. FeatureSpecialist

**Role:** Builds the user-facing feature pages and habit-specific components.

**Capabilities:**
- Habit management UI (list, create form, edit, archive)
- Today's dashboard with optimistic completion toggling (`useOptimistic`)
- Weekly 7-day grid with completion percentage
- Mobile-first composition using shadcn primitives

**Owned files:**
- `app/(app)/habits/page.tsx`
- `app/(app)/habits/new/page.tsx`
- `components/habit-form.tsx`
- `app/(app)/page.tsx`
- `components/habit-row.tsx`
- `app/(app)/summary/page.tsx`
- `components/week-grid.tsx`

**Tasks:** T08, T10, T12

**Coordination:** Consumes DomainSpecialist's actions/types and FrontendArchitect's layout. Must pass `today` (client-derived `YYYY-MM-DD`) into completion actions to honor browser timezone.

---

## 7. QASpecialist

**Role:** End-to-end test coverage for critical user journeys.

**Capabilities:**
- Playwright configuration (multi-browser, mobile viewport)
- Auth journey tests (signup → login → protected route)
- Habit CRUD + completion toggle smoke tests
- CI-friendly test runs against ephemeral Supabase project

**Owned files:**
- `playwright.config.ts`
- `e2e/auth.spec.ts`
- `e2e/habits.spec.ts`

**Tasks:** T14

**Coordination:** Final gate before T15 (deploy). Validates acceptance criteria across all features.

---

## Wave Execution Plan

| Wave | Agents Active | Tasks |
|------|---------------|-------|
| **0** | PlatformSpecialist, AuthSpecialist (setup), DBSpecialist, FrontendArchitect (theme) | T01, T02, T03, T04 |
| **1** | AuthSpecialist (pages), FrontendArchitect (shell), DomainSpecialist, FeatureSpecialist | T05, T06, T07, T08, T09, T10 |
| **2** | DomainSpecialist (streaks), FeatureSpecialist (summary), FrontendArchitect (mobile), QASpecialist, PlatformSpecialist (deploy) | T11, T12, T13, T14, T15 |

---

## Cross-Cutting Responsibilities

- **Risk: Timezone for "today"** — Owned by DomainSpecialist; mitigated by FeatureSpecialist passing client-local date into actions.
- **Risk: RLS data leakage** — Owned by DBSpecialist; verified by QASpecialist via cross-account E2E assertion.
- **Risk: Streak DST edge cases** — Owned by DomainSpecialist; covered by `lib/streaks.test.ts`.
- **Out of scope (do not implement):** push/email reminders, social features, payments, custom frequencies, native apps, historical analytics beyond weekly view, data export.