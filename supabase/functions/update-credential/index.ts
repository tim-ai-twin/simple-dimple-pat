import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

interface RequestBody {
  api_id: string;
  credential: string;
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

    const body: RequestBody = await req.json();

    if (!body.api_id || !body.credential) {
      return new Response(
        JSON.stringify({ error: "bad_request", message: "Missing required fields: api_id, credential" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify user owns the API
    const { data: api, error: apiError } = await supabaseAdmin
      .from("api_registrations")
      .select("id, credential_vault_id")
      .eq("id", body.api_id)
      .eq("user_id", user.id)
      .single();

    if (apiError || !api) {
      return new Response(
        JSON.stringify({ error: "not_found", message: "API not found or not owned by you" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update credential in Vault
    const { error: vaultError } = await supabaseAdmin.rpc("update_api_credential", {
      p_vault_id: api.credential_vault_id,
      p_user_id: user.id,
      p_value: body.credential,
    });

    if (vaultError) {
      return new Response(
        JSON.stringify({ error: "vault_error", message: `Failed to update credential: ${vaultError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "internal_error", message: (e as Error).message ?? "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
