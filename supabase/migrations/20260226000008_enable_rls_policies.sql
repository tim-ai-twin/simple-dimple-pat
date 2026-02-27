-- Migration 8: Row Level Security policies
-- Enables RLS on all tables and creates ownership-based access policies.

-- =============================================================================
-- 1. api_registrations — direct user_id ownership check
-- =============================================================================
ALTER TABLE api_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own API registrations"
  ON api_registrations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own API registrations"
  ON api_registrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own API registrations"
  ON api_registrations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own API registrations"
  ON api_registrations FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- 2. parsed_endpoints — ownership via join to api_registrations
-- =============================================================================
ALTER TABLE parsed_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view endpoints for their own APIs"
  ON parsed_endpoints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM api_registrations
      WHERE api_registrations.id = parsed_endpoints.api_id
        AND api_registrations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create endpoints for their own APIs"
  ON parsed_endpoints FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM api_registrations
      WHERE api_registrations.id = parsed_endpoints.api_id
        AND api_registrations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete endpoints for their own APIs"
  ON parsed_endpoints FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM api_registrations
      WHERE api_registrations.id = parsed_endpoints.api_id
        AND api_registrations.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 3. access_tokens — direct user_id ownership check
-- =============================================================================
ALTER TABLE access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own access tokens"
  ON access_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own access tokens"
  ON access_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own access tokens"
  ON access_tokens FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own access tokens"
  ON access_tokens FOR DELETE
  USING (user_id = auth.uid());

-- =============================================================================
-- 4. token_endpoint_permissions — ownership via join through access_tokens
-- =============================================================================
ALTER TABLE token_endpoint_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view permissions for their own tokens"
  ON token_endpoint_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM access_tokens
      WHERE access_tokens.id = token_endpoint_permissions.token_id
        AND access_tokens.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create permissions for their own tokens"
  ON token_endpoint_permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM access_tokens
      WHERE access_tokens.id = token_endpoint_permissions.token_id
        AND access_tokens.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update permissions for their own tokens"
  ON token_endpoint_permissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM access_tokens
      WHERE access_tokens.id = token_endpoint_permissions.token_id
        AND access_tokens.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM access_tokens
      WHERE access_tokens.id = token_endpoint_permissions.token_id
        AND access_tokens.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete permissions for their own tokens"
  ON token_endpoint_permissions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM access_tokens
      WHERE access_tokens.id = token_endpoint_permissions.token_id
        AND access_tokens.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 5. parameter_constraints — ownership via join chain:
--    parameter_constraints -> token_endpoint_permissions -> access_tokens
-- =============================================================================
ALTER TABLE parameter_constraints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view constraints for their own token permissions"
  ON parameter_constraints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM token_endpoint_permissions tep
      INNER JOIN access_tokens at ON at.id = tep.token_id
      WHERE tep.id = parameter_constraints.permission_id
        AND at.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create constraints for their own token permissions"
  ON parameter_constraints FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM token_endpoint_permissions tep
      INNER JOIN access_tokens at ON at.id = tep.token_id
      WHERE tep.id = parameter_constraints.permission_id
        AND at.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update constraints for their own token permissions"
  ON parameter_constraints FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM token_endpoint_permissions tep
      INNER JOIN access_tokens at ON at.id = tep.token_id
      WHERE tep.id = parameter_constraints.permission_id
        AND at.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM token_endpoint_permissions tep
      INNER JOIN access_tokens at ON at.id = tep.token_id
      WHERE tep.id = parameter_constraints.permission_id
        AND at.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete constraints for their own token permissions"
  ON parameter_constraints FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM token_endpoint_permissions tep
      INNER JOIN access_tokens at ON at.id = tep.token_id
      WHERE tep.id = parameter_constraints.permission_id
        AND at.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 6. request_logs — SELECT only for the owning user.
--    INSERT is done by the proxy via service_role which bypasses RLS.
-- =============================================================================
ALTER TABLE request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own request logs"
  ON request_logs FOR SELECT
  USING (user_id = auth.uid());
