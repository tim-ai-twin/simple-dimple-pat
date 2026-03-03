# Tasks: Demo Account

**Input**: Design documents from `/specs/002-demo-account/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/reset-demo.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create demo constants and enable email auth

- [x] T001 Create demo constants module in `src/lib/demo.ts` — export `DEMO_USER_ID` (placeholder UUID to be updated after user creation), `DEMO_USER_EMAIL` (`demo@simple-dimple-pat.local`), `DEMO_USER_PASSWORD` (`demo-account-public-password`), and helper `isDemoUser(userId: string): boolean`. These are intentionally public — the demo account is shared by design.
- [x] T002 Enable the Email auth provider in the Supabase project dashboard (Authentication → Providers → Email). This is a manual step required for `signInWithPassword()` to work. No code change — just a project setting toggle.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the demo user, build the seed data definitions, and implement the reset-demo Edge Function. MUST be complete before any user story can be tested.

**CRITICAL**: No user story work can begin until this phase is complete — US1 needs the demo user to exist and have seed data.

- [x] T003 Create seed data definitions in `supabase/functions/_shared/demo-seed.ts`. This file must export:
  - `DEMO_USER_ID`, `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` constants (duplicated from frontend for Deno context)
  - `PETSTORE_SPEC_RAW`: A trimmed Petstore OpenAPI 3.0 spec as a JSON string (~8 endpoints covering pet, store, user tags)
  - `getSeedEndpoints(apiId: string)`: Returns array of `parsed_endpoints` rows for the Petstore spec
  - `getSeedTokenData()`: Returns `{ name, tokenHash, tokenPrefix, rawToken }` — pre-generated `sdp_` token with SHA-256 hash
  - `getSeedPermissions(tokenId: string, endpointIds: Record<string, string>)`: Returns `token_endpoint_permissions` rows (all allowed) + one `parameter_constraints` row on `GET /pet/findByStatus` restricting `status` to `["available", "pending"]`
  - `getSeedLogs(apiId: string, tokenId: string, userId: string)`: Returns ~7 `request_logs` rows — mix of successful (various endpoints), blocked (endpoint not allowed), and blocked (parameter constraint violation)
- [x] T004 Create `reset-demo` Edge Function in `supabase/functions/reset-demo/index.ts` per the contract in `specs/002-demo-account/contracts/reset-demo.md`. The function must:
  1. Handle CORS via `_shared/cors.ts`, accept only POST
  2. Authenticate caller via `supabaseAdmin.auth.getUser(token)`
  3. Check if the demo user exists via `supabaseAdmin.auth.admin.getUserById(DEMO_USER_ID)`. If not found, create it via `supabaseAdmin.auth.admin.createUser({ id: DEMO_USER_ID, email: DEMO_USER_EMAIL, password: DEMO_USER_PASSWORD, email_confirm: true })`
  4. Verify `user.id === DEMO_USER_ID` — return 403 if not the demo user
  5. Delete in FK-safe order: `request_logs` (where user_id = demo), `access_tokens` (where user_id = demo, cascades to permissions/constraints), then fetch `credential_vault_id` values from `api_registrations` before deleting them, then delete vault secrets via `DELETE FROM vault.secrets WHERE id = ANY(vault_ids)`
  6. Re-insert seed data: store vault credential via `store_api_credential` RPC → insert `api_registrations` → insert `parsed_endpoints` → insert `access_tokens` + `token_endpoint_permissions` + `parameter_constraints` → insert `request_logs`
  7. Return `{ success: true, api_id, endpoint_count, token_id, log_count }`
  8. Use `verify_jwt: false` (function does its own auth) matching existing Edge Function pattern
- [x] T005 Deploy the `reset-demo` Edge Function to Supabase via MCP tool `mcp__supabase__deploy_edge_function` with `verify_jwt: false`
- [x] T006 Create the demo user and provision initial seed data by invoking the `reset-demo` Edge Function. This bootstraps the demo account — the function will create the user (if missing) and insert all seed data. After invocation, capture the actual `DEMO_USER_ID` UUID and update the constant in both `src/lib/demo.ts` and `supabase/functions/_shared/demo-seed.ts`.

**Checkpoint**: Demo user exists in Supabase Auth. Seed data (Petstore API, endpoints, token, logs) is visible in the database. The reset-demo function is deployed and operational.

---

## Phase 3: User Story 1 — Enter Demo Mode from Landing Page (Priority: P1) MVP

**Goal**: A visitor can click "Demo Account" on the landing page and land on a populated dashboard.

**Independent Test**: Click "Demo Account" → dashboard loads with Petstore API data visible in sidebar and detail panel.

### Implementation for User Story 1

- [x] T007 [US1] Add "Demo Account" button to `LoginPage` in `src/App.tsx`. Below the existing "Sign in with Google" button, add a secondary-styled button labeled "Demo Account". On click, call `supabase.auth.signInWithPassword({ email: DEMO_USER_EMAIL, password: DEMO_USER_PASSWORD })` importing constants from `src/lib/demo.ts`. Style as a secondary/outline button to visually distinguish from the primary Google sign-in. Add loading state while sign-in is in progress.
- [x] T008 [P] [US1] Add demo mode indicator to `Header` in `src/components/layout/Header.tsx`. Import `isDemoUser` from `src/lib/demo.ts`. Get the current user from the Supabase session. When `isDemoUser(session.user.id)` is true, render a badge/pill next to the app title or in the header bar reading "Demo Mode — shared account" with a distinctive color (e.g., blue/info). This satisfies FR-006 (visual indicator on every page).

**Checkpoint**: Clicking "Demo Account" on the landing page signs in and shows the dashboard with seed data. Demo mode badge is visible in the header.

---

## Phase 4: User Story 2 — Explore Features as Demo User (Priority: P2)

**Goal**: All existing features work correctly when accessed through the demo account.

**Independent Test**: Navigate through APIs, endpoints, tokens, activity log — all display data and interactive features work.

### Implementation for User Story 2

- [x] T009 [US2] Verify demo account feature parity — manually test all dashboard interactions as the demo user: (1) Click the Petstore API in sidebar → detail panel shows API info and endpoints, (2) Expand API in sidebar → token children are visible, (3) Click the demo token → token detail view shows status, permissions, activity, (4) Click "Create Token" → token creation flow works and new token appears, (5) Activity log shows seed entries. No code changes expected — this is a verification task. If any feature doesn't work, fix the issue in the relevant component.

**Checkpoint**: All existing features work identically for the demo user as they do for a regular authenticated user.

---

## Phase 5: User Story 3 — Reset Demo Data (Priority: P3)

**Goal**: Demo user can click "Reset Demo" in the sidebar to wipe and re-provision seed data.

**Independent Test**: Modify demo data (delete API, create extra tokens), click "Reset Demo", confirm → dashboard shows clean seed data.

### Implementation for User Story 3

- [x] T010 [P] [US3] Create `useResetDemo` hook in `src/hooks/useDemo.ts`. Implement a TanStack Query `useMutation` that calls the `reset-demo` Edge Function via `supabase.functions.invoke('reset-demo', { method: 'POST' })`. On success, invalidate all relevant queries (`useApiList`, `useTokensForApi`, `useActivityLog`) via `queryClient.invalidateQueries()`. Export the mutation hook for use in the sidebar.
- [x] T011 [US3] Add "Reset Demo" button to `Sidebar` in `src/components/layout/Sidebar.tsx`. Import `isDemoUser` from `src/lib/demo.ts` and `useResetDemo` from `src/hooks/useDemo.ts`. Get the current user session. Conditionally render a "Reset Demo" button at the bottom of the sidebar (above or below the existing "+ Add API" button) only when `isDemoUser(session.user.id)` is true. On click, show a confirmation dialog (window.confirm or a simple modal) with text "Reset demo to original state? All current demo data will be replaced." On confirm, call the reset mutation. Show loading state during reset. The sidebar needs access to the user session — pass it as a prop from `DashboardPage.tsx` or get it via `supabase.auth.getSession()` inside the component. Also update `src/pages/DashboardPage.tsx` if props need to be threaded.

**Checkpoint**: "Reset Demo" button visible in sidebar for demo user only. Clicking it wipes data and restores seed state. Button hidden for non-demo users.

---

## Phase 6: User Story 4 — Exit Demo and Sign Up (Priority: P4)

**Goal**: Demo user can sign out and return to the landing page to create their own account.

**Independent Test**: Click sign out → landing page appears → click "Sign in with Google" → normal OAuth flow, private account with no demo data.

### Implementation for User Story 4

- [x] T012 [US4] Verify sign-out flow works from demo mode. The existing sign-out button in `Header.tsx` calls `supabase.auth.signOut()` which clears the session and triggers `onAuthStateChange` → `AuthGuard` renders `LoginPage`. No code changes expected. Test that: (1) clicking sign out from demo mode returns to landing page, (2) both "Sign in with Google" and "Demo Account" buttons are visible, (3) signing in with Google creates a separate private account with no demo data. If the flow has any issues, fix them.

**Checkpoint**: Demo user can cleanly exit demo mode and sign up for their own account.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Deploy, verify end-to-end, clean up

- [x] T013 Build and deploy frontend to Netlify production. Run `npm run build` and verify no build errors. Deploy via Netlify (auto-deploy on push or manual trigger).
- [x] T014 End-to-end smoke test on production: (1) Visit landing page, (2) Click "Demo Account" → dashboard with Petstore data, (3) Verify demo mode badge in header, (4) Navigate APIs, tokens, activity log, (5) Click "Reset Demo" → confirm → data refreshes, (6) Sign out → landing page, (7) Verify "Sign in with Google" still works for real accounts.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (needs demo constants). T003 and T004 depend on T001. T005 depends on T004. T006 depends on T002 + T005.
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion (needs demo user + seed data)
- **User Story 2 (Phase 4)**: Depends on Phase 3 (needs working demo login to verify features)
- **User Story 3 (Phase 5)**: Depends on Phase 2 (needs reset-demo deployed). Can run in parallel with US1/US2 for the hook/UI work.
- **User Story 4 (Phase 6)**: Depends on Phase 3 (needs working demo login to test sign-out)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational only — no cross-story dependencies
- **User Story 2 (P2)**: Depends on US1 (need demo login working to verify features)
- **User Story 3 (P3)**: Depends on Foundational (reset-demo already deployed). UI work (T010, T011) can be developed in parallel with US1/US2
- **User Story 4 (P4)**: Depends on US1 (need demo login working to test sign-out)

### Within Each Phase

- Phase 2: T003 before T004 (seed data needed by Edge Function), T004 before T005 (deploy after code), T005 before T006 (invoke after deploy)
- Phase 3: T007 and T008 can run in parallel [P]
- Phase 5: T010 before T011 (hook needed by UI component)

### Parallel Opportunities

- T007 and T008 (US1): Different files (`App.tsx` vs `Header.tsx`)
- T010 (US3 hook) can be developed while US1/US2 are being verified
- Multiple user stories can be verified concurrently once demo login works

---

## Parallel Example: User Story 1

```bash
# These two tasks touch different files and can run in parallel:
Task T007: "Add Demo Account button to LoginPage in src/App.tsx"
Task T008: "Add demo mode indicator to Header in src/components/layout/Header.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003-T006) — demo user exists, seed data loaded
3. Complete Phase 3: User Story 1 (T007-T008) — demo login works, badge visible
4. **STOP and VALIDATE**: Click "Demo Account" → populated dashboard with badge
5. Deploy if ready — users can already explore the demo

### Incremental Delivery

1. Setup + Foundational → Demo infrastructure ready
2. Add User Story 1 → Demo login works → Deploy (MVP!)
3. Add User Story 2 → Verify all features work → Deploy
4. Add User Story 3 → Reset button works → Deploy
5. Add User Story 4 → Sign-out/sign-up verified → Deploy
6. Polish → Production smoke test → Done

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- The `reset-demo` Edge Function is foundational (Phase 2) because seed data must exist before US1 can be tested, even though the "Reset Demo" button UI is US3
- Demo constants are duplicated between `src/lib/demo.ts` (frontend, Vite) and `supabase/functions/_shared/demo-seed.ts` (Edge Functions, Deno) because they have different module systems
- The DEMO_USER_ID placeholder in T001 gets updated in T006 after the user is actually created
- T009 and T012 are verification tasks — no code changes expected unless issues are found
