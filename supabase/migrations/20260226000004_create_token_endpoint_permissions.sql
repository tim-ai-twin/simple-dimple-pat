-- Migration 4: token_endpoint_permissions
-- Maps which endpoints each access token is allowed (or denied) to call.

CREATE TABLE token_endpoint_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES access_tokens(id) ON DELETE CASCADE NOT NULL,
  endpoint_id uuid REFERENCES parsed_endpoints(id) ON DELETE CASCADE NOT NULL,
  is_allowed boolean NOT NULL DEFAULT true,
  UNIQUE (token_id, endpoint_id)
);

COMMENT ON TABLE token_endpoint_permissions IS 'Per-token, per-endpoint allow/deny permissions.';
COMMENT ON COLUMN token_endpoint_permissions.is_allowed IS 'When true the token may call this endpoint; when false it is explicitly blocked.';
