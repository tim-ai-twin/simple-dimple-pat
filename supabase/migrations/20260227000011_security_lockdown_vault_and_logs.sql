-- Migration 11: Security fixes
-- 1. Revoke direct execution of vault wrapper functions from anon/authenticated
--    These must only be called via service_role (from Edge Functions).
-- 2. Make request_logs.user_id nullable so proxy can log unauthenticated attempts.

-- Lock down vault SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION store_api_credential(uuid, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_api_credential(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION update_api_credential(uuid, uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION delete_api_credential(uuid, uuid) FROM anon, authenticated;

-- Make user_id nullable on request_logs for anonymous audit trail
ALTER TABLE request_logs ALTER COLUMN user_id DROP NOT NULL;
