# Implementation Plan: Demo Account

**Branch**: `002-demo-account` | **Date**: 2026-03-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-demo-account/spec.md`

## Summary

Add a shared demo account that lets visitors explore the system without signing up. A "Demo Account" button on the landing page signs into a pre-created Supabase Auth user with password-based auth. The demo account has pre-loaded Petstore API data (registration, endpoints, token, activity logs). A "Reset Demo" button in the sidebar (demo user only) wipes all demo data and re-provisions the seed via a new `reset-demo` Edge Function. A visual indicator shows the user they're in demo mode.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite frontend), Deno (Supabase Edge Functions)
**Primary Dependencies**: React 18, Tailwind CSS, shadcn/ui (Radix), TanStack Query, `@supabase/supabase-js`
**Storage**: Supabase Postgres (existing tables — no new tables), Supabase Vault (existing)
**Testing**: Playwright via MCP (UI verification), manual testing
**Target Platform**: Web (modern browsers)
**Project Type**: Web application (SPA + serverless functions)
**Performance Goals**: Demo sign-in < 3s, demo reset < 5s
**Constraints**: No new tables, no changes to existing RLS policies or Edge Functions
**Scale/Scope**: Single shared demo account, ~10 seed endpoints, 1 seed token, ~7 seed log entries

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Security-First** | PASS | Demo credentials are intentionally public (shared account by design). No changes to token hashing, vault isolation, or RLS. Demo user goes through the same auth path as real users. |
| **II. Self-Serve by Default** | PASS | Demo mode is fully self-serve — no admin action needed. Reset is self-serve via button. |
| **III. OpenAPI-Driven Permissions** | PASS | Seed data uses a real OpenAPI spec (Petstore). Endpoints extracted server-side. No changes to permission model. |
| **IV. Supabase-Native** | PASS | Uses Supabase Auth (`signInWithPassword`), existing RLS, new Edge Function for reset. TanStack Query for state. |
| **V. Simplicity & Incremental Delivery** | PASS | No new tables, no new abstractions. Reuses existing schema. Each user story is independently testable. |
| **VI. UI Verification via Playwright** | PASS | All 4 user stories have UI interactions that will be verified via Playwright MCP. |

### Post-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Security-First** | PASS | `reset-demo` Edge Function verifies caller is demo user via JWT. Vault operations use service_role only. Demo password is public by design (documented in spec). |
| **II. Self-Serve by Default** | PASS | One-click demo entry. One-click reset. |
| **III. OpenAPI-Driven Permissions** | PASS | Seed data includes real Petstore OpenAPI spec with server-parsed endpoints. |
| **IV. Supabase-Native** | PASS | Email auth provider enabled for password login. Edge Function pattern matches existing functions. |
| **V. Simplicity & Incremental Delivery** | PASS | 1 new Edge Function, 1 new lib file, modifications to 3 existing components. No new tables or migrations. |
| **VI. UI Verification via Playwright** | PASS | Test plan covers: demo login, dashboard data, reset flow, sign-out/sign-in transition. |

## Project Structure

### Documentation (this feature)

```text
specs/002-demo-account/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: Research decisions
├── data-model.md        # Phase 1: Data model (no new tables)
├── quickstart.md        # Phase 1: Setup guide
├── contracts/
│   └── reset-demo.md    # Phase 1: reset-demo Edge Function contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── App.tsx                              # MODIFY: Add "Demo Account" button to LoginPage
├── lib/
│   ├── supabase.ts                      # (no changes)
│   └── demo.ts                          # NEW: DEMO_USER_ID, DEMO_USER_EMAIL, DEMO_USER_PASSWORD, isDemoUser()
├── hooks/
│   └── useDemo.ts                       # NEW: useResetDemo() mutation, useDemoMode() context
├── components/
│   └── layout/
│       ├── Sidebar.tsx                  # MODIFY: Add "Reset Demo" button (demo user only)
│       └── Header.tsx                   # MODIFY: Add demo mode indicator badge
├── pages/
│   └── DashboardPage.tsx                # MODIFY: Pass demo mode state to children

supabase/functions/
├── _shared/
│   └── demo-seed.ts                     # NEW: Seed data definitions (spec, endpoints, token, logs)
└── reset-demo/
    └── index.ts                         # NEW: Edge Function — delete demo data + re-provision seed

shared/
└── types.ts                             # (no changes)
```

**Structure Decision**: Follows the existing project layout. New files are placed in conventional locations (`src/lib/` for config, `src/hooks/` for React hooks, `supabase/functions/` for Edge Functions). No new directories or structural changes.

## Complexity Tracking

No constitution violations. No complexity justifications needed.
