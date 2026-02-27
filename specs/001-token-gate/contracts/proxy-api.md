# Contract: Proxy API (Netlify Edge Function)

**Base path**: `/proxy/{api_id}/{upstream_path}`

All requests to `/proxy/*` are intercepted by the Netlify Edge Function.

---

## Authentication

Every proxy request MUST include a Simple Dimple PAT token as a Bearer token:

```
Authorization: Bearer sdp_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345
```

The proxy:
1. Extracts the token from the `Authorization` header
2. Computes `SHA-256(token)` and looks up the hash in `access_tokens`
3. Validates: status = active, not expired
4. Checks endpoint permission and parameter constraints
5. If allowed: replaces the `Authorization` header with the real upstream credential and forwards
6. If rejected: returns an error response (never forwards to upstream)

---

## Request Routing

```
Client request:  POST /proxy/{api_id}/repos/my-org/my-repo/issues
                 Authorization: Bearer sdp_xxxxx
                 Content-Type: application/json
                 Body: {"title": "Bug report"}

Proxy forwards:  POST https://api.github.com/repos/my-org/my-repo/issues
                 Authorization: Bearer ghp_realtoken123
                 Content-Type: application/json
                 Body: {"title": "Bug report"}
```

- `{api_id}` is the UUID of the registered API
- `{upstream_path}` is everything after the api_id — forwarded as-is to `base_url + "/" + upstream_path`
- Query parameters are forwarded as-is
- Request headers are forwarded (except `Authorization` which is replaced, and `Host` which is set to upstream)
- Request body is streamed through without buffering

---

## Response Codes (Proxy-Generated)

These are returned by the proxy itself, not forwarded from upstream:

| Status | Condition | Body |
|--------|-----------|------|
| `401` | Missing or invalid Authorization header | `{"error": "unauthorized", "message": "Missing or invalid Bearer token"}` |
| `401` | Token not found in database | `{"error": "unauthorized", "message": "Token not recognized"}` |
| `401` | Token expired | `{"error": "token_expired", "message": "Token expired on {date}", "token_name": "{name}"}` |
| `401` | Token disabled | `{"error": "token_disabled", "message": "Token is disabled", "token_name": "{name}"}` |
| `403` | Endpoint not permitted | `{"error": "endpoint_denied", "message": "Endpoint {METHOD} {path} is not permitted for this token", "token_name": "{name}"}` |
| `403` | Parameter constraint violation | `{"error": "param_denied", "message": "Parameter '{param}' value '{value}' does not match allowed patterns", "token_name": "{name}", "allowed_patterns": [...]}` |
| `404` | API registration not found | `{"error": "api_not_found", "message": "No API registered with id {api_id}"}` |
| `404` | Endpoint not in spec | `{"error": "endpoint_unknown", "message": "Endpoint {METHOD} {path} is not defined in the API spec"}` |
| `502` | Upstream unreachable or timeout | `{"error": "upstream_error", "message": "Upstream API did not respond within timeout"}` |

All proxy-generated error responses include:
- `Content-Type: application/json`
- `X-SDP-Error: true` header (to distinguish from upstream errors)

---

## Response Forwarding

For successful requests, the proxy returns the upstream response as-is:
- Status code from upstream
- Headers from upstream (with `X-SDP-Token: {token_name}` added)
- Body streamed from upstream

---

## Logging

Every request (allowed or rejected) is logged asynchronously via `context.waitUntil()`:

```json
{
  "token_id": "uuid",
  "api_id": "uuid",
  "user_id": "uuid",
  "method": "POST",
  "path": "/repos/my-org/my-repo/issues",
  "status_code": 201,
  "blocked": false,
  "block_reason": null,
  "created_at": "2026-02-26T12:00:00Z"
}
```
