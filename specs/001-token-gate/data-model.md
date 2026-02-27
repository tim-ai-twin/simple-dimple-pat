# Data Model: Simple Dimple PAT

**Branch**: `001-token-gate` | **Date**: 2026-02-26

## Entity Relationship Overview

```
User (Supabase Auth)
 └── has many → API Registration
                 ├── has one → OpenAPI Spec (raw + parsed)
                 ├── has one → Upstream Credential (in Vault)
                 ├── has many → Parsed Endpoint
                 └── has many → Access Token
                                 ├── has many → Token Endpoint Permission
                                 │              └── has many → Parameter Constraint
                                 └── has many → Request Log
```

## Tables

### `api_registrations`

Stores user-registered external APIs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique identifier |
| `user_id` | `uuid` | FK → `auth.users(id)`, NOT NULL | Owner (RLS filter) |
| `name` | `text` | NOT NULL | User-given name (e.g., "GitHub API") |
| `base_url` | `text` | NOT NULL | Upstream base URL (e.g., `https://api.github.com`) |
| `auth_method` | `text` | NOT NULL, CHECK IN ('bearer_token', 'api_key_header', 'api_key_query') | How to inject the credential |
| `auth_header_name` | `text` | NULL | Header name for API Key method (e.g., `X-API-Key`); NULL for bearer |
| `auth_query_param` | `text` | NULL | Query param name for API Key query method; NULL otherwise |
| `credential_vault_id` | `uuid` | NOT NULL | Reference to `vault.secrets` entry storing the encrypted credential |
| `spec_raw` | `text` | NOT NULL | Raw OpenAPI spec content (YAML/JSON as uploaded) |
| `spec_version` | `text` | NULL | Detected OpenAPI version (e.g., "3.0.1", "3.1.0") |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | Last update timestamp |

**RLS Policy**: `user_id = auth.uid()` for all operations.

---

### `parsed_endpoints`

Stores endpoints extracted from an OpenAPI spec by the `parse-spec` Edge Function.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique identifier |
| `api_id` | `uuid` | FK → `api_registrations(id)` ON DELETE CASCADE, NOT NULL | Parent API |
| `operation_id` | `text` | NULL | OpenAPI operationId (may be absent) |
| `method` | `text` | NOT NULL, CHECK IN ('GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS') | HTTP method |
| `path_template` | `text` | NOT NULL | Path with params (e.g., `/repos/{owner}/{repo}`) |
| `tag` | `text` | NULL | OpenAPI tag for grouping (e.g., "Repositories") |
| `summary` | `text` | NULL | OpenAPI summary for display |
| `parameters` | `jsonb` | NOT NULL, default `'[]'` | Array of `{name, in, type, required, enum}` |
| `display_order` | `integer` | NOT NULL, default `0` | Order within tag group |

**Unique constraint**: `(api_id, method, path_template)`
**RLS Policy**: Via join to `api_registrations.user_id = auth.uid()`

---

### `access_tokens`

Stores scoped tokens issued to AI agents. The token value is stored as a SHA-256 hash only.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique identifier |
| `api_id` | `uuid` | FK → `api_registrations(id)` ON DELETE CASCADE, NOT NULL | Parent API |
| `user_id` | `uuid` | FK → `auth.users(id)`, NOT NULL | Owner (RLS filter) |
| `name` | `text` | NOT NULL | User-given name (e.g., "cursor-agent") |
| `token_hash` | `text` | NOT NULL, UNIQUE | SHA-256 hash of the raw token (hex-encoded) |
| `token_prefix` | `text` | NOT NULL | First 8 chars of the token for display (e.g., `sdp_aBcD`) |
| `status` | `text` | NOT NULL, default `'active'`, CHECK IN ('active', 'disabled', 'expired') | Current state |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Creation timestamp |
| `expires_at` | `timestamptz` | NOT NULL | Expiration timestamp (default: created_at + 12 months) |

**Index**: `token_hash` (unique, used for proxy lookup)
**RLS Policy**: `user_id = auth.uid()` for all operations.

**State transitions**:
- `active` → `disabled` (user toggle)
- `disabled` → `active` (user toggle)
- `active` → `expired` (system, when `now() > expires_at`)
- `disabled` → `expired` (system, when `now() > expires_at`)
- Any state → deleted (hard delete on user action)

---

### `token_endpoint_permissions`

Maps which endpoints each token is allowed to access. All-allowed by default on token creation; user unchecks to deny.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique identifier |
| `token_id` | `uuid` | FK → `access_tokens(id)` ON DELETE CASCADE, NOT NULL | Parent token |
| `endpoint_id` | `uuid` | FK → `parsed_endpoints(id)` ON DELETE CASCADE, NOT NULL | Permitted endpoint |
| `is_allowed` | `boolean` | NOT NULL, default `true` | Whether this endpoint is permitted |

**Unique constraint**: `(token_id, endpoint_id)`
**RLS Policy**: Via join to `access_tokens.user_id = auth.uid()`

---

### `parameter_constraints`

Stores glob-pattern restrictions on specific parameters of permitted endpoints.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique identifier |
| `permission_id` | `uuid` | FK → `token_endpoint_permissions(id)` ON DELETE CASCADE, NOT NULL | Parent permission |
| `param_name` | `text` | NOT NULL | Parameter name (e.g., "owner", "repo") |
| `allowed_patterns` | `text[]` | NOT NULL | Array of glob patterns (e.g., `{'my-org-*', 'other-org'}`) |

**Unique constraint**: `(permission_id, param_name)`
**RLS Policy**: Via join chain to `access_tokens.user_id = auth.uid()`

---

### `request_logs`

Audit log of all proxy requests. Retained for 30 days, then purged.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Unique identifier |
| `token_id` | `uuid` | FK → `access_tokens(id)` ON DELETE SET NULL, NULL | Token used (NULL if token not found) |
| `api_id` | `uuid` | FK → `api_registrations(id)` ON DELETE SET NULL, NULL | Target API |
| `user_id` | `uuid` | FK → `auth.users(id)`, NOT NULL | Owner for RLS |
| `method` | `text` | NOT NULL | HTTP method |
| `path` | `text` | NOT NULL | Request path |
| `status_code` | `integer` | NULL | Response status (NULL if upstream unreachable) |
| `blocked` | `boolean` | NOT NULL, default `false` | Whether the request was rejected by the proxy |
| `block_reason` | `text` | NULL | Reason for rejection (e.g., "endpoint not permitted") |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | Request timestamp |

**Index**: `(api_id, created_at DESC)` for API-level activity views
**Index**: `(token_id, created_at DESC)` for token-level activity views
**Index**: `(created_at)` for 30-day purge job
**RLS Policy**: `user_id = auth.uid()` for SELECT only. INSERT via service_role in proxy Edge Function.

**Purge**: `pg_cron` job or Supabase scheduled function: `DELETE FROM request_logs WHERE created_at < now() - interval '30 days'`

---

## Vault Usage

Upstream API credentials are stored in Supabase Vault, not in `api_registrations` directly.

**Wrapper functions** (SECURITY DEFINER, called via RPC from Edge Functions):

- `store_api_credential(p_user_id uuid, p_name text, p_value text) → uuid` — Creates a vault secret, returns its ID
- `get_api_credential(p_user_id uuid, p_vault_id uuid) → text` — Returns decrypted credential (only if user owns the API registration referencing this vault_id)
- `update_api_credential(p_user_id uuid, p_vault_id uuid, p_new_value text)` — Updates the vault secret
- `delete_api_credential(p_vault_id uuid)` — Deletes the vault secret (called when API registration is deleted)

These functions enforce per-user isolation: a user can only access credentials for their own API registrations.
