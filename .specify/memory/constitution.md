<!-- Sync Impact Report
Version change: 1.0.0 → 1.1.0
Modified principles: None
Added principles:
  - VI. UI Verification via Playwright
Added sections: None
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md: ✅ No changes needed (Constitution Check is generic)
  - .specify/templates/spec-template.md: ✅ No changes needed (structure is generic)
  - .specify/templates/tasks-template.md: ✅ No changes needed (phase structure is generic)
Follow-up TODOs: None
-->

# Simple Dimple PAT Constitution

## Core Principles

### I. Security-First

PAT tokens are credentials. Every design decision involving token
storage, transmission, or validation MUST default to the most
secure option.

- Tokens MUST be stored as SHA-256 hashes only; plaintext MUST
  never be persisted or logged
- Token generation MUST use cryptographically secure randomness
  (`crypto.getRandomValues()` or equivalent), never `Math.random()`
- The raw token MUST be displayed exactly once at creation time
  and MUST NOT be retrievable afterward
- The `check-pat` response MUST NOT leak information about other
  users' tokens or the existence of unrelated PATs
- Supabase service role keys MUST only be used inside Edge
  Functions, never exposed to the frontend
- Row Level Security (RLS) MUST be enabled on every table with
  policies enforcing user/project isolation

### II. Self-Serve by Default

The platform exists so service users can manage their own access
without requiring intervention from the service developer.

- Service users MUST be able to join a project, create PATs,
  scope them, revoke them, and monitor usage without admin action
- The join mechanism MUST be a shareable link — no manual
  invitation or approval workflow for v1
- PAT creation MUST allow fine-grained scope selection
  (endpoint + field level) driven by the UI, not manual config
- Service developers MUST be able to publish an API by uploading
  an OpenAPI spec without writing code

### III. OpenAPI-Driven Permissions

The uploaded OpenAPI specification is the single source of truth
for what endpoints and fields exist. All permission scoping
derives from it.

- Endpoints and fields MUST be extracted server-side from the
  OpenAPI spec by the `parse-spec` Edge Function
- Client-side parsing is permitted only for validation feedback;
  the server-parsed result is authoritative
- Fields MUST use dot-notation with a direction prefix:
  `request.field` or `response.field`
- When a spec is re-uploaded, removed endpoints MUST cascade
  delete their associated `pat_scopes` entries
- The platform MUST support OpenAPI 3.0.x and 3.1.x

### IV. Supabase-Native

Use Supabase primitives (Auth, Postgres, RLS, Edge Functions) as
the primary building blocks. Minimize custom infrastructure.

- Authentication MUST use Supabase Auth with Google OAuth
  (scopes: `openid`, `email`, `profile`)
- Authorization MUST be enforced via Postgres RLS policies, not
  application-level checks in the frontend
- Operations that require elevated access (token generation, spec
  parsing, PAT verification) MUST be Supabase Edge Functions
  using the service role
- Simple CRUD (projects, PAT listing, revocation) SHOULD use
  direct Supabase client calls protected by RLS
- Frontend state MUST be managed via TanStack Query backed by
  Supabase — no separate client-side state store

### V. Simplicity & Incremental Delivery

Build the minimum that works. Ship each user story independently.
Defer features until they are needed.

- Each implementation phase MUST produce a working, testable
  increment
- Do not add token rotation, invite codes, Redis caching, or
  multi-provider auth until v1 is shipped and the need is proven
- Prefer a single join query over multiple round-trips; prefer
  in-memory caching over external cache infrastructure
- Code MUST NOT be added speculatively — every file and function
  MUST serve a current requirement

### VI. UI Verification via Playwright

Every UI feature MUST be validated against its stated user intents
using Playwright MCP before the feature is considered complete.

- Each user story that involves UI interaction MUST have a
  corresponding Playwright test verifying the user can accomplish
  the stated intent end-to-end
- Playwright tests MUST be run via the Playwright MCP tool, not
  just as standalone test scripts
- Tests MUST cover the primary acceptance scenarios defined in
  the feature specification (the Given/When/Then flows)
- A UI feature MUST NOT be marked complete until its Playwright
  tests pass against a running instance of the application
- Playwright tests SHOULD focus on user-visible behavior (can the
  user accomplish the task?), not implementation details (specific
  CSS classes, internal state)

## Tech Stack Constraints

- **Frontend**: Vite + React 18 + TypeScript
- **UI**: Tailwind CSS + shadcn/ui (Radix-based components)
- **Backend**: Supabase (Postgres + Edge Functions in Deno)
- **Auth**: Google OAuth via Supabase Auth
- **Token format**: `sdp_<base62(32 random bytes)>`, opaque,
  not JWT
- **OpenAPI parsing**: `@readme/openapi-parser` (client-side
  validation), server-side extraction in Edge Function
- **State management**: TanStack Query (React Query) only
- **UI testing**: Playwright via MCP for end-to-end user intent
  verification

## Development Workflow

- Database changes MUST be captured as numbered Supabase
  migrations in `supabase/migrations/`
- Shared TypeScript types MUST live in `shared/types.ts` and be
  imported by both frontend and Edge Functions
- Edge Functions MUST share utilities via
  `supabase/functions/_shared/`
- Features MUST be developed in user-story order (P1 before P2)
  and each story MUST be independently testable before moving on
- RLS policies MUST be verified manually after each migration
  by testing as different user roles

## Governance

This constitution establishes the non-negotiable rules for the
Simple Dimple PAT project. All implementation decisions, code
reviews, and architectural choices MUST comply with these
principles.

- **Amendments**: Any change to this constitution MUST be
  documented with a version bump and rationale
- **Versioning**: MAJOR for principle removal/redefinition, MINOR
  for new principles or material expansions, PATCH for
  clarifications and wording fixes
- **Compliance**: Each feature spec and implementation plan MUST
  include a Constitution Check confirming alignment with these
  principles

**Version**: 1.1.0 | **Ratified**: 2026-02-24 | **Last Amended**: 2026-02-26
