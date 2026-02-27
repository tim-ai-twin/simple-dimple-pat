-- Migration 5: parameter_constraints
-- Restricts specific parameter values that a token+endpoint permission allows.

CREATE TABLE parameter_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_id uuid REFERENCES token_endpoint_permissions(id) ON DELETE CASCADE NOT NULL,
  param_name text NOT NULL,
  allowed_patterns text[] NOT NULL,
  UNIQUE (permission_id, param_name)
);

COMMENT ON TABLE parameter_constraints IS 'Per-permission parameter value restrictions using pattern matching.';
COMMENT ON COLUMN parameter_constraints.allowed_patterns IS 'Array of allowed patterns for the parameter value. Supports exact values or LIKE-style patterns.';
