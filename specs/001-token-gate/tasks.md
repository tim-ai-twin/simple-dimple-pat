# Tasks: Simple Dimple PAT — Personal Token Management for AI Agents

**Input**: Design documents from `/specs/001-token-gate/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included per constitution (Principle VI: UI Verification via Playwright) and user request for testing attention.

**Organization**: Tasks grouped by user story. Each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1–US6)
- Exact file paths included in every task

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, dependencies, configuration, and test fixtures

- [x] T001 Initialize Vite + React 18 + TypeScript project at repository root with `package.json`, `vite.config.ts`, `tsconfig.json`
- [ ] T002 Create a new Supabase hosted project via `supabase projects create simple-dimple-pat` (or via dashboard), note the project ref, then initialize locally with `supabase init` and `supabase link --project-ref <ref>` creating `supabase/` directory and `supabase/config.toml`
- [x] T003 [P] Create `netlify.toml` with edge function routing: path `/proxy/*` → `proxy` edge function, Vite build settings
- [x] T004 [P] Create `netlify/edge-functions/` directory structure and Deno import map (`import_map.json`) mapping `@supabase/supabase-js` to esm.sh
- [x] T005 [P] Install frontend dependencies: `react`, `react-dom`, `@tanstack/react-query`, `@supabase/supabase-js`, `react-router-dom`, `tailwindcss`, `@radix-ui/react-*` (shadcn/ui primitives)
- [x] T006 [P] Install dev dependencies: `vitest`, `@playwright/test`, `@stoplight/prism-cli`, `mockttp`, `@readme/openapi-parser`
- [x] T007 [P] Configure Tailwind CSS in `tailwind.config.ts` with terracotta/cream theme tokens: primary `#8B3A2A`, background `#FAF3EB`, rounded pill shapes, serif headings + sans-serif body
- [x] T008 [P] Create design token constants in `src/theme/tokens.ts`: colors, typography scale, border radius, spacing
- [ ] T009 [P] Initialize shadcn/ui components in `src/components/ui/` themed with terracotta/cream palette: Button, Input, Checkbox, Badge, Dialog, DropdownMenu, Toggle, Tooltip
- [x] T010 [P] Create shared TypeScript types in `shared/types.ts`: `ApiRegistration`, `ParsedEndpoint`, `AccessToken`, `TokenEndpointPermission`, `ParameterConstraint`, `RequestLog`, `ShareTemplate`
- [x] T011 [P] Create test fixtures in `tests/fixtures/`: `petstore-minimal.yaml` (2 endpoints), `petstore-full.yaml` (full Petstore with tags/params/auth), `sdp-test-api.yaml` (custom spec with param constraint scenarios)
- [x] T012 [P] Configure Vitest in `vitest.config.ts` with unit test paths (`tests/unit/`) and integration test paths (`tests/integration/`)
- [x] T013 [P] Configure Playwright in `playwright.config.ts` with E2E test paths (`tests/e2e/`), base URL `http://localhost:8888`, and Playwright MCP integration
- [x] T014 [P] Add npm scripts to `package.json`: `dev`, `build`, `test:unit`, `test:integration`, `test:e2e`, `test:all`
- [ ] T015 Create Netlify site via `netlify sites:create --name simple-dimple-pat` (or link existing), store site ID in `.netlify/state.json`, configure Netlify–Supabase integration to auto-provision `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` environment variables
- [x] T016 [P] Create GitHub Actions CI workflow in `.github/workflows/ci.yml`: on push/PR to `main` and feature branches — install deps, run `npm run test:unit`, run lint, build with `npm run build`
- [x] T017 [P] Create GitHub Actions deploy workflow in `.github/workflows/deploy.yml`: on push to `main` — build and deploy to Netlify production via `netlify deploy --prod` using `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` GitHub secrets; on PR — deploy preview via `netlify deploy` and comment preview URL on PR
- [x] T018 [P] Create GitHub Actions database migration workflow in `.github/workflows/migrate.yml`: on push to `main` when `supabase/migrations/` changes — run `supabase db push` to apply migrations to hosted Supabase project using `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` GitHub secrets
- [ ] T019 [P] Document required GitHub repository secrets in `specs/001-token-gate/quickstart.md`: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, auth, Supabase client, shared utilities — MUST complete before any user story

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T020 Create database migration `supabase/migrations/001_create_api_registrations.sql` with `api_registrations` table per data-model.md (all columns, constraints, indexes)
- [x] T021 Create database migration `supabase/migrations/002_create_parsed_endpoints.sql` with `parsed_endpoints` table, unique constraint on `(api_id, method, path_template)`, CASCADE delete from `api_registrations`
- [x] T022 Create database migration `supabase/migrations/003_create_access_tokens.sql` with `access_tokens` table, unique index on `token_hash`, status CHECK constraint, CASCADE delete from `api_registrations`
- [x] T023 Create database migration `supabase/migrations/004_create_token_endpoint_permissions.sql` with `token_endpoint_permissions` table, unique constraint on `(token_id, endpoint_id)`, CASCADE deletes
- [x] T024 Create database migration `supabase/migrations/005_create_parameter_constraints.sql` with `parameter_constraints` table, unique constraint on `(permission_id, param_name)`, CASCADE delete
- [x] T025 Create database migration `supabase/migrations/006_create_request_logs.sql` with `request_logs` table, indexes on `(api_id, created_at DESC)`, `(token_id, created_at DESC)`, `(created_at)`, ON DELETE SET NULL for token/api FKs
- [x] T026 Create database migration `supabase/migrations/007_vault_wrapper_functions.sql` with SECURITY DEFINER functions: `store_api_credential()`, `get_api_credential()`, `update_api_credential()`, `delete_api_credential()` per data-model.md Vault Usage section
- [x] T027 Create database migration `supabase/migrations/008_rls_policies.sql` with RLS policies: `user_id = auth.uid()` on `api_registrations`, `access_tokens`, `request_logs`; join-based policies on `parsed_endpoints`, `token_endpoint_permissions`, `parameter_constraints`
- [ ] T028 [P] Configure Supabase Auth with Google OAuth provider in `supabase/config.toml` (scopes: `openid`, `email`, `profile`)
- [x] T029 [P] Create Supabase client initialization in `src/lib/supabase.ts` using `SUPABASE_URL` and `SUPABASE_ANON_KEY` env vars, with auth session persistence
- [x] T030 [P] Create service role admin client in `supabase/functions/_shared/supabase-admin.ts` using `SUPABASE_SERVICE_ROLE_KEY`
- [x] T031 [P] Create CORS helper in `supabase/functions/_shared/cors.ts` with standard CORS headers for Edge Function responses
- [x] T032 [P] Implement glob pattern matching utility in `src/lib/glob.ts`: function `matchGlob(pattern: string, value: string): boolean` supporting `*` (any chars) and `?` (single char), plus `matchAnyGlob(patterns: string[], value: string): boolean`
- [x] T033 [P] Implement token utilities in `supabase/functions/_shared/token-utils.ts`: `generateToken()` (crypto.getRandomValues + base62 encoding + CRC32), `hashToken()` (SHA-256 hex via crypto.subtle), `validateTokenFormat()` (sdp_ prefix + CRC32 check)
- [x] T034 [P] Create auth guard wrapper in `src/App.tsx` with React Router: redirect unauthenticated users to login, wrap authenticated routes with Supabase session provider
- [x] T035 [P] Create TanStack Query provider setup in `src/App.tsx` with `QueryClient` configuration
- [x] T036 [P] Create master-detail layout shell in `src/components/layout/`: `Header.tsx` (top bar with user info + logout), `Sidebar.tsx` (placeholder collapsible tree), `DetailPanel.tsx` (placeholder right panel) — styled with terracotta/cream theme
- [x] T037 Create main `DashboardPage.tsx` in `src/pages/` composing Header + Sidebar + DetailPanel in a CSS grid/flex layout
- [x] T038 [P] Create seed data in `supabase/seed.sql`: test user, sample API registration (Petstore), sample parsed endpoints, sample token

**Checkpoint**: Foundation ready — database schema deployed, auth working, layout shell visible, utilities tested. User story implementation can begin.

---

## Phase 3: User Story 1 — Import an API and Store Credentials (P1) MVP

**Goal**: Users can register an external API by uploading an OpenAPI spec, providing a base URL, selecting auth method (Bearer Token or API Key), and storing their credential securely in Vault.

**Independent Test**: Upload a Petstore spec, verify endpoints appear in sidebar tree and detail panel.

### Tests for User Story 1

- [x] T039 [P] [US1] Unit test for OpenAPI spec parsing in `tests/unit/parse-spec.test.ts`: parse minimal Petstore, extract endpoints with method/path/params/tags; handle specs without tags; reject invalid specs
- [x] T040 [P] [US1] Integration test for `parse-spec` Edge Function in `tests/integration/parse-spec.test.ts`: upload spec via function invoke, verify `api_registrations` and `parsed_endpoints` rows created, credential stored in Vault
- [x] T041 [P] [US1] Playwright E2E test in `tests/e2e/api-registration.spec.ts`: navigate to dashboard, click "+ Add API", fill form (name, URL, spec file, auth method, credential), submit, verify API appears in sidebar with correct endpoint count

### Implementation for User Story 1

- [x] T042 [US1] Implement `parse-spec` Supabase Edge Function in `supabase/functions/parse-spec/index.ts`: accept request body per management-api.md contract, validate OpenAPI spec with `@readme/openapi-parser`, extract endpoints (operation_id, method, path, params, tags), store API registration + credential in Vault + parsed endpoints in DB, return response per contract
- [x] T043 [US1] Create `useApis` TanStack Query hook in `src/hooks/useApis.ts`: `useApiList()` fetching `api_registrations` with parsed_endpoints count and access_tokens count, `useApiDetail(apiId)` with full parsed_endpoints, mutation for delete
- [x] T044 [P] [US1] Create `SpecUpload.tsx` component in `src/components/api/`: drag-and-drop zone for .yaml/.json files, client-side validation preview (using `@readme/openapi-parser`), file size display, error state for invalid specs
- [x] T045 [P] [US1] Create `AddApiForm.tsx` component in `src/components/api/`: inline form in detail panel with fields for name, base URL, auth method dropdown (Bearer Token / API Key Header / API Key Query), conditional auth_header_name/auth_query_param fields, credential input (obscured), SpecUpload integration, "Save API" button calling `parse-spec` Edge Function
- [x] T046 [US1] Create `ApiDetailView.tsx` component in `src/components/api/`: display API name, base URL, spec version badge, endpoint count, active token count, endpoint list grouped by tags, "Re-upload Spec" button, "Delete API" with confirmation dialog
- [x] T047 [US1] Update `Sidebar.tsx` in `src/components/layout/`: render collapsible tree from `useApiList()` data — API names as parent nodes with expand/collapse, token names as children (placeholder for US2), "+ Add API" button at bottom, status indicators (green/yellow/red) on tokens, selected state highlighting
- [x] T048 [US1] Wire sidebar selection to detail panel in `DashboardPage.tsx`: clicking an API in sidebar shows `ApiDetailView`, clicking "+ Add API" shows `AddApiForm`, manage selected state via URL params or local state

### Playwright MCP Verification for User Story 1

- [ ] T049 [US1] **GATE — Playwright MCP verification**: With local dev servers running (`supabase start`, `supabase functions serve`, `netlify dev`), use Playwright MCP to validate all spec.md US1 acceptance scenarios against the live application: (1) Click "+ Add API", fill name/URL/spec/auth/credential, submit → API appears in sidebar with parsed endpoints; (2) Select API in sidebar → detail panel shows name, base URL, spec version badge, endpoint count, token count, re-upload option; (3) Upload malformed spec → clear error message displayed; (4) Credential displayed as obscured (e.g., `ghp_•••••••••••`) with "Show" toggle. Story MUST NOT be marked complete until all scenarios pass.

**Checkpoint**: User Story 1 complete — users can register APIs, upload specs, see parsed endpoints. Sidebar tree shows APIs.

---

## Phase 4: User Story 2 — Create a Scoped Access Token (P1)

**Goal**: Users can create named access tokens scoped to specific endpoints with parameter constraints. Token shown once with copy button.

**Independent Test**: Create a token under a registered API, verify show-once modal displays copyable token, verify endpoint permissions and param constraints are visible in token detail.

### Tests for User Story 2

- [x] T050 [P] [US2] Unit test for token generation in `tests/unit/token-format.test.ts`: verify `sdp_` prefix, base62 charset, 40 char total length, CRC32 checksum validation, SHA-256 hashing produces consistent hex output
- [x] T051 [P] [US2] Unit test for glob matching in `tests/unit/glob.test.ts`: `*` matches any, `?` matches single char, `my-org-*` matches `my-org-foo` but not `other-org`, empty patterns array means unconstrained, multiple patterns with any-match semantics
- [x] T052 [P] [US2] Integration test for `generate-token` Edge Function in `tests/integration/generate-token.test.ts`: create token, verify hash stored in DB (not raw), verify endpoint permissions created (all allowed by default), verify parameter constraints stored, verify raw token returned once
- [x] T053 [P] [US2] Playwright E2E test in `tests/e2e/token-management.spec.ts`: select API, click "Create Token", fill name + expiration, uncheck some endpoints, add param constraint chips, submit, verify show-once modal with copy button, dismiss, verify token appears in sidebar under API

### Implementation for User Story 2

- [x] T054 [US2] Implement `generate-token` Supabase Edge Function in `supabase/functions/generate-token/index.ts`: accept request per management-api.md contract, generate token via `crypto.getRandomValues()` + base62 + CRC32, compute SHA-256 hash, store in `access_tokens`, create `token_endpoint_permissions` (all allowed by default, with overrides), create `parameter_constraints`, return raw_token + metadata (show-once)
- [x] T055 [US2] Create `useTokens` TanStack Query hook in `src/hooks/useTokens.ts`: `useTokensForApi(apiId)` with permissions + constraints, `useTokenDetail(tokenId)`, mutations for status/expiration/delete
- [x] T056 [US2] Create `useEndpoints` TanStack Query hook in `src/hooks/useEndpoints.ts`: `useEndpointsForApi(apiId)` returning endpoints grouped by tag
- [x] T057 [P] [US2] Create `TokenShowOnce.tsx` modal component in `src/components/token/`: display raw token value in monospace, "Copy" button (Clipboard API) with "Copied!" confirmation, warning text "This token will not be shown again", "Done" dismiss button — styled as prominent dialog with terracotta accent
- [x] T058 [P] [US2] Create `EndpointPermissions.tsx` component in `src/components/token/`: list of endpoints grouped by OpenAPI tags, checkbox per endpoint (all checked by default), tag-level headers, expandable sections, bulk select/deselect per tag
- [x] T059 [P] [US2] Create `ParamConstraints.tsx` component in `src/components/token/`: appears below checked endpoints when expanded, tag-input field per parameter — type glob pattern, press Enter to add as removable chip, display chips as `[ my-org-* × ]` styled pills
- [x] T060 [US2] Create `CreateTokenForm.tsx` component in `src/components/token/`: inline form with token name input, expiration date picker (default 12 months from now), `EndpointPermissions` integration, `ParamConstraints` integration, "Create Token" button calling `generate-token` Edge Function, success triggers `TokenShowOnce` modal
- [x] T061 [US2] Create `TokenDetailView.tsx` component in `src/components/token/`: identity section (name, obscured prefix `sdp_aBcD...`, copy/regenerate buttons), lifecycle section (active/disabled toggle, expiration date picker, "Expire Now" button), endpoint permissions (reusing `EndpointPermissions` in edit mode), parameter constraints (reusing `ParamConstraints`), "Delete Token" button with confirmation
- [x] T062 [US2] Update `Sidebar.tsx` to render tokens as children under each API: token name + status indicator (green=active, yellow=expiring within 7 days, red=disabled/expired), clicking token navigates to `TokenDetailView`
- [x] T063 [US2] Wire token views in `DashboardPage.tsx`: sidebar token click → `TokenDetailView` in detail panel, "Create Token" button in `ApiDetailView` → `CreateTokenForm` in detail panel

### Playwright MCP Verification for User Story 2

- [ ] T064 [US2] **GATE — Playwright MCP verification**: With local dev servers running, use Playwright MCP to validate all spec.md US2 acceptance scenarios against the live application: (1) Create token with name, review endpoint list (all checked by default), uncheck endpoints, set param constraints as glob chips, set expiration → token created with copyable value (`sdp_...`); (2) View token in detail panel → shows identity (name, obscured value, copy/regenerate), lifecycle controls (active/disabled toggle, expiration picker, "Expire Now"), endpoint permissions with checkboxes, parameter constraint chips; (3) Type glob pattern and press Enter → appears as removable chip; (4) Verify unchecked endpoint is visually denied in the permissions list. Story MUST NOT be marked complete until all scenarios pass.

**Checkpoint**: User Story 2 complete — users can create scoped tokens, see show-once modal, manage endpoint permissions and param constraints.

---

## Phase 5: User Story 3 — Proxy Validates and Forwards Agent Requests (P1)

**Goal**: Netlify Edge Function proxy intercepts requests at `/proxy/{api_id}/*`, validates tokens, enforces permissions, swaps credentials, forwards to upstream, and logs all requests.

**Independent Test**: Make HTTP requests to proxy with valid/invalid tokens against a mock upstream (Prism), verify auth swap, permission enforcement, and logging.

### Tests for User Story 3

- [x] T065 [P] [US3] Unit test for permission checking in `tests/unit/permission-check.test.ts`: endpoint allowed/denied, parameter constraint glob matching, expired token rejection, disabled token rejection, unknown endpoint rejection
- [x] T066 [P] [US3] Integration test for proxy in `tests/integration/proxy.test.ts`: start Mockttp as mock upstream, start `netlify dev`, seed DB with API + token + permissions, test auth header swapping (mock upstream receives real credential, not sdp_ token), test 403 for blocked endpoint with reason, test 403 for param constraint violation, test 401 for expired/disabled token, test 502 for upstream timeout, verify `request_logs` rows created for each request
- [x] T067 [P] [US3] Playwright APIRequestContext test in `tests/e2e/proxy-behavior.spec.ts`: use Playwright's request API (no browser) to test proxy behavior: allowed request returns upstream response, blocked request returns 403 with JSON error body, verify `X-SDP-Error` header on proxy errors

### Implementation for User Story 3

- [x] T068 [US3] Implement proxy Edge Function in `netlify/edge-functions/proxy.ts` with config `path: "/proxy/*"`: extract `api_id` and `upstream_path` from URL, extract Bearer token from Authorization header, compute SHA-256 hash via `crypto.subtle.digest()`, query Supabase (service_role) for token + API registration + permissions + constraints in a single join query
- [x] T069 [US3] Add token validation logic to proxy in `netlify/edge-functions/proxy.ts`: check token found, check status = active, check `expires_at > now()`, return 401 with appropriate error per proxy-api.md contract
- [x] T070 [US3] Add endpoint permission checking to proxy in `netlify/edge-functions/proxy.ts`: match incoming method + path against `parsed_endpoints` using URL pattern matching for path templates (e.g., `/repos/{owner}/{repo}` matches `/repos/my-org/my-repo`), check `is_allowed` flag, return 403 per contract if denied
- [x] T071 [US3] Add parameter constraint checking to proxy in `netlify/edge-functions/proxy.ts`: extract path parameters from URL template match and query parameters from URL, check each constrained parameter against `allowed_patterns` using glob matching, return 403 with violation details per contract
- [x] T072 [US3] Add credential injection and forwarding to proxy in `netlify/edge-functions/proxy.ts`: retrieve decrypted credential from Vault via `get_api_credential()` RPC, build upstream URL (`base_url + "/" + upstream_path`), create new Request with swapped auth header (based on `auth_method`: bearer_token → Authorization header, api_key_header → custom header, api_key_query → query param), stream request body, forward via `fetch()`, stream response back to client with `X-SDP-Token` header added
- [x] T073 [US3] Add async request logging to proxy in `netlify/edge-functions/proxy.ts`: use `context.waitUntil()` to log to `request_logs` table after response is sent (non-blocking), log token_id, api_id, user_id, method, path, status_code, blocked flag, block_reason
- [x] T074 [US3] Add timeout and error handling to proxy in `netlify/edge-functions/proxy.ts`: 30-second fetch timeout via `AbortController`, return 502 per contract on timeout/network error, log upstream errors with reason

### Playwright MCP Verification for User Story 3

- [ ] T075 [US3] **GATE — Playwright MCP verification**: With local dev servers running and Prism mock upstream on port 4010 (`npx @stoplight/prism-cli mock tests/fixtures/petstore-full.yaml -p 4010`), use Playwright MCP (APIRequestContext) to validate all spec.md US3 acceptance scenarios against the live proxy: (1) Send request with valid active token + allowed endpoint → proxy returns upstream response (verify real credential was swapped in); (2) Send request with valid token + disallowed endpoint → 403 with JSON body indicating endpoint not permitted; (3) Send request with param value violating glob constraint → 403 with param constraint violation reason; (4) Send request with expired/disabled token → 401 with clear message; (5) Verify all requests (allowed + rejected) appear in `request_logs` with correct timestamp, token name, method, path, status, and block reason. Story MUST NOT be marked complete until all scenarios pass.

**Checkpoint**: User Story 3 complete — proxy validates tokens, enforces permissions, swaps credentials, forwards requests, logs everything.

---

## Phase 6: User Story 4 — Manage Token Lifecycle (P2)

**Goal**: Users can toggle tokens active/disabled, change expiration dates, regenerate token values, and delete tokens — with changes taking effect on the proxy immediately.

**Independent Test**: Toggle a token's status, verify proxy immediately rejects/allows requests. Regenerate a token, verify old value stops working and new value works.

### Tests for User Story 4

- [ ] T076 [P] [US4] Integration test for token lifecycle in `tests/integration/token-lifecycle.test.ts`: create token, make successful proxy request, disable token → proxy returns 401, re-enable → proxy returns 200, regenerate → old token 401 + new token 200, set past expiration → proxy returns 401, delete → proxy returns 401
- [ ] T077 [P] [US4] Playwright E2E test in `tests/e2e/token-management.spec.ts` (extend existing): toggle active/disabled via UI, change expiration date, click regenerate → verify new show-once modal, click delete → verify confirmation dialog → verify token removed from sidebar

### Implementation for User Story 4

- [ ] T078 [US4] Implement `regenerate-token` Supabase Edge Function in `supabase/functions/regenerate-token/index.ts`: accept `token_id`, verify ownership, generate new token value (same format: sdp_ + base62 + CRC32), compute new SHA-256 hash, update `token_hash` and `token_prefix` in `access_tokens`, return new raw_token (show-once)
- [ ] T079 [US4] Add token lifecycle mutations to `useTokens` hook in `src/hooks/useTokens.ts`: `useToggleTokenStatus(tokenId)` updating status to active/disabled, `useUpdateExpiration(tokenId, date)`, `useRegenerateToken(tokenId)` calling `regenerate-token` Edge Function, `useDeleteToken(tokenId)` with cascade
- [ ] T080 [US4] Wire lifecycle controls in `TokenDetailView.tsx` in `src/components/token/`: active/disabled toggle calling `useToggleTokenStatus`, inline expiration date picker calling `useUpdateExpiration`, "Regenerate" button calling `useRegenerateToken` → triggers `TokenShowOnce` modal with new value, "Expire Now" button setting expiration to now, "Delete Token" with confirmation dialog

### Playwright MCP Verification for User Story 4

- [ ] T081 [US4] **GATE — Playwright MCP verification**: With local dev servers and Prism mock upstream running, use Playwright MCP to validate all spec.md US4 acceptance scenarios against the live application: (1) Toggle active token to "Disabled" via UI → immediately make proxy request with that token → verify 401 rejected; (2) Change expiration date to a future date via UI → verify new expiration reflected in detail panel; (3) Click "Regenerate" → verify new show-once modal with new token value, copy new token, verify old token value returns 401 on proxy, verify new token value returns 200 on proxy; (4) Click "Delete Token" → confirm deletion → verify token removed from sidebar and proxy returns 401. Story MUST NOT be marked complete until all scenarios pass.

**Checkpoint**: User Story 4 complete — full token lifecycle management with immediate proxy effect.

---

## Phase 7: User Story 5 — View Activity Log and Debug Agent Issues (P2)

**Goal**: Users can see recent proxy activity per API and per token, with blocked calls showing inline reasons.

**Independent Test**: Make proxy requests (allowed + blocked), verify activity log shows all calls with correct status and block reasons.

### Tests for User Story 5

- [ ] T082 [P] [US5] Playwright E2E test in `tests/e2e/activity-log.spec.ts`: make several proxy requests via APIRequestContext (some allowed, some blocked), navigate to API view → verify "Recent Activity" section shows calls, navigate to token view → verify "Recent Calls" filtered to that token, verify blocked calls show inline reason (e.g., "Blocked: DELETE not permitted")

### Implementation for User Story 5

- [ ] T083 [US5] Create `useActivityLog` TanStack Query hook in `src/hooks/useActivityLog.ts`: `useApiActivityLog(apiId)` querying `request_logs` ordered by `created_at DESC` limit 50, `useTokenActivityLog(tokenId)` filtered by token_id, auto-refetch on interval (30 seconds)
- [ ] T084 [US5] Create `ActivityLog.tsx` component in `src/components/activity/`: table/list showing rows with: relative time ("2m ago"), token name, HTTP method badge (colored by method), path, status code badge (green 2xx, yellow 3xx, red 4xx/5xx), check/cross indicator, expandable block_reason for blocked requests styled as inline warning
- [ ] T085 [US5] Integrate activity log into `ApiDetailView.tsx`: add "Recent Activity" section at bottom of API detail showing `ActivityLog` filtered by api_id
- [ ] T086 [US5] Integrate activity log into `TokenDetailView.tsx`: add "Recent Calls" section at bottom of token detail showing `ActivityLog` filtered by token_id

### Playwright MCP Verification for User Story 5

- [ ] T087 [US5] **GATE — Playwright MCP verification**: With local dev servers and Prism mock upstream running, use Playwright MCP to validate all spec.md US5 acceptance scenarios against the live application: (1) Make several proxy requests (allowed + blocked) via APIRequestContext, then select the API in sidebar → verify "Recent Activity" section shows the most recent calls across all tokens for that API; (2) Select a specific token → verify "Recent Calls" section is filtered to that token only, showing time ago, method, path, status code, and check/cross indicator; (3) Verify a blocked request shows the block reason inline (e.g., "Blocked: DELETE not permitted"). Story MUST NOT be marked complete until all scenarios pass.

**Checkpoint**: User Story 5 complete — users can view and debug proxy activity.

---

## Phase 8: User Story 6 — Share a Token Configuration Template (P3)

**Goal**: Users can generate a shareable link that encodes their token's endpoint permissions and parameter constraints. Recipients can create their own token from the shared configuration without sharing credentials.

**Independent Test**: Generate a share link, open in another session, verify pre-filled form with correct permissions, fill in own credential, create token successfully.

### Tests for User Story 6

- [ ] T088 [P] [US6] Unit test for share link encoding/decoding in `tests/unit/share-link.test.ts`: encode endpoint permissions + param constraints to URL-safe base64url string, decode back to original structure, verify no credential data is included, test with large permission sets (50+ endpoints), verify URL length stays reasonable
- [ ] T089 [P] [US6] Playwright E2E test in `tests/e2e/share-link.spec.ts`: navigate to token detail, click "Share Link", verify URL generated and copied, open share URL in new context, verify pre-filled endpoint permissions match original, verify credential fields are empty, fill in own credential + name + base URL, create token, verify new token created with same permissions

### Implementation for User Story 6

- [ ] T090 [US6] Implement share link encoding/decoding in `src/lib/share-link.ts`: `encodeShareLink(permissions, constraints, specReference)` → base64url-encoded JSON payload in URL fragment, `decodeShareLink(url)` → parsed permissions and constraints object, compress payload to keep URLs reasonable length
- [ ] T091 [P] [US6] Create `ShareLinkButton.tsx` component in `src/components/share/`: button in token detail view, onClick generates share URL via `encodeShareLink()`, copies to clipboard with "Copied!" confirmation, displays shortened URL preview inline
- [ ] T092 [US6] Create `ShareLandingPage.tsx` component in `src/components/share/`: decode URL fragment via `decodeShareLink()`, display pre-filled `CreateTokenForm` with endpoint permissions and param constraints pre-selected, empty fields for: API name, base URL, auth method, credential, "Create Token" button that first creates API registration (via `parse-spec`) then creates token (via `generate-token`) — requires user to upload their own OpenAPI spec
- [ ] T093 [US6] Create `SharePage.tsx` route in `src/pages/`: mount `ShareLandingPage` at `/share` path, handle auth guard (must be logged in to use share link), add route to React Router in `App.tsx`
- [ ] T094 [US6] Integrate share button into `TokenDetailView.tsx`: add "Share Link" button at bottom of token detail (after activity log), position per ASCII mockup from spec thread

### Playwright MCP Verification for User Story 6

- [ ] T095 [US6] **GATE — Playwright MCP verification**: With local dev servers running, use Playwright MCP to validate all spec.md US6 acceptance scenarios against the live application: (1) Navigate to a configured token, click "Share Link" → verify a URL is generated that encodes the configuration entirely in the URL (no database lookup); (2) Open the share link URL in a new browser context → verify pre-filled token creation form showing the selected endpoints and parameter constraints, with empty fields for API name, base URL, and credential; (3) Fill in own credential and save → verify a new token is created with the same endpoint permissions and parameter constraints as the original. Story MUST NOT be marked complete until all scenarios pass.

**Checkpoint**: User Story 6 complete — share links work end-to-end.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Operational readiness, security hardening, edge cases

- [ ] T096 [P] Create `update-credential` Supabase Edge Function in `supabase/functions/update-credential/index.ts`: accept api_id + new credential, verify ownership, update in Vault via `update_api_credential()`, return success
- [ ] T097 [P] Create database migration for 30-day log purge in `supabase/migrations/009_log_purge_cron.sql`: enable `pg_cron` extension, schedule daily job `DELETE FROM request_logs WHERE created_at < now() - interval '30 days'`
- [ ] T098 [P] Handle spec re-upload in `ApiDetailView.tsx` and `parse-spec` Edge Function: when re-uploading a spec, delete old `parsed_endpoints`, re-parse and insert new ones, flag token permissions referencing removed endpoints as "endpoint no longer in spec"
- [ ] T099 [P] Add empty states to all views: no APIs yet (welcome + "Add your first API" CTA in detail panel), no tokens for API (CTA in token section), no activity logs yet (placeholder message)
- [ ] T100 [P] Add loading states: skeleton loaders in sidebar, detail panel, and activity log during TanStack Query loading
- [ ] T101 [P] Add error boundary and toast notifications: global error boundary in `App.tsx`, toast component for success/error feedback on mutations (token created, API deleted, etc.)
- [ ] T102 Security review: verify no raw tokens in logs or network responses (except show-once), verify Vault wrapper functions enforce user_id ownership, verify RLS policies block cross-user access, verify `service_role` key only used in Edge Functions (never in frontend)
- [ ] T103 Run quickstart.md validation: follow `specs/001-token-gate/quickstart.md` steps from scratch, verify local development environment works end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — first MVP increment
- **US2 (Phase 4)**: Depends on US1 (needs registered API to create tokens against)
- **US3 (Phase 5)**: Depends on US2 (needs tokens to validate in proxy)
- **US4 (Phase 6)**: Depends on US2 + US3 (lifecycle changes tested against proxy)
- **US5 (Phase 7)**: Depends on US3 (needs proxy logs to display)
- **US6 (Phase 8)**: Depends on US2 (needs token configuration to share)
- **Polish (Phase 9)**: Depends on all stories complete

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundation) → US1 (Import API) → US2 (Create Token) → US3 (Proxy)
                                                                    ↓                    ↓
                                                              US6 (Share)          US4 (Lifecycle)
                                                                                       ↓
                                                                                 US5 (Activity Log)
```

### Within Each User Story

- Tests written first (verify they fail before implementation)
- Backend (Edge Functions) before frontend (components)
- Data hooks before UI components
- Core components before integration/wiring
- **Playwright MCP verification LAST** — all implementation must pass before story is complete

### Parallel Opportunities

**Phase 1**: T003–T014, T016–T019 are all parallelizable (different files)
**Phase 2**: T028–T036, T038 are parallelizable (different files); migrations T020–T027 are sequential (numbered)
**Phase 3 (US1)**: T039–T041 tests parallel; T044–T045 components parallel; T049 is sequential gate
**Phase 4 (US2)**: T050–T053 tests parallel; T057–T059 components parallel; T064 is sequential gate
**Phase 5 (US3)**: T065–T067 tests parallel; T068–T074 are sequential (building proxy incrementally); T075 is sequential gate
**Phase 6 (US4)**: T076–T077 tests parallel; T081 is sequential gate
**Phase 7 (US5)**: Single test, sequential implementation; T087 is sequential gate
**Phase 8 (US6)**: T088–T089 tests parallel; T091 parallel with T090; T095 is sequential gate
**Phase 9**: T096–T101 all parallelizable

---

## Parallel Example: User Story 2

```bash
# Launch all tests in parallel:
Task: "Unit test for token generation in tests/unit/token-format.test.ts"
Task: "Unit test for glob matching in tests/unit/glob.test.ts"
Task: "Integration test for generate-token in tests/integration/generate-token.test.ts"
Task: "Playwright E2E in tests/e2e/token-management.spec.ts"

# Launch independent UI components in parallel:
Task: "Create TokenShowOnce.tsx in src/components/token/"
Task: "Create EndpointPermissions.tsx in src/components/token/"
Task: "Create ParamConstraints.tsx in src/components/token/"

# Sequential gate (after all implementation):
Task: "GATE — Playwright MCP verification for US2 acceptance scenarios"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Import API
4. **GATE T049**: Playwright MCP verifies all US1 acceptance scenarios pass
5. Complete Phase 4: US2 — Create Token
6. **GATE T064**: Playwright MCP verifies all US2 acceptance scenarios pass
7. Complete Phase 5: US3 — Proxy
8. **GATE T075**: Playwright MCP verifies all US3 acceptance scenarios pass
9. **MVP COMPLETE**: Core product functional — agents can use scoped tokens through the proxy

### Incremental Delivery

1. MVP (US1 + US2 + US3) → Deploy, start using with real agents
2. Add US4 (Lifecycle) → **GATE T081** → Token management without re-creation
3. Add US5 (Activity Log) → **GATE T087** → Debugging capability
4. Add US6 (Share) → **GATE T095** → Viral distribution of token configurations
5. Polish → Operational readiness

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story
- Constitution requires Playwright E2E via MCP for all UI stories (Principle VI)
- **GATE tasks** (T049, T064, T075, T081, T087, T095) enforce Principle VI: each user story MUST pass Playwright MCP verification against a running instance before it can be marked complete
- Token format is `sdp_` prefix per constitution, not `tg_` from early spec examples
- Proxy uses Netlify Edge Function (justified deviation from Principle IV)
- All credentials stored in Supabase Vault — never in plaintext columns
- Token values hashed with SHA-256 — never stored or logged in raw form
- Mock upstream (Prism + Mockttp) required for proxy integration tests
- Commit after each task or logical group
