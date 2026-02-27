# Research: Simple Dimple PAT Implementation

**Branch**: `001-token-gate` | **Date**: 2026-02-26

## Decision 1: Runtime Proxy — Netlify Edge Functions

**Decision**: Use Netlify Edge Functions for the proxy runtime (`/proxy/*` path).

**Rationale**:
- Near-zero cold starts (~50-200ms) vs Supabase Edge Functions (~400ms median cold)
- Full `fetch()` support for outbound requests; waiting time excluded from CPU limit
- Streaming support (ReadableStream, SSE) — critical for proxying AI API responses
- Path routing is first-class: `/proxy/*` → edge function, everything else → static site
- `crypto.subtle` available for SHA-256 token hashing
- Supabase client connectivity proven (via `@supabase/supabase-js` + esm.sh import map)
- Environment variables fully supported with Secrets Controller for sensitive values
- Netlify–Supabase integration auto-provisions `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_DATABASE_URL`

**Limits to respect**:
- 50ms CPU time per request (excludes fetch wait time — sufficient for proxy logic)
- 40-second response header timeout (upstream must begin responding within 40s)
- 512 MB memory per deployment (use streaming, avoid buffering large payloads)
- Request body can only be read once — must create new Request when forwarding

**Alternatives considered**:
- Supabase Edge Functions: Constitution-preferred, but higher cold start, no native path routing, less suited for HTTP proxying workload
- Always-on container (Hono/FastAPI): Lower latency but adds infrastructure complexity, operational burden, cost
- AWS Lambda/API Gateway: Cold start issues, more complex deployment

**Constitution deviation**: Principle IV (Supabase-Native) states PAT verification should be a Supabase Edge Function. The proxy is moved to Netlify Edge Functions because: (1) user explicitly requested it, (2) better performance characteristics for a proxy workload, (3) same Deno runtime so code is portable, (4) Supabase remains the data layer. Token generation and spec parsing stay as Supabase Edge Functions per constitution.

---

## Decision 2: Token Storage — SHA-256 Hash

**Decision**: Store Simple Dimple PAT-issued tokens as SHA-256 hashes. Never persist or log the raw token.

**Rationale**:
- Industry standard for high-entropy opaque tokens (GitHub uses SHA-256 for PATs)
- Tokens are CSPRNG-generated with 190+ bits of entropy (32 base62 chars) — brute-force is infeasible regardless of hash speed
- SHA-256 is fast (~microseconds) which matters for per-request authentication — bcrypt (~65ms) would destroy proxy performance
- No salt needed at this entropy level, but can add one as defense-in-depth

**Token format**: `sdp_<30 chars base62 random><6 chars base62 CRC32>` (per constitution: `sdp_` prefix, base62 charset)
- `sdp_` prefix enables secret scanning and identification
- CRC32 checksum enables offline typo detection without DB query
- 30 base62 random chars = ~178 bits of entropy (matches GitHub's approach)
- Total length: 40 chars (`sdp_` + 36 base62)

**Show-once pattern**:
1. Generate raw token via `crypto.getRandomValues()`
2. Compute `SHA-256(raw_token)`, store hash only
3. Return raw token to user exactly once in creation response
4. UI shows token in modal with copy button and warning
5. After dismissal, raw token is unrecoverable — user must regenerate if lost

**Alternatives considered**:
- bcrypt/argon2: Designed for low-entropy passwords, actively harmful for API token auth due to per-request latency
- Storing encrypted (reversible): Unnecessary — we only need to verify, not recover

---

## Decision 3: Upstream Credential Storage — Supabase Vault

**Decision**: Store users' upstream API credentials (their GitHub PATs, Anthropic keys, etc.) in Supabase Vault.

**Rationale**:
- Supabase Vault provides AEAD encryption (libsodium/pgsodium) with keys managed externally by Supabase
- Encryption key never appears in database or dumps
- SQL API: `vault.create_secret()`, `vault.update_secret()`, `vault.decrypted_secrets` view
- At project scale (<20 users, <60 credentials), Vault performance is not a concern
- Already part of Supabase — no additional infrastructure

**Per-user isolation approach**:
- Create wrapper SQL functions (`SECURITY DEFINER`) that filter by user_id
- Restrict direct access to `vault` schema from application roles
- Call wrapper functions via Supabase RPC from Edge Functions (using service_role key)
- Frontend never accesses vault directly

**Alternatives considered**:
- Application-level AES-256-GCM: More control but requires managing encryption keys in env vars, implementing key rotation
- External KMS (AWS KMS, Vault): Overkill for this scale, adds infrastructure
- pgcrypto: Key passes in SQL queries, may appear in logs — less secure

---

## Decision 4: Testing Infrastructure

**Decision**: Multi-layer test strategy with mock upstream APIs, local development stacks, and Playwright for E2E.

### Test Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Mock upstream (spec-driven) | **Prism** (`@stoplight/prism-cli`) | OpenAPI-compliant mock server; validates forwarded requests against spec |
| Mock upstream (programmatic) | **Mockttp** | In-test HTTP server for inspecting exact headers received (credential swap verification) |
| Unit tests | **Vitest** (shared logic) + **Deno test** (Edge Function code) | Token validation, glob matching, permission checking as pure functions |
| Integration tests | **Vitest + native fetch** | Full proxy flow against local dev servers |
| E2E tests (UI + API) | **Playwright** (via MCP per constitution) | Management UI and proxy behavior in one framework |
| Local Supabase | `supabase start` + `supabase functions serve` | Full local stack (Postgres, Auth, Edge Functions) |
| Local Netlify | `netlify dev` | Local Edge Function execution with env vars |
| Test fixtures | **Petstore OpenAPI specs** (minimal + full) | Standard API specs for testing spec parsing and proxy behavior |

### Test Flow for Proxy

```
Test Runner  →  Proxy (netlify dev)  →  Mock Upstream (Prism/Mockttp)
     |               |                        |
  sends request      validates PAT,           records what it received
  with sdp_ token    swaps to real cred,      returns canned response
                     forwards request
```

Key verifications:
1. Auth header swapping: mock upstream receives real credential, not the sdp_ token
2. Permission enforcement: blocked endpoints return 403 with reason
3. Parameter constraints: glob pattern violations return 403
4. Token lifecycle: disabled/expired tokens return 401
5. Logging: all requests appear in request_log table

### Test Fixtures

- **Minimal Petstore** (learn.openapis.org): 2 endpoints, for unit tests of spec parsing
- **Full Swagger Petstore**: Multiple tags, methods, path/query params, API Key auth — for integration tests
- **Custom SDP fixture**: Tailored spec with specific parameters for constraint testing

**Alternatives considered**:
- Nock: Cannot intercept Deno runtime outbound calls — only works in-process for Node.js
- Supertest: Designed for Express/Node, not Deno Edge Functions
- Real upstream APIs in tests: Flaky, rate-limited, not suitable for CI

---

## Decision 5: Netlify Edge Functions vs Supabase Edge Functions — Division of Responsibility

**Decision**: Split server-side logic between both platforms based on workload characteristics.

| Function | Platform | Reason |
|----------|----------|--------|
| **Proxy** (`/proxy/*`) | Netlify Edge Function | Path routing, low latency, streaming, per-request auth |
| **Token generation** (`generate-token`) | Supabase Edge Function | DB-heavy, needs service_role, constitution-aligned |
| **Spec parsing** (`parse-spec`) | Supabase Edge Function | DB-heavy, needs service_role, constitution-aligned |
| **CRUD** (APIs, tokens, logs) | Direct Supabase client + RLS | Simple operations, no elevated access needed |
| **Log cleanup** (30-day purge) | Supabase scheduled function or pg_cron | DB maintenance operation |

**Rationale**: The proxy is a high-frequency, latency-sensitive, stateless HTTP forwarder — best suited for edge. Token generation and spec parsing are infrequent, DB-heavy operations — best suited for Supabase Edge Functions that have direct, fast access to Postgres.
