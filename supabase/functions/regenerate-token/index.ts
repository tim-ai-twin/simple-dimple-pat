import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import { generateToken, hashToken } from "../_shared/token-utils.ts";

interface RequestBody {
  token_id: string;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "method_not_allowed",
        message: "Only POST is accepted",
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    // Authenticate user via JWT
    const authHeader = req.headers.get("Authorization");
    const jwt = authHeader?.replace("Bearer ", "");

    if (!jwt) {
      return new Response(
        JSON.stringify({
          error: "unauthorized",
          message: "Missing Authorization header",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: "unauthorized",
          message: "Invalid or expired token",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();

    if (!body.token_id) {
      return new Response(
        JSON.stringify({
          error: "bad_request",
          message: "Missing required field: token_id",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify user owns the token by joining through api_registrations
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("access_tokens")
      .select("id, api_id, api_registrations!inner(user_id)")
      .eq("id", body.token_id)
      .single();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({
          error: "not_found",
          message: "Token not found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check ownership via the joined api_registration
    const registration = tokenRow.api_registrations as unknown as {
      user_id: string;
    };
    if (registration.user_id !== user.id) {
      return new Response(
        JSON.stringify({
          error: "forbidden",
          message: "Token not owned by you",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Generate new token
    const rawToken = generateToken();
    const tokenHash = await hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 8); // "sdp_aBcD"

    // Update access_tokens with new hash and prefix
    const { error: updateError } = await supabaseAdmin
      .from("access_tokens")
      .update({
        token_hash: tokenHash,
        token_prefix: tokenPrefix,
      })
      .eq("id", body.token_id);

    if (updateError) {
      return new Response(
        JSON.stringify({
          error: "db_error",
          message: `Failed to regenerate token: ${updateError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Return the new raw token (show-once) and prefix
    return new Response(
      JSON.stringify({
        raw_token: rawToken,
        token_prefix: tokenPrefix,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: "internal_error",
        message: (e as Error).message ?? "An unexpected error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
