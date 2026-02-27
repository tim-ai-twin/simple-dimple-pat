-- Migration 1: api_registrations
-- Stores registered third-party APIs with their auth configuration and OpenAPI spec.

CREATE TABLE api_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  base_url text NOT NULL,
  auth_method text NOT NULL CHECK (auth_method IN ('bearer_token', 'api_key_header', 'api_key_query')),
  auth_header_name text,
  auth_query_param text,
  credential_vault_id uuid NOT NULL,
  spec_raw text NOT NULL,
  spec_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_registrations_user_id ON api_registrations (user_id);

COMMENT ON TABLE api_registrations IS 'Registered third-party APIs with auth configuration and raw OpenAPI spec.';
COMMENT ON COLUMN api_registrations.credential_vault_id IS 'References a secret stored in Supabase Vault (vault.secrets.id).';
COMMENT ON COLUMN api_registrations.auth_method IS 'How credentials are passed: bearer_token, api_key_header, or api_key_query.';
