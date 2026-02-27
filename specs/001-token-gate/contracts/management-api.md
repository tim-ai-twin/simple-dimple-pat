# Contract: Management API (Supabase Edge Functions + Direct Client)

The management UI communicates with Supabase via two patterns:
1. **Direct client calls** (RLS-protected) for CRUD operations
2. **Edge Function RPC calls** for operations requiring elevated access

---

## Direct Client Operations (via Supabase JS client + RLS)

These use the standard Supabase client with the user's session token. RLS policies enforce per-user isolation.

### API Registrations

| Operation | Method | Notes |
|-----------|--------|-------|
| List user's APIs | `supabase.from('api_registrations').select('*, parsed_endpoints(*), access_tokens(count)')` | RLS filters to current user |
| Get API detail | `supabase.from('api_registrations').select('*, parsed_endpoints(*)').eq('id', apiId)` | Includes parsed endpoints |
| Delete API | `supabase.from('api_registrations').delete().eq('id', apiId)` | Cascades to endpoints, tokens, permissions |
| Update API name/URL | `supabase.from('api_registrations').update({...}).eq('id', apiId)` | |

### Access Tokens

| Operation | Method | Notes |
|-----------|--------|-------|
| List tokens for API | `supabase.from('access_tokens').select('*, token_endpoint_permissions(*, parameter_constraints(*))').eq('api_id', apiId)` | |
| Update token status | `supabase.from('access_tokens').update({ status }).eq('id', tokenId)` | Toggle active/disabled |
| Update expiration | `supabase.from('access_tokens').update({ expires_at }).eq('id', tokenId)` | |
| Delete token | `supabase.from('access_tokens').delete().eq('id', tokenId)` | Cascades to permissions, constraints |

### Token Endpoint Permissions

| Operation | Method | Notes |
|-----------|--------|-------|
| Update permission | `supabase.from('token_endpoint_permissions').update({ is_allowed }).eq('id', permId)` | Toggle endpoint access |
| Batch update | `supabase.from('token_endpoint_permissions').upsert([...])` | Bulk permission changes |

### Parameter Constraints

| Operation | Method | Notes |
|-----------|--------|-------|
| Set constraints | `supabase.from('parameter_constraints').upsert({ permission_id, param_name, allowed_patterns })` | |
| Remove constraint | `supabase.from('parameter_constraints').delete().eq('id', constraintId)` | |

### Request Logs

| Operation | Method | Notes |
|-----------|--------|-------|
| List by API | `supabase.from('request_logs').select('*').eq('api_id', apiId).order('created_at', { ascending: false }).limit(50)` | Recent activity |
| List by token | `supabase.from('request_logs').select('*').eq('token_id', tokenId).order('created_at', { ascending: false }).limit(50)` | Token-specific log |

---

## Edge Function Operations (Supabase Edge Functions, service_role)

These require elevated access and are called via `supabase.functions.invoke()`.

### `parse-spec`

Parses an uploaded OpenAPI spec and stores the API registration + parsed endpoints.

**Request**:
```json
{
  "name": "GitHub API",
  "base_url": "https://api.github.com",
  "auth_method": "bearer_token",
  "auth_header_name": null,
  "auth_query_param": null,
  "credential": "ghp_realtoken123",
  "spec_content": "openapi: 3.0.0\n..."
}
```

**Response** (success):
```json
{
  "api_id": "uuid",
  "endpoint_count": 47,
  "spec_version": "3.0.1",
  "tags": ["Repositories", "Issues", "Pull Requests"]
}
```

**Response** (error):
```json
{
  "error": "invalid_spec",
  "message": "OpenAPI spec validation failed: missing 'paths' property",
  "details": [...]
}
```

**Side effects**:
- Creates `api_registrations` row
- Stores credential in Supabase Vault via `store_api_credential()`
- Inserts parsed endpoints into `parsed_endpoints`

### `generate-token`

Creates a new access token with cryptographic randomness.

**Request**:
```json
{
  "api_id": "uuid",
  "name": "cursor-agent",
  "expires_at": "2027-02-26T00:00:00Z",
  "endpoint_permissions": [
    { "endpoint_id": "uuid", "is_allowed": true },
    { "endpoint_id": "uuid", "is_allowed": false }
  ],
  "parameter_constraints": [
    { "endpoint_id": "uuid", "param_name": "owner", "allowed_patterns": ["my-org-*"] }
  ]
}
```

**Response** (success):
```json
{
  "token_id": "uuid",
  "raw_token": "sdp_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345",
  "token_prefix": "sdp_aBcD",
  "name": "cursor-agent",
  "expires_at": "2027-02-26T00:00:00Z"
}
```

**CRITICAL**: `raw_token` is returned exactly once. It is never stored or retrievable again.

**Side effects**:
- Generates token via `crypto.getRandomValues()`
- Computes SHA-256 hash, stores hash in `access_tokens`
- Creates `token_endpoint_permissions` rows (all-allowed by default, with overrides from request)
- Creates `parameter_constraints` rows

### `regenerate-token`

Generates a new token value for an existing token. Old value stops working immediately.

**Request**:
```json
{
  "token_id": "uuid"
}
```

**Response**:
```json
{
  "raw_token": "sdp_NewTokenValueHere012345678901234",
  "token_prefix": "sdp_NewT"
}
```

**Side effects**:
- Generates new token, computes new hash
- Updates `token_hash` and `token_prefix` in `access_tokens`
- Old hash no longer matches any incoming requests

### `update-credential`

Updates the upstream API credential (re-encrypts in Vault).

**Request**:
```json
{
  "api_id": "uuid",
  "credential": "ghp_newrealtoken456"
}
```

**Response**:
```json
{
  "success": true
}
```
