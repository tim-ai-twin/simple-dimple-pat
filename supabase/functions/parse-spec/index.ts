import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";
import YAML from "https://esm.sh/yaml@2";

interface ParsedEndpoint {
  method: string;
  path: string;
  operation_id: string | null;
  summary: string | null;
  tag: string | null;
  parameters: EndpointParameter[];
  display_order: number;
}

interface EndpointParameter {
  name: string;
  in: string;
  type: string;
  required: boolean;
  enum: string[] | null;
}

interface RequestBody {
  name: string;
  base_url: string;
  auth_method: string;
  auth_header_name: string | null;
  auth_query_param: string | null;
  credential: string;
  spec_content: string;
  api_id?: string; // If provided, re-upload spec for existing API
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"];

/**
 * Validate that a base URL is safe (not a private/internal address).
 */
function isBaseUrlSafe(urlStr: string): { safe: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { safe: false, reason: "Invalid URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { safe: false, reason: "Only http/https schemes are allowed" };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1" || hostname === "0.0.0.0") {
    return { safe: false, reason: "Loopback addresses not allowed" };
  }

  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    return { safe: false, reason: "Cloud metadata endpoints not allowed" };
  }

  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (a === 10) return { safe: false, reason: "Private IP range not allowed" };
    if (a === 172 && b >= 16 && b <= 31) return { safe: false, reason: "Private IP range not allowed" };
    if (a === 192 && b === 168) return { safe: false, reason: "Private IP range not allowed" };
    if (a === 169 && b === 254) return { safe: false, reason: "Link-local range not allowed" };
    if (a === 127) return { safe: false, reason: "Loopback range not allowed" };
    if (a === 0) return { safe: false, reason: "Reserved range not allowed" };
  }

  return { safe: true };
}

function parseSpec(specContent: string): Record<string, unknown> {
  // Try JSON first
  try {
    return JSON.parse(specContent);
  } catch {
    // Fall through to YAML
  }

  // Try YAML
  try {
    const parsed = YAML.parse(specContent);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    throw new Error("YAML parsed to a non-object value");
  } catch (e) {
    throw new Error(`Failed to parse spec as JSON or YAML: ${(e as Error).message}`);
  }
}

function validateSpec(spec: Record<string, unknown>): { version: string } {
  const version = spec.openapi ?? spec.swagger;
  if (!version || typeof version !== "string") {
    throw new Error("missing 'openapi' or 'swagger' version field");
  }

  if (!spec.paths || typeof spec.paths !== "object") {
    throw new Error("missing 'paths' property");
  }

  return { version };
}

function extractEndpoints(paths: Record<string, Record<string, unknown>>): {
  endpoints: ParsedEndpoint[];
  tags: string[];
} {
  const endpoints: ParsedEndpoint[] = [];
  const tagSet = new Set<string>();
  let displayOrder = 0;

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method];
      if (!operation || typeof operation !== "object") continue;

      const op = operation as Record<string, unknown>;

      const operationId = typeof op.operationId === "string" ? op.operationId : null;
      const summary = typeof op.summary === "string" ? op.summary : null;

      const tags = Array.isArray(op.tags) ? op.tags : [];
      const firstTag = tags.length > 0 && typeof tags[0] === "string" ? tags[0] : null;
      if (firstTag) {
        tagSet.add(firstTag);
      }

      // Merge path-level and operation-level parameters
      const pathParams = Array.isArray((pathItem as Record<string, unknown>).parameters)
        ? ((pathItem as Record<string, unknown>).parameters as unknown[])
        : [];
      const opParams = Array.isArray(op.parameters) ? (op.parameters as unknown[]) : [];
      const allRawParams = [...pathParams, ...opParams];

      const parameters: EndpointParameter[] = allRawParams
        .filter((p): p is Record<string, unknown> => p !== null && typeof p === "object")
        .map((p) => {
          const schema = p.schema as Record<string, unknown> | undefined;
          const paramType =
            typeof p.type === "string"
              ? p.type
              : schema && typeof schema.type === "string"
                ? schema.type
                : "string";

          const paramEnum =
            Array.isArray(p.enum)
              ? p.enum.filter((v): v is string => typeof v === "string")
              : schema && Array.isArray(schema.enum)
                ? schema.enum.filter((v): v is string => typeof v === "string")
                : null;

          return {
            name: typeof p.name === "string" ? p.name : "unknown",
            in: typeof p.in === "string" ? p.in : "query",
            type: paramType,
            required: p.required === true,
            enum: paramEnum && paramEnum.length > 0 ? paramEnum : null,
          };
        });

      endpoints.push({
        method: method.toUpperCase(),
        path,
        operation_id: operationId,
        summary,
        tag: firstTag,
        parameters,
        display_order: displayOrder++,
      });
    }
  }

  return {
    endpoints,
    tags: Array.from(tagSet).sort(),
  };
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "method_not_allowed", message: "Only POST is accepted" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      console.error("parse-spec: No Authorization header found");
      return new Response(
        JSON.stringify({ error: "unauthorized", message: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      console.error("parse-spec: auth.getUser failed", userError?.message ?? "no user returned");
      return new Response(
        JSON.stringify({
          error: "unauthorized",
          message: userError?.message ?? "Invalid or expired token",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();

    const isReupload = !!body.api_id;

    // For re-upload, only spec_content is required
    if (isReupload) {
      if (!body.spec_content) {
        return new Response(
          JSON.stringify({
            error: "bad_request",
            message: "Missing required field: spec_content",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else if (!body.name || !body.base_url || !body.auth_method || !body.spec_content) {
      return new Response(
        JSON.stringify({
          error: "bad_request",
          message: "Missing required fields: name, base_url, auth_method, spec_content",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate base_url is not a private/internal address (SSRF protection)
    if (!isReupload) {
      const urlCheck = isBaseUrlSafe(body.base_url);
      if (!urlCheck.safe) {
        return new Response(
          JSON.stringify({
            error: "bad_request",
            message: `Invalid base URL: ${urlCheck.reason}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Parse the OpenAPI spec
    let spec: Record<string, unknown>;
    try {
      spec = parseSpec(body.spec_content);
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: "invalid_spec",
          message: `OpenAPI spec validation failed: ${(e as Error).message}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate the spec structure
    let specVersion: string;
    try {
      const validation = validateSpec(spec);
      specVersion = validation.version;
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: "invalid_spec",
          message: `OpenAPI spec validation failed: ${(e as Error).message}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Extract endpoints
    const { endpoints, tags } = extractEndpoints(
      spec.paths as Record<string, Record<string, unknown>>,
    );

    let apiId: string;

    if (isReupload) {
      // Re-upload mode: verify ownership, delete old endpoints, update spec
      const { data: existingApi, error: lookupError } = await supabaseAdmin
        .from("api_registrations")
        .select("id, user_id")
        .eq("id", body.api_id!)
        .single();

      if (lookupError || !existingApi) {
        return new Response(
          JSON.stringify({ error: "not_found", message: "API not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (existingApi.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "forbidden", message: "You do not own this API" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      apiId = existingApi.id;

      // Delete old endpoints (cascades to permissions and constraints)
      const { error: deleteError } = await supabaseAdmin
        .from("parsed_endpoints")
        .delete()
        .eq("api_id", apiId);

      if (deleteError) {
        return new Response(
          JSON.stringify({
            error: "db_error",
            message: `Failed to delete old endpoints: ${deleteError.message}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Update spec_raw and spec_version on the API registration
      const { error: updateError } = await supabaseAdmin
        .from("api_registrations")
        .update({ spec_raw: body.spec_content, spec_version: specVersion })
        .eq("id", apiId);

      if (updateError) {
        return new Response(
          JSON.stringify({
            error: "db_error",
            message: `Failed to update API: ${updateError.message}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      // New API mode: store credential, create registration
      const { data: vaultResult, error: vaultError } = await supabaseAdmin.rpc(
        "store_api_credential",
        {
          p_user_id: user.id,
          p_name: `${body.name} credential`,
          p_value: body.credential,
        },
      );

      if (vaultError) {
        return new Response(
          JSON.stringify({
            error: "vault_error",
            message: `Failed to store credential: ${vaultError.message}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: api, error: apiError } = await supabaseAdmin
        .from("api_registrations")
        .insert({
          user_id: user.id,
          name: body.name,
          base_url: body.base_url,
          auth_method: body.auth_method,
          auth_header_name: body.auth_header_name,
          auth_query_param: body.auth_query_param,
          credential_vault_id: vaultResult,
          spec_raw: body.spec_content,
          spec_version: specVersion,
        })
        .select()
        .single();

      if (apiError) {
        return new Response(
          JSON.stringify({
            error: "db_error",
            message: `Failed to create API registration: ${apiError.message}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      apiId = api.id;
    }

    // Insert parsed endpoints
    if (endpoints.length > 0) {
      const endpointRows = endpoints.map((ep) => ({
        api_id: apiId,
        method: ep.method,
        path_template: ep.path,
        operation_id: ep.operation_id,
        summary: ep.summary,
        tag: ep.tag,
        parameters: ep.parameters,
        display_order: ep.display_order,
      }));

      const { error: endpointsError } = await supabaseAdmin
        .from("parsed_endpoints")
        .insert(endpointRows);

      if (endpointsError) {
        return new Response(
          JSON.stringify({
            error: "db_error",
            message: `Failed to insert endpoints: ${endpointsError.message}`,
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Return success
    return new Response(
      JSON.stringify({
        api_id: apiId,
        endpoint_count: endpoints.length,
        spec_version: specVersion,
        tags,
        reupload: isReupload,
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
