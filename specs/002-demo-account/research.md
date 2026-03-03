# Research: Demo Account

**Feature Branch**: `002-demo-account`
**Date**: 2026-03-02

## R1: Demo Account Authentication Mechanism

**Decision**: Use `supabase.auth.signInWithPassword()` with a pre-created demo user account.

**Rationale**: The demo account must be a real Supabase Auth user so that all existing RLS policies (which check `auth.uid()`) work without modification. Supabase Auth supports email/password authentication natively — we just need to enable the email provider in the project settings. The demo credentials (`demo@simple-dimple-pat.local` / a fixed password) are embedded in the frontend client code. Since the demo account is intentionally public and shared, exposing these credentials is by design, not a security concern.

**Alternatives considered**:
- **Admin-generated session token**: Would require a new Edge Function to mint a session. Over-engineered for a shared demo.
- **Anonymous auth (`supabase.auth.signInAnonymously()`)**: Creates a new anonymous user per session — would not share data across demo users, defeating the purpose.
- **Magic link**: Requires a real email inbox. Not suitable for instant access.

## R2: Demo User Provisioning

**Decision**: Create the demo user via a Supabase migration using `auth.users` insert or via `supabase.auth.admin.createUser()` in a one-time setup script. The demo user ID will be a well-known UUID stored as a constant in both the frontend and Edge Functions.

**Rationale**: A migration ensures the demo user exists in every environment (local, staging, production). The well-known UUID allows the frontend to check `session.user.id === DEMO_USER_ID` to conditionally show demo-specific UI (banner, reset button) without an extra API call.

**Alternatives considered**:
- **Create on first click**: Race conditions if multiple users click simultaneously. Also delays the first demo experience.
- **Environment variable**: Would work but a constant is simpler and the demo user ID is not sensitive.

## R3: Demo Seed Data Strategy

**Decision**: Seed data will be provisioned via a dedicated Supabase Edge Function (`reset-demo`) that can be called both for initial setup and for the "Reset Demo" button. The function will: (1) delete all data owned by the demo user, (2) re-insert the seed API registration, parsed endpoints, access token, and activity log entries.

**Rationale**: Using an Edge Function (with service_role) allows it to call vault functions (which are locked down from authenticated role), insert proper token hashes, and bypass RLS for cleanup. The same function serves both initial provisioning and user-triggered reset, avoiding duplication. A SQL migration for seed data would be fragile (runs once, can't be re-triggered).

**Alternatives considered**:
- **SQL migration with seed data**: Runs only once, can't be re-triggered for reset. Would need a separate mechanism for the reset button.
- **Frontend-driven seed**: Would require multiple API calls and can't access vault functions directly.
- **pg_cron scheduled reset**: Out of scope per spec. The Edge Function can be called by cron later if needed.

## R4: Demo Seed Data Content

**Decision**: The seed data will include a single API registration using the public Petstore API (`https://petstore3.swagger.io/api/v3`) with a subset of endpoints. This API is publicly accessible, well-known, and doesn't require real credentials — perfect for a demo. The seed will include:
- 1 API registration (Petstore v3) with a dummy credential in vault
- ~10 parsed endpoints (GET /pet/{petId}, GET /pet/findByStatus, POST /pet, etc.)
- 1 active access token with endpoint permissions
- 5-10 sample request log entries showing both allowed and blocked requests

**Rationale**: Petstore is the canonical OpenAPI example. Using a real, publicly accessible API means demo users could potentially make real proxy calls if they wanted to test the full flow, though the dummy credential would cause upstream 401s — which still demonstrates the proxy's behavior.

**Alternatives considered**:
- **Fictional API**: Would require inventing a spec. Petstore is universally recognized.
- **Multiple APIs**: Adds complexity without proportional demo value. One API with diverse endpoints is sufficient.

## R5: Reset Demo Implementation

**Decision**: A new `reset-demo` Edge Function that:
1. Verifies the caller is the demo user (via JWT)
2. Deletes all `request_logs` where `user_id = demo_user_id`
3. Deletes all `access_tokens` where `user_id = demo_user_id` (cascades to permissions/constraints)
4. Deletes all `api_registrations` where `user_id = demo_user_id` (cascades to endpoints)
5. Deletes vault secrets linked to demo API registrations
6. Re-inserts the seed data (same as initial provisioning)

**Rationale**: Deletion order respects FK constraints (logs → tokens → APIs → vault). Using the Edge Function with service_role ensures it can access vault and bypass RLS. The function is idempotent — calling it when data is already clean just re-inserts seed data.

**Alternatives considered**:
- **SQL function (RPC)**: Would work but can't easily store the seed spec content (large text) inline. Edge Function is more maintainable.
- **Soft reset (just reset flags)**: Doesn't clean up user-created data, leading to clutter over time.

## R6: Demo Mode Detection in Frontend

**Decision**: Export a constant `DEMO_USER_ID` from a shared config module. The frontend checks `session.user.id === DEMO_USER_ID` to determine demo mode. This controls: (1) the demo mode banner/badge, (2) the "Reset Demo" button visibility in the sidebar.

**Rationale**: Simple string comparison, no network call, works with the existing auth session. The demo user ID is not sensitive — it's a shared public account.

**Alternatives considered**:
- **Custom claim in JWT**: Would require modifying the Supabase Auth hook. Over-engineered.
- **Check email domain**: Fragile if the email format changes. Direct ID comparison is more robust.
- **Separate context/provider**: Unnecessary abstraction for a single boolean check.

## R7: Supabase Email Auth Provider

**Decision**: Enable the email auth provider in Supabase project settings to support `signInWithPassword()`. Disable email confirmations for the demo account (or globally for this prototype, since Google OAuth doesn't use email confirmation).

**Rationale**: Supabase requires the email provider to be enabled for password-based auth. Since this is a prototype with a "DO NOT INPUT REAL API KEYS" banner, disabling email confirmation is acceptable.

**Alternatives considered**:
- **Pre-confirmed user via admin API**: Create user with `email_confirm: true` via admin API, then email provider confirmation setting doesn't matter. This is the cleaner approach and what we'll actually do.
