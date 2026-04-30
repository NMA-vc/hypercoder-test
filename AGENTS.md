# AGENTS.md

# HabitFlow — Specialist Agent Fleet

This document defines the specialist agent fleet responsible for building HabitFlow. Each agent owns a focused vertical of the system and is accountable for the files listed under "Owned Files." Agents coordinate via the task graph defined in the BuildSpec; cross-cutting changes require sign-off from all owning agents.

**Stack:** `tectic_v1` (Next.js App Router + TypeScript + Tailwind + Prisma)
**Coordination model:** Wave-based execution per `task_graph`. Agents within the same wave may execute in parallel; downstream waves block on upstream completion.

---

## 1. PlatformEngineer

**Role:** Owns project scaffolding, build tooling, and cross-cutting configuration. The first agent to execute and the gatekeeper for all dependency / config changes.

**Capabilities:**
- Initialize Next.js + TypeScript + Tailwind project
- Configure tsconfig paths, Tailwind theme tokens (incl. dark mode class strategy), Next.js runtime config
- Maintain dependency hygiene and lockfile
- Wire up linting/formatting baselines

**Owned Files:**
- `package.json`
- `tsconfig.json`
- `tailwind.config.ts`
- `next.config.js`

**Tasks:** `t1`
**Dependencies:** None (Wave 0 entry point)

---

## 2. DBSpecialist

**Role:** Owns the data layer: schema, migrations, and Prisma client conventions. Single source of truth for the `User`, `Habit`, `Completion`, and `Session` models.

**Capabilities:**
- Author Prisma schema with proper relations, indices (e.g. `(habit_id, date)` unique), and cascade rules
- Generate and version migrations
- Enforce timezone-safe date storage (UTC `DATE` columns) — directly mitigates risk: *"Streak calc errors across timezones"*
- Provide DB seed scripts for local dev

**Owned Files:**
- `prisma/schema.prisma`
- `prisma/migrations/`

**Tasks:** `t2`
**Dependencies:** `t1`

---

## 3. AuthSpecialist

**Role:** Owns authentication, session lifecycle, and route protection. Roll-your-own implementation — explicit risk owner for *"Auth security via roll-your-own implementation."*

**Capabilities:**
- Implement bcrypt/argon2 password hashing
- Issue and validate session tokens stored in `Session` table; HttpOnly + Secure + SameSite cookies
- Build Next.js middleware to gate authenticated routes and redirect unauth users to `/login`
- Implement `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- Provide `getCurrentUser()` server helper consumed by all downstream API routes

**Owned Files:**
- `src/lib/auth.ts`
- `src/middleware.ts`
- `src/app/api/auth/`
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`

**Tasks:** `t3`, `t4`
**Dependencies:** `t2`

---

## 4. HabitsAPISpecialist

**Role:** Owns the Habit resource: CRUD endpoints with strict ownership enforcement (users may only mutate their own habits).

**Capabilities:**
- Implement `GET/POST /api/habits` and `GET/PATCH/DELETE /api/habits/:id`
- Validate request bodies (zod or equivalent) for `name`, `description`, `color`, `archived`
- Enforce `habit.user_id === session.user_id` on every mutation
- Soft-archive semantics rather than hard delete where appropriate

**Owned Files:**
- `src/app/api/habits/route.ts`
- `src/app/api/habits/[id]/route.ts`

**Tasks:** `t5`
**Dependencies:** `t3`

---

## 5. CompletionsEngineer

**Role:** Owns daily completion logging and streak computation. Risk owner for *"Streak calc errors across timezones"* and *"Backfill abuse skewing analytics."*

**Capabilities:**
- Implement `POST /api/completions` (toggle semantics: creates or deletes), `DELETE /api/completions/:id`, `GET /api/habits/:id/completions`
- Enforce 30-day backfill window server-side (reject `date` older than `today - 30d` UTC)
- Enforce uniqueness `(habit_id, date)` to prevent double-logging
- Compute current streak (resets on missed day) and longest streak (historical max) in `src/lib/streaks.ts`
- Provide pure, deterministic streak functions covered by unit tests

**Owned Files:**
- `src/app/api/completions/route.ts`
- `src/lib/streaks.ts`

**Tasks:** `t6`
**Dependencies:** `t5`

---

## 6. FrontendArchitect

**Role:** Owns the dashboard shell, habit-management UI, and component contracts consumed by other UI agents. Sets visual + interaction conventions for the app.

**Capabilities:**
- Build dashboard route, habit list rendering, and create/edit forms
- Define `HabitCard` props consumed by `CompletionToggle` and `WeekGrid`
- Surface streak data from `src/lib/streaks.ts` on each habit card
- Coordinate with ThemeSpecialist and UXResponsiveSpecialist on shared component patterns

**Owned Files:**
- `src/app/dashboard/page.tsx`
- `src/components/HabitCard.tsx`
- `src/components/HabitForm.tsx`

**Tasks:** `t7`
**Dependencies:** `t5`

---

## 7. LoggingUXSpecialist

**Role:** Owns the daily completion interaction surface, including backfill UI.

**Capabilities:**
- Build `CompletionToggle` (checkbox-style; tap to mark, re-tap to unmark)
- Build `DatePicker` constrained to last 30 days (UI mirror of backfill window)
- Optimistic updates with rollback on API failure
- Ensure 44px+ touch targets (coordinated with UXResponsiveSpecialist)

**Owned Files:**
- `src/components/CompletionToggle.tsx`
- `src/components/DatePicker.tsx`

**Tasks:** `t8`
**Dependencies:** `t6`, `t7`

---

## 8. AnalyticsSpecialist

**Role:** Owns the weekly summary feature end-to-end (API + UI).

**Capabilities:**
- Implement `GET /api/summary/weekly` returning per-habit 7-day completion grid + overall % completion
- Build `WeekGrid` component (7 cells, completion state per day)
- Build `/summary` page assembling per-habit grids
- Ensure summary updates reactively after a completion is logged (revalidation strategy)

**Owned Files:**
- `src/app/summary/page.tsx`
- `src/app/api/summary/weekly/route.ts`
- `src/components/WeekGrid.tsx`

**Tasks:** `t9`
**Dependencies:** `t6`, `t7`

---

## 9. ThemeSpecialist

**Role:** Owns dark-mode infrastructure and theme persistence.

**Capabilities:**
- Implement `ThemeProvider` (React context, hydration-safe)
- Implement `ThemeToggle` placed in header
- Persist user choice in `localStorage`; respect `User.theme_preference` when authenticated
- Audit Tailwind class usage to guarantee both modes render correctly

**Owned Files:**
- `src/components/ThemeProvider.tsx`
- `src/components/ThemeToggle.tsx`

**Tasks:** `t10`
**Dependencies:** `t1`

---

## 10. UXResponsiveSpecialist

**Role:** Owns global layout, navigation, and responsive behavior from 320px upward.

**Capabilities:**
- Build `Layout` shell (header, content, footer slots)
- Build `MobileNav` with collapsing behavior on small screens
- Maintain `globals.css` (resets, typography, base tokens)
- Enforce no-horizontal-scroll and 44px touch-target rules across the app

**Owned Files:**
- `src/components/Layout.tsx`
- `src/components/MobileNav.tsx`
- `src/app/globals.css`

**Tasks:** `t11`
**Dependencies:** `t7`

---

## 11. QAEngineer

**Role:** Owns the test pyramid: unit coverage for pure logic (esp. streaks) and end-to-end coverage for acceptance criteria.

**Capabilities:**
- Configure Playwright for E2E flows: register → create habit → log completion → backfill → view summary
- Write unit tests for `src/lib/streaks.ts` covering edge cases (timezone boundaries, missed days, backfill insertion)
- Write API integration tests for ownership enforcement and 30-day backfill rejection
- Smoke-test dark mode and mobile viewports

**Owned Files:**
- `tests/`
- `playwright.config.ts`

**Tasks:** `t12`
**Dependencies:** `t8`, `t9`

---

## Execution Waves

| Wave | Agents Active | Tasks |
|------|---------------|-------|
| 0 | PlatformEngineer → DBSpecialist → AuthSpecialist | t1, t2, t3 |
| 1 | AuthSpecialist, HabitsAPISpecialist, CompletionsEngineer, FrontendArchitect, LoggingUXSpecialist | t4, t5, t6, t7, t8 |
| 2 | AnalyticsSpecialist, ThemeSpecialist, UXResponsiveSpecialist, QAEngineer | t9, t10, t11, t12 |

## Cross-Cutting Conventions

- **Authorization:** Every API route handler (outside `/api/auth/*`) MUST call `getCurrentUser()` from `src/lib/auth.ts` and reject with 401 on miss. AuthSpecialist owns this contract.
- **Dates:** All persisted dates are UTC `DATE`. Client-to-server conversion happens at API boundaries. CompletionsEngineer owns this contract.
- **Ownership checks:** All mutations on `Habit` and `Completion` MUST verify `resource.user_id === session.user_id`. HabitsAPISpecialist + CompletionsEngineer co-own.
- **Component theming:** New UI components MUST be reviewed against light + dark palettes before merge. ThemeSpecialist signs off.