# Implementation Plan: TokenGate

**Branch**: `001-token-gate` | **Date**: 2026-02-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-token-gate/spec.md`

## Summary

Build TokenGate — a personal token management system for AI agents — deployed on Netlify (frontend + proxy Edge Function) and Supabase (Auth, Postgres, Edge Functions for token generation and spec parsing). The proxy intercepts requests at `/proxy/{api_id}/*`, validates scoped tokens (SHA-256 hashed, stored in Postgres), enforces endpoint/parameter permissions derived from uploaded OpenAPI specs, then forwards with real credentials (stored in Supabase Vault). Management UI uses a master-detail layout with warm terracotta/cream theme.

## Technical Context

**Language/Version**: TypeScript 5.x (Vite frontend), Deno (Edge Functions)
**Primary Dependencies**: React 18, Tailwind CSS, shadcn/ui (Radix), TanStack Query, `@supabase/supabase-js`, `@readme/openapi-parser`
**Storage**: Supabase Postgres (RLS-enforced) + Supabase Vault (credential encryption)
**Testing**: Vitest (unit), Playwright (E2E via MCP), Prism (mock upstream), Mockttp (header inspection), Deno test (Edge Function unit tests)
**Target Platform**: Web (desktop-first), deployed on Netlify (static + Edge Functions) + Supabase (managed)
**Project Type**: Web application (SPA frontend + edge proxy + managed backend)
**Performance Goals**: <200ms added proxy latency, <5s token lifecycle propagation
**Constraints**: 50ms CPU per Edge Function invocation (Netlify), 40s response header timeout, 512MB memory
**Scale/Scope**: <20 users, <20 APIs per user, <3 tokens per API, 30-day log retention

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Security-First | PASS | SHA-256 token hashing, `crypto.getRandomValues()`, show-once pattern, RLS on all tables, service_role only in Edge Functions, Vault for credential storage |
| II. Self-Serve by Default | PASS | Users manage APIs/tokens without admin. Join via shareable link. OpenAPI-driven scope selection. |
| III. OpenAPI-Driven Permissions | PASS | Spec is source of truth. Server-side parsing in `parse-spec` Edge Function. Dot-notation fields. Cascade delete on spec re-upload. |
| IV. Supabase-Native | PARTIAL | Auth = Supabase Auth (Google OAuth). RLS = enforced. Edge Functions for token gen + spec parsing. **Proxy moved to Netlify Edge Function** (see Complexity Tracking). |
| V. Simplicity & Incremental Delivery | PASS | Each user story is independently testable. No premature features. |
| VI. UI Verification via Playwright | PASS | Playwright E2E tests for all UI stories. Playwright MCP for verification. |

### Post-Design Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Security-First | PASS | Token hash = SHA-256 (hex). Credentials in Vault with SECURITY DEFINER wrapper functions. Raw token shown once via modal. No plaintext in logs. RLS on every table. |
| II. Self-Serve by Default | PASS | Full self-service flow for API registration, token creation, scoping, revocation, monitoring. Share links for viral token templates. |
| III. OpenAPI-Driven Permissions | PASS | `parse-spec` extracts endpoints/params from spec. `parsed_endpoints` table stores normalized operations. Permissions reference endpoints by FK. Cascade delete on spec changes. |
| IV. Supabase-Native | PARTIAL | Justified deviation — proxy on Netlify Edge Function. All other operations use Supabase primitives. See Complexity Tracking. |
| V. Simplicity & Incremental Delivery | PASS | 6 user stories in priority order, each independently shippable. No Redis, no token rotation, no multi-provider auth in v1. |
| VI. UI Verification via Playwright | PASS | Test plan includes Playwright E2E for dashboard UI + API proxy via APIRequestContext. |

## Project Structure

### Documentation (this feature)

```text
specs/001-token-gate/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research decisions
├── data-model.md        # Phase 1 data model
├── quickstart.md        # Phase 1 local dev setup
├── checklists/
│   └── requirements.md  # Spec quality checklist
├── contracts/
│   ├── proxy-api.md     # Proxy Edge Function contract
│   └── management-api.md # Management API contract
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
netlify/
└── edge-functions/
    └── proxy.ts                    # Proxy Edge Function (token validation, forwarding)

src/                                # React frontend (Vite + TypeScript)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx             # Collapsible tree (APIs → tokens)
│   │   ├── DetailPanel.tsx         # Context-sensitive right panel
│   │   └── Header.tsx              # Top bar with user info
│   ├── api/
│   │   ├── ApiDetailView.tsx       # API overview + token table + activity
│   │   ├── AddApiForm.tsx          # New API registration form
│   │   └── SpecUpload.tsx          # OpenAPI spec file upload + validation
│   ├── token/
│   │   ├── TokenDetailView.tsx     # Token detail: identity, permissions, log
│   │   ├── CreateTokenForm.tsx     # New token form (inline, not wizard)
│   │   ├── EndpointPermissions.tsx # Checkbox list grouped by tags
│   │   ├── ParamConstraints.tsx    # Glob pattern chip input
│   │   └── TokenShowOnce.tsx       # Show-once modal with copy button
│   ├── activity/
│   │   └── ActivityLog.tsx         # Request log table with status/block reason
│   ├── share/
│   │   ├── ShareLinkButton.tsx     # Generate + copy share URL
│   │   └── ShareLandingPage.tsx    # Pre-filled form from share link
│   └── ui/                         # shadcn/ui components (themed terracotta/cream)
├── lib/
│   ├── supabase.ts                 # Supabase client initialization
│   ├── glob.ts                     # Glob pattern matching utility
│   ├── share-link.ts               # Share URL encoding/decoding (base64url)
│   └── token-format.ts             # CRC32 validation for sdp_ tokens
├── hooks/
│   ├── useApis.ts                  # TanStack Query: API registrations
│   ├── useTokens.ts               # TanStack Query: access tokens
│   ├── useEndpoints.ts            # TanStack Query: parsed endpoints
│   └── useActivityLog.ts          # TanStack Query: request logs
├── pages/
│   ├── DashboardPage.tsx           # Main master-detail layout
│   └── SharePage.tsx               # Share link landing page
├── theme/
│   └── tokens.ts                   # Design tokens (terracotta, cream, typography)
└── App.tsx                         # Router + auth guard

supabase/
├── migrations/
│   ├── 001_create_api_registrations.sql
│   ├── 002_create_parsed_endpoints.sql
│   ├── 003_create_access_tokens.sql
│   ├── 004_create_token_endpoint_permissions.sql
│   ├── 005_create_parameter_constraints.sql
│   ├── 006_create_request_logs.sql
│   ├── 007_vault_wrapper_functions.sql
│   └── 008_rls_policies.sql
├── functions/
│   ├── parse-spec/
│   │   └── index.ts                # OpenAPI parser + endpoint extraction
│   ├── generate-token/
│   │   └── index.ts                # Token creation with crypto.getRandomValues()
│   ├── regenerate-token/
│   │   └── index.ts                # Token value regeneration
│   ├── update-credential/
│   │   └── index.ts                # Re-encrypt credential in Vault
│   └── _shared/
│       ├── supabase-admin.ts       # Service role client
│       ├── token-utils.ts          # SHA-256 hashing, base62, CRC32
│       └── cors.ts                 # CORS headers for Edge Functions
└── seed.sql                        # Dev seed data (test user, sample API)

shared/
└── types.ts                        # Shared TypeScript types (frontend + Edge Functions)

tests/
├── unit/
│   ├── glob.test.ts                # Glob pattern matching tests
│   ├── token-format.test.ts        # Token generation + CRC32 validation
│   ├── share-link.test.ts          # URL encoding/decoding
│   └── permission-check.test.ts    # Endpoint + param constraint logic
├── integration/
│   ├── proxy.test.ts               # Proxy E2E: auth swap, permissions, logging
│   ├── parse-spec.test.ts          # Spec upload + endpoint extraction
│   └── token-lifecycle.test.ts     # Create, disable, expire, regenerate, delete
├── e2e/
│   ├── api-registration.spec.ts    # Playwright: add API flow
│   ├── token-management.spec.ts    # Playwright: create/manage tokens
│   ├── proxy-behavior.spec.ts      # Playwright APIRequestContext: proxy tests
│   └── share-link.spec.ts          # Playwright: share link flow
└── fixtures/
    ├── petstore-minimal.yaml       # 2 endpoints, for unit tests
    ├── petstore-full.yaml          # Full Petstore, for integration tests
    └── tokengate-test-api.yaml     # Custom spec with param constraint scenarios
```

**Structure Decision**: Web application pattern — frontend (Vite/React in `src/`) with backend split between Netlify Edge Functions (`netlify/edge-functions/`) for the proxy and Supabase Edge Functions (`supabase/functions/`) for DB-heavy operations. Shared types in `shared/types.ts`. Tests in `tests/` organized by test type.

## Complexity Tracking

> **Constitution violation justification**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Proxy on Netlify Edge Function instead of Supabase Edge Function (Principle IV) | User explicitly requested Netlify Edge Functions. Proxy workload benefits from: path routing (`/proxy/*`), lower cold starts (~100ms vs ~400ms), response streaming, and co-location with the static frontend on Netlify CDN. | Supabase Edge Function for proxy would require a separate domain/URL for the proxy endpoint, has higher cold start latency, and doesn't support native path routing. The proxy code uses the same Deno runtime and is portable between platforms. |
