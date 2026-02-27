# Quickstart: Simple Dimple PAT Local Development

**Branch**: `001-token-gate` | **Date**: 2026-02-26

## Prerequisites

- Node.js 20+
- Docker Desktop (for Supabase local stack)
- Supabase CLI (`supabase`)
- Netlify CLI (`netlify`)
- Git

## 1. Clone and Install

```bash
cd simple-dimple-pat
git checkout 001-token-gate
npm install
```

## 2. Start Supabase Local Stack

```bash
supabase start
```

This launches Postgres, Auth (GoTrue), Edge Functions runtime, and Studio in Docker.

Note the output — you'll need:
- `API URL` (e.g., `http://localhost:54321`)
- `anon key`
- `service_role key`

## 3. Run Database Migrations

```bash
supabase db reset
```

This applies all migrations in `supabase/migrations/` and seeds test data if available.

## 4. Set Up Environment Variables

Create `.env` at the project root (for Netlify dev):

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
```

## 5. Start Supabase Edge Functions

```bash
supabase functions serve
```

This serves Edge Functions (parse-spec, generate-token, etc.) at `http://localhost:54321/functions/v1/`.

## 6. Start Netlify Dev Server

In a separate terminal:

```bash
netlify dev
```

This starts the Vite frontend + Netlify Edge Functions (proxy) at `http://localhost:8888`.

## 7. Access the Application

- **Frontend**: http://localhost:8888
- **Supabase Studio**: http://localhost:54323
- **Proxy endpoint**: http://localhost:8888/proxy/{api_id}/{path}

## Running Tests

### Unit Tests (Vitest)

```bash
npm run test:unit
```

Tests pure functions: glob matching, token validation, permission checking.

### Integration Tests (with mock upstream)

```bash
# Start mock upstream (Prism) on port 4010
npx @stoplight/prism-cli mock tests/fixtures/petstore.yaml -p 4010 &

# Run integration tests
npm run test:integration
```

Tests full proxy flow against the mock upstream.

### E2E Tests (Playwright)

```bash
# Ensure local dev servers are running (steps 2-6 above)
npx playwright test
```

Tests management UI and proxy behavior end-to-end.

## Project Structure

```
simple-dimple-pat/
├── netlify/
│   └── edge-functions/
│       └── proxy.ts              # Proxy Edge Function
├── src/                           # React frontend (Vite)
│   ├── components/
│   │   ├── layout/               # Sidebar, DetailPanel, Header
│   │   ├── api/                  # API registration views
│   │   ├── token/                # Token management views
│   │   └── ui/                   # shadcn/ui components (themed)
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client init
│   │   ├── glob.ts               # Glob pattern matching
│   │   └── share-link.ts         # Share URL encoding/decoding
│   ├── hooks/                    # TanStack Query hooks
│   ├── pages/                    # Route pages
│   └── App.tsx
├── supabase/
│   ├── migrations/               # Numbered SQL migrations
│   ├── functions/
│   │   ├── parse-spec/           # OpenAPI parser Edge Function
│   │   ├── generate-token/       # Token creation Edge Function
│   │   ├── regenerate-token/     # Token regeneration Edge Function
│   │   ├── update-credential/    # Credential update Edge Function
│   │   └── _shared/              # Shared utilities
│   └── seed.sql                  # Dev seed data
├── shared/
│   └── types.ts                  # Shared TypeScript types
├── tests/
│   ├── unit/                     # Vitest unit tests
│   ├── integration/              # Proxy integration tests
│   ├── e2e/                      # Playwright E2E tests
│   └── fixtures/
│       ├── petstore-minimal.yaml # Minimal OpenAPI spec
│       └── petstore-full.yaml    # Full Petstore spec
├── netlify.toml                  # Netlify config + edge function routing
├── vite.config.ts
├── tailwind.config.ts
├── playwright.config.ts
└── package.json
```
