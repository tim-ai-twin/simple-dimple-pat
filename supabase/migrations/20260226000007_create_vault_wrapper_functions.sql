-- Migration 7: Vault wrapper functions
-- SECURITY DEFINER functions that provide ownership-verified access to Supabase Vault.
-- These run with elevated privileges so that application code never touches vault directly.

-- Store a new API credential in the vault and return its secret id.
CREATE OR REPLACE FUNCTION store_api_credential(
  p_user_id uuid,
  p_name text,
  p_value text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  v_secret_id := vault.create_secret(p_value, p_name);
  RETURN v_secret_id;
END;
$$;

COMMENT ON FUNCTION store_api_credential(uuid, text, text)
  IS 'Creates a Vault secret for an API credential and returns the secret id.';


-- Retrieve a decrypted API credential, verifying the caller owns the associated API registration.
CREATE OR REPLACE FUNCTION get_api_credential(
  p_user_id uuid,
  p_vault_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decrypted text;
BEGIN
  SELECT ds.decrypted_secret INTO v_decrypted
  FROM vault.decrypted_secrets ds
  INNER JOIN api_registrations ar ON ar.credential_vault_id = ds.id
  WHERE ds.id = p_vault_id
    AND ar.user_id = p_user_id;

  IF v_decrypted IS NULL THEN
    RAISE EXCEPTION 'Credential not found or access denied';
  END IF;

  RETURN v_decrypted;
END;
$$;

COMMENT ON FUNCTION get_api_credential(uuid, uuid)
  IS 'Returns the decrypted secret for a vault id after verifying the caller owns the API registration.';


-- Update an existing API credential in the vault after verifying ownership.
CREATE OR REPLACE FUNCTION update_api_credential(
  p_user_id uuid,
  p_vault_id uuid,
  p_new_value text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller owns an API registration linked to this vault id
  IF NOT EXISTS (
    SELECT 1
    FROM api_registrations
    WHERE credential_vault_id = p_vault_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Credential not found or access denied';
  END IF;

  PERFORM vault.update_secret(p_vault_id, p_new_value);
END;
$$;

COMMENT ON FUNCTION update_api_credential(uuid, uuid, text)
  IS 'Updates a Vault secret value after verifying the caller owns the associated API registration.';


-- Delete an API credential from the vault after verifying ownership.
CREATE OR REPLACE FUNCTION delete_api_credential(
  p_user_id uuid,
  p_vault_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller owns an API registration linked to this vault id
  IF NOT EXISTS (
    SELECT 1
    FROM api_registrations
    WHERE credential_vault_id = p_vault_id
      AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Credential not found or access denied';
  END IF;

  DELETE FROM vault.secrets WHERE id = p_vault_id;
END;
$$;

COMMENT ON FUNCTION delete_api_credential(uuid, uuid)
  IS 'Removes a secret from Supabase Vault by id after verifying the caller owns the associated API registration.';
