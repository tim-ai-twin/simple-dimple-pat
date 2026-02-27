-- Migration 2: parsed_endpoints
-- Stores individual API endpoints parsed from the OpenAPI spec.

CREATE TABLE parsed_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id uuid REFERENCES api_registrations(id) ON DELETE CASCADE NOT NULL,
  operation_id text,
  method text NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')),
  path_template text NOT NULL,
  tag text,
  summary text,
  parameters jsonb NOT NULL DEFAULT '[]',
  display_order integer NOT NULL DEFAULT 0,
  UNIQUE (api_id, method, path_template)
);

CREATE INDEX idx_parsed_endpoints_api_id ON parsed_endpoints (api_id);

COMMENT ON TABLE parsed_endpoints IS 'Individual API endpoints parsed from the registered API OpenAPI spec.';
COMMENT ON COLUMN parsed_endpoints.path_template IS 'URL path with parameter placeholders, e.g. /users/{id}/posts.';
COMMENT ON COLUMN parsed_endpoints.parameters IS 'JSON array of parameter definitions extracted from the spec.';
