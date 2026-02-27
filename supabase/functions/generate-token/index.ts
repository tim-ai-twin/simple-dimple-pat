import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { generateToken, hashToken } from "../_shared/token-utils.ts";

interface EndpointPermissionInput {
  endpoint_id: string;
  is_allowed: boolean;
}

interface ParameterConstraintInput {
  endpoint_id: string;
  param_name: string;
  allowed_patterns: string[];
}

interface RequestBody {
  api_id: string;
  name: string;
  expires_at?: string;
  endpoint_permissions?: EndpointPermissionInput[];
  parameter_constraints?: ParameterConstraintInput[];
}

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
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.replace("Bearer ", "");

    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();

    if (!body.api_id || !body.name) {
      return new Response(
        JSON.stringify({
          error: "bad_request",
          message: "Missing required fields: api_id, name",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify user owns the API
    const { data: api, error: apiError } = await supabaseAdmin
      .from("api_registrations")
      .select("id")
      .eq("id", body.api_id)
      .eq("user_id", user.id)
      .single();

    if (apiError || !api) {
      return new Response(
        JSON.stringify({ error: "not_found", message: "API not found or not owned by you" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate token
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 8); // "sdp_aBcD"

    // Default expiration: 12 months from now
    const defaultExpiry = new Date();
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
    const expiresAt = body.expires_at ?? defaultExpiry.toISOString();

    // Insert access_token
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("access_tokens")
      .insert({
        api_id: body.api_id,
        user_id: user.id,
        name: body.name,
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
        status: "active",
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (tokenError) {
      return new Response(
        JSON.stringify({
          error: "db_error",
          message: `Failed to create token: ${tokenError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get all endpoints for this API
    const { data: endpoints, error: epError } = await supabaseAdmin
      .from("parsed_endpoints")
      .select("id")
      .eq("api_id", body.api_id);

    if (epError) {
      return new Response(
        JSON.stringify({
          error: "db_error",
          message: `Failed to fetch endpoints: ${epError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Build permission overrides map from request
    const permOverrides = new Map<string, boolean>();
    if (body.endpoint_permissions) {
      for (const ep of body.endpoint_permissions) {
        permOverrides.set(ep.endpoint_id, ep.is_allowed);
      }
    }

    // Create token_endpoint_permissions (all allowed by default, with overrides)
    const permissionRows = (endpoints ?? []).map((ep) => ({
      token_id: tokenRow.id,
      endpoint_id: ep.id,
      is_allowed: permOverrides.has(ep.id) ? permOverrides.get(ep.id) : true,
    }));

    if (permissionRows.length > 0) {
      const { error: permError } = await supabaseAdmin
        .from("token_endpoint_permissions")
        .insert(permissionRows);

      if (permError) {
        return new Response(
          JSON.stringify({
            error: "db_error",
            message: `Failed to create permissions: ${permError.message}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Create parameter constraints if provided
    if (body.parameter_constraints && body.parameter_constraints.length > 0) {
      // We need to map endpoint_id from the request to the permission_id we just created
      const { data: createdPerms } = await supabaseAdmin
        .from("token_endpoint_permissions")
        .select("id, endpoint_id")
        .eq("token_id", tokenRow.id);

      const epToPermId = new Map<string, string>();
      for (const p of createdPerms ?? []) {
        epToPermId.set(p.endpoint_id, p.id);
      }

      const constraintRows = body.parameter_constraints
        .filter((c) => epToPermId.has(c.endpoint_id))
        .map((c) => ({
          permission_id: epToPermId.get(c.endpoint_id)!,
          param_name: c.param_name,
          allowed_patterns: c.allowed_patterns,
        }));

      if (constraintRows.length > 0) {
        const { error: constraintError } = await supabaseAdmin
          .from("parameter_constraints")
          .insert(constraintRows);

        if (constraintError) {
          return new Response(
            JSON.stringify({
              error: "db_error",
              message: `Failed to create constraints: ${constraintError.message}`,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Return success with raw token (show-once)
    return new Response(
      JSON.stringify({
        token_id: tokenRow.id,
        raw_token: rawToken,
        token_prefix: tokenPrefix,
        name: body.name,
        expires_at: expiresAt,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: (e as Error).message ?? "An unexpected error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
