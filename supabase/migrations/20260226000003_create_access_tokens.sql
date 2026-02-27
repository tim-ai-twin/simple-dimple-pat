-- Migration 3: access_tokens
-- Stores hashed access tokens that grant scoped access to registered APIs.

CREATE TABLE access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id uuid REFERENCES api_registrations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- token_hash already has a unique index from the UNIQUE constraint
CREATE INDEX idx_access_tokens_user_id ON access_tokens (user_id);
CREATE INDEX idx_access_tokens_api_id ON access_tokens (api_id);

COMMENT ON TABLE access_tokens IS 'Hashed access tokens granting scoped access to registered APIs.';
COMMENT ON COLUMN access_tokens.token_hash IS 'SHA-256 hash of the plaintext token. The plaintext is shown only once at creation.';
COMMENT ON COLUMN access_tokens.token_prefix IS 'First few characters of the token for display/identification (e.g. sdp_a1b2...).';
