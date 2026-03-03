# Contract: reset-demo Edge Function

**Type**: Supabase Edge Function (Deno)
**Path**: `POST /functions/v1/reset-demo`
**Auth**: Requires valid JWT (demo user only)

## Request

**Headers**:
```
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

**Body**: None required (empty object `{}` or no body)

## Response

### 200 OK — Reset successful

```json
{
  "success": true,
  "api_id": "<uuid>",
  "endpoint_count": 8,
  "token_id": "<uuid>",
  "log_count": 7
}
```

### 401 Unauthorized — Missing or invalid JWT

```json
{
  "error": "unauthorized",
  "message": "Missing Authorization header"
}
```

### 403 Forbidden — Non-demo user attempted reset

```json
{
  "error": "forbidden",
  "message": "Reset is only available for the demo account"
}
```

### 500 Internal Server Error

```json
{
  "error": "internal_error",
  "message": "<description>"
}
```

## Behavior

1. Authenticate caller via `supabaseAdmin.auth.getUser(token)`
2. Verify `user.id === DEMO_USER_ID` — reject with 403 if not
3. Delete all demo data (logs → tokens → APIs → vault secrets)
4. Re-insert seed data (API registration + vault secret → endpoints → token + permissions + constraints → sample logs)
5. Return summary of what was provisioned

## Idempotency

Calling reset multiple times produces the same result. If no demo data exists (first call), only the insert phase runs. If data exists, it's deleted and re-created.
