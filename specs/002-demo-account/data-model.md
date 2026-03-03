# Data Model: Demo Account

**Feature Branch**: `002-demo-account`
**Date**: 2026-03-02

## Overview

The demo account feature introduces **no new tables**. It leverages the existing schema by creating a well-known user in `auth.users` and populating existing tables with seed data. The only new database artifact is a constant (the demo user's UUID).

## Entities

### Demo User (existing table: `auth.users`)

A single pre-created Supabase Auth user record.

| Attribute | Value | Notes |
|-----------|-------|-------|
| `id` | Well-known UUID (generated at creation time) | Stored as a constant in frontend + Edge Functions |
| `email` | `demo@simple-dimple-pat.local` | Not a real email; `.local` TLD prevents accidental delivery |
| `encrypted_password` | Bcrypt hash of a fixed password | Password embedded in frontend code (intentionally public) |
| `email_confirmed_at` | Set at creation time | Pre-confirmed so no email verification needed |
| `role` | `authenticated` | Same as all other users — no special role |

**Relationships**: Owns seed data in `api_registrations`, `access_tokens`, `request_logs`.

### Demo Seed: API Registration (existing table: `api_registrations`)

| Attribute | Value |
|-----------|-------|
| `user_id` | Demo user UUID |
| `name` | "Petstore API" |
| `base_url` | `https://petstore3.swagger.io/api/v3` |
| `auth_method` | `bearer_token` |
| `credential_vault_id` | Vault secret with dummy value `demo-petstore-key` |
| `spec_raw` | Petstore OpenAPI 3.0 spec (embedded in Edge Function) |
| `spec_version` | `3.0.3` |

### Demo Seed: Parsed Endpoints (existing table: `parsed_endpoints`)

Extracted from the Petstore spec. Representative subset (~8-10 endpoints):

| method | path_template | tag | summary |
|--------|---------------|-----|---------|
| GET | /pet/{petId} | pet | Find pet by ID |
| GET | /pet/findByStatus | pet | Finds pets by status |
| POST | /pet | pet | Add a new pet |
| PUT | /pet | pet | Update an existing pet |
| DELETE | /pet/{petId} | pet | Deletes a pet |
| GET | /store/inventory | store | Returns pet inventories |
| POST | /store/order | store | Place an order |
| GET | /user/{username} | user | Get user by name |

### Demo Seed: Access Token (existing table: `access_tokens`)

| Attribute | Value |
|-----------|-------|
| `api_id` | Demo API registration UUID |
| `user_id` | Demo user UUID |
| `name` | "Demo Token" |
| `token_hash` | SHA-256 of a pre-generated `sdp_...` token |
| `token_prefix` | First 8 chars of the token |
| `status` | `active` |
| `expires_at` | 1 year from seed creation |

**Permissions**: All demo endpoints allowed. One parameter constraint on `GET /pet/findByStatus` restricting `status` to `["available", "pending"]` — demonstrates the constraint feature.

### Demo Seed: Activity Logs (existing table: `request_logs`)

5-10 pre-created log entries showing:
- Successful requests (various endpoints, `blocked: false`)
- Blocked request (endpoint not allowed, `blocked: true`, `block_reason: "Endpoint not permitted"`)
- Blocked request (parameter constraint violation, `blocked: true`, `block_reason: "Parameter 'status' value 'sold' not allowed"`)

## State Transitions

No new state transitions. The demo account uses existing token states (`active`, `disabled`, `expired`) and existing request log patterns.

## Data Lifecycle

```
[Reset Demo clicked] or [Initial provisioning]
  → Delete: request_logs (user_id = demo)
  → Delete: access_tokens (user_id = demo) → cascades to permissions, constraints
  → Delete: api_registrations (user_id = demo) → cascades to parsed_endpoints
  → Delete: vault secrets linked to demo APIs
  → Insert: api_registrations + vault secret
  → Insert: parsed_endpoints
  → Insert: access_tokens + permissions + constraints
  → Insert: request_logs (sample entries)
```

## Constants

```typescript
// Shared between frontend and Edge Functions
export const DEMO_USER_ID = "<uuid-generated-at-creation>";
export const DEMO_USER_EMAIL = "demo@simple-dimple-pat.local";
export const DEMO_USER_PASSWORD = "demo-account-public-password";
```

These are intentionally public — the demo account is shared by design.
