-- Migration 10: Fix RLS policies for performance + add missing FK indexes
-- Wraps auth.uid() in (select ...) to avoid per-row re-evaluation.
-- Adds indexes on request_logs.user_id and token_endpoint_permissions.endpoint_id FKs.

-- 1. api_registrations
DROP POLICY "Users can view their own API registrations" ON api_registrations;
DROP POLICY "Users can create their own API registrations" ON api_registrations;
DROP POLICY "Users can update their own API registrations" ON api_registrations;
DROP POLICY "Users can delete their own API registrations" ON api_registrations;

CREATE POLICY "Users can view their own API registrations"
  ON api_registrations FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can create their own API registrations"
  ON api_registrations FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own API registrations"
  ON api_registrations FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can delete their own API registrations"
  ON api_registrations FOR DELETE USING (user_id = (select auth.uid()));

-- 2. parsed_endpoints
DROP POLICY "Users can view endpoints for their own APIs" ON parsed_endpoints;
DROP POLICY "Users can create endpoints for their own APIs" ON parsed_endpoints;
DROP POLICY "Users can delete endpoints for their own APIs" ON parsed_endpoints;

CREATE POLICY "Users can view endpoints for their own APIs"
  ON parsed_endpoints FOR SELECT USING (
    EXISTS (SELECT 1 FROM api_registrations WHERE api_registrations.id = parsed_endpoints.api_id AND api_registrations.user_id = (select auth.uid()))
  );
CREATE POLICY "Users can create endpoints for their own APIs"
  ON parsed_endpoints FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM api_registrations WHERE api_registrations.id = parsed_endpoints.api_id AND api_registrations.user_id = (select auth.uid()))
  );
CREATE POLICY "Users can delete endpoints for their own APIs"
  ON parsed_endpoints FOR DELETE USING (
    EXISTS (SELECT 1 FROM api_registrations WHERE api_registrations.id = parsed_endpoints.api_id AND api_registrations.user_id = (select auth.uid()))
  );

-- 3. access_tokens
DROP POLICY "Users can view their own access tokens" ON access_tokens;
DROP POLICY "Users can create their own access tokens" ON access_tokens;
DROP POLICY "Users can update their own access tokens" ON access_tokens;
DROP POLICY "Users can delete their own access tokens" ON access_tokens;

CREATE POLICY "Users can view their own access tokens"
  ON access_tokens FOR SELECT USING (user_id = (select auth.uid()));
CREATE POLICY "Users can create their own access tokens"
  ON access_tokens FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can update their own access tokens"
  ON access_tokens FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY "Users can delete their own access tokens"
  ON access_tokens FOR DELETE USING (user_id = (select auth.uid()));

-- 4. token_endpoint_permissions
DROP POLICY "Users can view permissions for their own tokens" ON token_endpoint_permissions;
DROP POLICY "Users can create permissions for their own tokens" ON token_endpoint_permissions;
DROP POLICY "Users can update permissions for their own tokens" ON token_endpoint_permissions;
DROP POLICY "Users can delete permissions for their own tokens" ON token_endpoint_permissions;

CREATE POLICY "Users can view permissions for their own tokens"
  ON token_endpoint_permissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM access_tokens WHERE access_tokens.id = token_endpoint_permissions.token_id AND access_tokens.user_id = (select auth.uid()))
  );
CREATE POLICY "Users can create permissions for their own tokens"
  ON token_endpoint_permissions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM access_tokens WHERE access_tokens.id = token_endpoint_permissions.token_id AND access_tokens.user_id = (select auth.uid()))
  );
CREATE POLICY "Users can update permissions for their own tokens"
  ON token_endpoint_permissions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM access_tokens WHERE access_tokens.id = token_endpoint_permissions.token_id AND access_tokens.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM access_tokens WHERE access_tokens.id = token_endpoint_permissions.token_id AND access_tokens.user_id = (select auth.uid())));
CREATE POLICY "Users can delete permissions for their own tokens"
  ON token_endpoint_permissions FOR DELETE USING (
    EXISTS (SELECT 1 FROM access_tokens WHERE access_tokens.id = token_endpoint_permissions.token_id AND access_tokens.user_id = (select auth.uid()))
  );

-- 5. parameter_constraints
DROP POLICY "Users can view constraints for their own token permissions" ON parameter_constraints;
DROP POLICY "Users can create constraints for their own token permissions" ON parameter_constraints;
DROP POLICY "Users can update constraints for their own token permissions" ON parameter_constraints;
DROP POLICY "Users can delete constraints for their own token permissions" ON parameter_constraints;

CREATE POLICY "Users can view constraints for their own token permissions"
  ON parameter_constraints FOR SELECT USING (
    EXISTS (SELECT 1 FROM token_endpoint_permissions tep INNER JOIN access_tokens at ON at.id = tep.token_id WHERE tep.id = parameter_constraints.permission_id AND at.user_id = (select auth.uid()))
  );
CREATE POLICY "Users can create constraints for their own token permissions"
  ON parameter_constraints FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM token_endpoint_permissions tep INNER JOIN access_tokens at ON at.id = tep.token_id WHERE tep.id = parameter_constraints.permission_id AND at.user_id = (select auth.uid()))
  );
CREATE POLICY "Users can update constraints for their own token permissions"
  ON parameter_constraints FOR UPDATE
  USING (EXISTS (SELECT 1 FROM token_endpoint_permissions tep INNER JOIN access_tokens at ON at.id = tep.token_id WHERE tep.id = parameter_constraints.permission_id AND at.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM token_endpoint_permissions tep INNER JOIN access_tokens at ON at.id = tep.token_id WHERE tep.id = parameter_constraints.permission_id AND at.user_id = (select auth.uid())));
CREATE POLICY "Users can delete constraints for their own token permissions"
  ON parameter_constraints FOR DELETE USING (
    EXISTS (SELECT 1 FROM token_endpoint_permissions tep INNER JOIN access_tokens at ON at.id = tep.token_id WHERE tep.id = parameter_constraints.permission_id AND at.user_id = (select auth.uid()))
  );

-- 6. request_logs
DROP POLICY "Users can view their own request logs" ON request_logs;

CREATE POLICY "Users can view their own request logs"
  ON request_logs FOR SELECT USING (user_id = (select auth.uid()));

-- Add missing FK indexes
CREATE INDEX idx_request_logs_user_id ON request_logs (user_id);
CREATE INDEX idx_token_endpoint_permissions_endpoint_id ON token_endpoint_permissions (endpoint_id);
