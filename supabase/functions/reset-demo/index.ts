import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import {
  DEMO_USER_ID,
  DEMO_USER_EMAIL,
  DEMO_USER_PASSWORD,
  PETSTORE_SPEC_RAW,
  getSeedEndpoints,
  getSeedTokenData,
  getSeedPermissions,
  getSeedLogs,
} from "../_shared/demo-seed.ts";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed", message: "Only POST is accepted" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // ── Ensure demo user exists (bootstrap if needed) ──────────────
    const { error: getUserError } = await supabaseAdmin.auth.admin.getUserById(DEMO_USER_ID);
    let isBootstrap = false;
    if (getUserError) {
      console.log("reset-demo: Demo user not found, creating...");
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        id: DEMO_USER_ID,
        email: DEMO_USER_EMAIL,
        password: DEMO_USER_PASSWORD,
        email_confirm: true,
      });
      if (createError) {
        console.error("reset-demo: Failed to create demo user", createError.message);
        return new Response(
          JSON.stringify({ error: "internal_error", message: `Failed to create demo user: ${createError.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      isBootstrap = true;
    }

    // ── Authenticate caller (skip during bootstrap) ────────────────
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!isBootstrap) {
      if (!token) {
        return new Response(
          JSON.stringify({ error: "unauthorized", message: "Missing Authorization header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "unauthorized", message: userError?.message ?? "Invalid or expired token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (user.id !== DEMO_USER_ID) {
        return new Response(
          JSON.stringify({ error: "forbidden", message: "Reset is only available for the demo account" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Delete existing demo data (FK-safe order) ──────────────────

    // 1. Delete request_logs
    await supabaseAdmin
      .from("request_logs")
      .delete()
      .eq("user_id", DEMO_USER_ID);

    // 2. Delete access_tokens (cascades to token_endpoint_permissions → parameter_constraints)
    await supabaseAdmin
      .from("access_tokens")
      .delete()
      .eq("user_id", DEMO_USER_ID);

    // 3. Fetch vault IDs and delete vault secrets BEFORE deleting API registrations
    //    (RPC ownership check requires the api_registration row to still exist)
    const { data: existingApis } = await supabaseAdmin
      .from("api_registrations")
      .select("credential_vault_id")
      .eq("user_id", DEMO_USER_ID);

    const vaultIds = (existingApis ?? [])
      .map((a: { credential_vault_id: string }) => a.credential_vault_id)
      .filter(Boolean);

    for (const vid of vaultIds) {
      // Vault secret may already be gone — ignore errors
      await supabaseAdmin.rpc("delete_api_credential", {
        p_user_id: DEMO_USER_ID,
        p_vault_id: vid,
      });
    }

    // 4. Delete API registrations (cascades to parsed_endpoints)
    await supabaseAdmin
      .from("api_registrations")
      .delete()
      .eq("user_id", DEMO_USER_ID);

    // ── Re-insert seed data ────────────────────────────────────────

    // 1. Store dummy vault credential
    const { data: vaultId, error: vaultError } = await supabaseAdmin.rpc(
      "store_api_credential",
      {
        p_user_id: DEMO_USER_ID,
        p_name: "Petstore API credential",
        p_value: "demo-petstore-key",
      },
    );

    if (vaultError) {
      console.error("reset-demo: vault error", vaultError.message);
      return new Response(
        JSON.stringify({ error: "internal_error", message: `Vault error: ${vaultError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Insert API registration
    const { data: api, error: apiError } = await supabaseAdmin
      .from("api_registrations")
      .insert({
        user_id: DEMO_USER_ID,
        name: "Petstore API",
        base_url: "https://petstore3.swagger.io/api/v3",
        auth_method: "bearer_token",
        credential_vault_id: vaultId,
        spec_raw: PETSTORE_SPEC_RAW,
        spec_version: "3.0.3",
      })
      .select()
      .single();

    if (apiError) {
      console.error("reset-demo: api insert error", apiError.message);
      return new Response(
        JSON.stringify({ error: "internal_error", message: `API insert error: ${apiError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiId = api.id;

    // 3. Insert parsed endpoints
    const endpointRows = getSeedEndpoints(apiId);
    const { data: insertedEndpoints, error: epError } = await supabaseAdmin
      .from("parsed_endpoints")
      .insert(endpointRows)
      .select("id, method, path_template");

    if (epError) {
      console.error("reset-demo: endpoints insert error", epError.message);
      return new Response(
        JSON.stringify({ error: "internal_error", message: `Endpoints insert error: ${epError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const endpointCount = insertedEndpoints?.length ?? 0;

    // 4. Insert access token
    const tokenData = await getSeedTokenData();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("access_tokens")
      .insert({
        api_id: apiId,
        user_id: DEMO_USER_ID,
        name: tokenData.name,
        token_hash: tokenData.tokenHash,
        token_prefix: tokenData.tokenPrefix,
        status: "active",
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (tokenError) {
      console.error("reset-demo: token insert error", tokenError.message);
      return new Response(
        JSON.stringify({ error: "internal_error", message: `Token insert error: ${tokenError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tokenId = tokenRow.id;

    // 5. Insert token endpoint permissions + constraints
    const epMap = (insertedEndpoints ?? []).map((ep: { id: string; method: string; path_template: string }) => ({
      id: ep.id,
      method: ep.method,
      path_template: ep.path_template,
    }));

    const { permissions, constraints } = getSeedPermissions(tokenId, epMap);

    const { data: insertedPerms, error: permError } = await supabaseAdmin
      .from("token_endpoint_permissions")
      .insert(permissions)
      .select("id, endpoint_id");

    if (permError) {
      console.error("reset-demo: permissions insert error", permError.message);
    }

    // Insert parameter constraint (for findByStatus)
    if (constraints.length > 0 && insertedPerms) {
      const findByStatusEp = epMap.find(
        (ep: { method: string; path_template: string }) =>
          ep.method === "GET" && ep.path_template === "/pet/findByStatus",
      );
      if (findByStatusEp) {
        const perm = insertedPerms.find(
          (p: { endpoint_id: string }) => p.endpoint_id === findByStatusEp.id,
        );
        if (perm) {
          await supabaseAdmin
            .from("parameter_constraints")
            .insert({
              permission_id: perm.id,
              param_name: constraints[0].param_name,
              allowed_patterns: constraints[0].allowed_patterns,
            });
        }
      }
    }

    // 6. Insert sample request logs
    const logRows = getSeedLogs(apiId, tokenId, DEMO_USER_ID);
    const { error: logError } = await supabaseAdmin
      .from("request_logs")
      .insert(logRows);

    if (logError) {
      console.error("reset-demo: logs insert error", logError.message);
    }

    const logCount = logRows.length;

    return new Response(
      JSON.stringify({
        success: true,
        api_id: apiId,
        endpoint_count: endpointCount,
        token_id: tokenId,
        log_count: logCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("reset-demo: unexpected error", (e as Error).message);
    return new Response(
      JSON.stringify({ error: "internal_error", message: (e as Error).message ?? "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
