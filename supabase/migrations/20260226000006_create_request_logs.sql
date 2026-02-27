-- Migration 6: request_logs
-- Audit log of every proxy request, including blocked attempts.

CREATE TABLE request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid REFERENCES access_tokens(id) ON DELETE SET NULL,
  api_id uuid REFERENCES api_registrations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer,
  blocked boolean NOT NULL DEFAULT false,
  block_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Composite index for querying logs by API over time
CREATE INDEX idx_request_logs_api_id_created_at ON request_logs (api_id, created_at DESC);

-- Composite index for querying logs by token over time
CREATE INDEX idx_request_logs_token_id_created_at ON request_logs (token_id, created_at DESC);

-- Index on created_at for time-based purge/cleanup jobs
CREATE INDEX idx_request_logs_created_at ON request_logs (created_at);

COMMENT ON TABLE request_logs IS 'Audit log of all proxy requests including blocked attempts.';
COMMENT ON COLUMN request_logs.blocked IS 'True if the proxy rejected the request before forwarding.';
COMMENT ON COLUMN request_logs.block_reason IS 'Human-readable reason the request was blocked, if applicable.';
