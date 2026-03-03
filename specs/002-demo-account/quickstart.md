# Quickstart: Demo Account

**Feature Branch**: `002-demo-account`

## Prerequisites

- Node.js 18+ and npm
- Supabase CLI (`supabase`) installed
- Access to the Supabase project dashboard (to enable email auth provider)
- `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

## Setup Steps

### 1. Enable Email Auth Provider

In Supabase Dashboard → Authentication → Providers → Email:
- Enable the Email provider
- This allows `signInWithPassword()` for the demo account

### 2. Create Demo User

The demo user is created via the Supabase Admin API (one-time setup). This will be done via the `reset-demo` Edge Function's first invocation, or can be done manually:

```bash
# Via Supabase Admin API (from Edge Function or CLI)
supabase functions invoke reset-demo --no-verify-jwt
```

### 3. Apply Migrations

No new migrations are needed — the demo account uses existing tables.

### 4. Deploy Edge Functions

```bash
# Deploy the new reset-demo function
supabase functions deploy reset-demo --no-verify-jwt
```

### 5. Run Locally

```bash
npm run dev
# Visit http://localhost:5173
# Click "Demo Account" button on the landing page
```

## Key Files (New/Modified)

| File | Change |
|------|--------|
| `src/App.tsx` | Add "Demo Account" button to LoginPage |
| `src/lib/demo.ts` | New — exports DEMO_USER_ID, DEMO_USER_EMAIL, DEMO_USER_PASSWORD, isDemoUser() |
| `src/components/layout/Sidebar.tsx` | Add "Reset Demo" button (visible only for demo user) |
| `src/components/layout/Header.tsx` | Add demo mode indicator badge |
| `src/hooks/useDemo.ts` | New — useResetDemo() mutation hook |
| `supabase/functions/reset-demo/index.ts` | New — Edge Function for demo data reset/provisioning |
| `supabase/functions/_shared/demo-seed.ts` | New — Seed data definitions (Petstore spec, endpoints, token, logs) |
| `shared/types.ts` | No changes needed |

## Testing the Feature

1. **Enter demo mode**: Click "Demo Account" on landing page → should land on dashboard with Petstore API data
2. **Verify demo indicator**: Yellow/blue banner should show "Demo Mode — shared account" on every page
3. **Verify sidebar**: "Reset Demo" button should be visible at bottom of sidebar
4. **Test reset**: Click "Reset Demo" → confirm → dashboard should refresh with clean seed data
5. **Exit demo**: Click "Sign Out" → should return to landing page
6. **Sign in normally**: Click "Sign in with Google" → should get own private account with no demo data
